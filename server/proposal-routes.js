import {
  PROPOSAL_TEMPLATES,
  PROPOSAL_BLOCK_TYPES,
  blocksFromTemplate,
  templatesForClientType,
  recommendedBlocksForType,
  defaultBlockContent,
  normalizeCleatusTriage,
} from "./proposal-data.js";

const TRIAGE_STATES = ["inbox", "building", "internal_review", "sent", "signed", "declined", "archived"];

/** Allowlist-based HTML sanitizer for rich-text block content. */
const ALLOWED_TAGS = new Set([
  "p", "br", "b", "strong", "i", "em", "u", "s", "ul", "ol", "li",
  "a", "h1", "h2", "h3", "blockquote", "span",
]);

export function sanitizeHtml(html) {
  if (!html) return "";
  let out = String(html).replace(/<(script|style|iframe|object|embed|svg)[\s\S]*?(<\/\1>|$)/gi, "");
  out = out.replace(/<\/?\s*([a-zA-Z0-9]+)([^>]*)>/g, (m, tag, attrs) => {
    const t = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(t)) return "";
    if (m.startsWith("</")) return `</${t}>`;
    if (t === "a") {
      const hrefMatch = /href\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs || "");
      const href = hrefMatch ? (hrefMatch[2] ?? hrefMatch[3] ?? "") : "";
      const safe = /^(https?:|mailto:)/i.test(href) ? href : "#";
      return `<a href="${safe.replace(/"/g, "&quot;")}" rel="noopener noreferrer">`;
    }
    return `<${t}>`;
  });
  return out;
}

/** Sanitize any rich-text (html) fields inside a block list before persisting. */
function sanitizeBlocks(blocks) {
  return (blocks || []).map((b) => {
    if (b && b.content && typeof b.content.html === "string") {
      return { ...b, content: { ...b.content, html: sanitizeHtml(b.content.html) } };
    }
    return b;
  });
}

/** Minimum age of the newest revision before another autosnapshot is taken. */
const AUTO_SNAPSHOT_MINUTES = 10;

function snapshotProposal(db, row, { label = "Autosave", user = null } = {}) {
  db.prepare(
    `INSERT INTO proposal_revisions (proposal_id, title, label, author_id, author_name, payload_json)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(row.id, row.title, label, user?.id || null, user?.name || null, row.payload_json || "{}");
  // Keep history bounded per proposal.
  db.prepare(
    `DELETE FROM proposal_revisions WHERE proposal_id = ? AND id NOT IN (
       SELECT id FROM proposal_revisions WHERE proposal_id = ? ORDER BY created_at DESC, id DESC LIMIT 40
     )`
  ).run(row.id, row.id);
}

function maybeAutoSnapshot(db, row, user) {
  const latest = db.prepare(
    "SELECT created_at FROM proposal_revisions WHERE proposal_id = ? ORDER BY created_at DESC, id DESC LIMIT 1"
  ).get(row.id);
  if (
    !latest ||
    Date.now() - new Date(latest.created_at.replace(" ", "T") + "Z").getTime() >
      AUTO_SNAPSHOT_MINUTES * 60 * 1000
  ) {
    snapshotProposal(db, row, { label: "Autosave", user });
  }
}

function mapComment(c) {
  return {
    id: c.id,
    blockId: c.block_id,
    authorId: c.author_id,
    authorName: c.author_name,
    assigneeId: c.assignee_id,
    assigneeName: c.assignee_name,
    status: c.status,
    text: c.text,
    resolvedBy: c.resolved_by,
    resolvedAt: c.resolved_at,
    createdAt: c.created_at,
  };
}

function mapSuggestion(s) {
  return {
    id: s.id,
    blockId: s.block_id,
    kind: s.kind,
    base: s.base_json ? JSON.parse(s.base_json) : null,
    proposed: s.proposed_json ? JSON.parse(s.proposed_json) : null,
    authorId: s.author_id,
    authorName: s.author_name,
    status: s.status,
    reviewedBy: s.reviewed_by,
    reviewedAt: s.reviewed_at,
    createdAt: s.created_at,
  };
}

function clientScope(user, clientId) {
  if (user.role === "client") return user.clientId;
  if (!clientId || clientId === "all") return null;
  return clientId;
}

/** Payload keys that carry internal-only data and must never reach client-role users. */
const INTERNAL_PAYLOAD_KEYS = ["cleatus", "staffNotes", "internalNotes", "triage", "triageInternal"];

/** Remove internal-only keys from a proposal payload for client-facing responses. */
function stripInternalPayload(payload) {
  const clean = { ...payload };
  for (const key of INTERNAL_PAYLOAD_KEYS) delete clean[key];
  return clean;
}

function mapProposalRow(db, r, { stripInternal = false } = {}) {
  let payload = r.payload_json ? JSON.parse(r.payload_json) : {};
  if (stripInternal) payload = stripInternalPayload(payload);
  const client = db.prepare("SELECT name, type FROM clients WHERE id = ?").get(r.client_id);
  let ownerName = null;
  if (r.owner_id) {
    const u = db.prepare("SELECT name FROM users WHERE id = ?").get(r.owner_id);
    ownerName = u?.name || null;
  }
  return {
    id: r.id,
    title: r.title,
    clientId: r.client_id,
    clientName: client?.name || r.client_id,
    clientType: client?.type || "",
    status: r.status,
    triageState: r.triage_state || "inbox",
    amount: r.amount,
    source: r.source || "manual",
    sourceRef: r.source_ref || null,
    ownerId: r.owner_id || null,
    ownerName,
    templateId: r.template_id || null,
    dueAt: r.due_at || null,
    createdAt: r.created_at,
    ...payload,
  };
}

function getProposal(db, id) {
  return db.prepare("SELECT * FROM proposals WHERE id = ?").get(id);
}

function assertProposalAccess(req, row) {
  if (!row) return { ok: false, status: 404, error: "Not found" };
  if (req.user.role === "client") {
    if (row.client_id !== req.user.clientId) return { ok: false, status: 403, error: "Forbidden" };
    if (row.triage_state !== "sent" && row.triage_state !== "signed") {
      return { ok: false, status: 403, error: "Forbidden" };
    }
  }
  return { ok: true };
}

function matchClientByCleatusPayload(db, body) {
  const name = body.client?.name || body.clientName || body.accountName;
  const domain = body.client?.domain || body.clientDomain;
  if (name) {
    const byName = db.prepare("SELECT id FROM clients WHERE name = ? COLLATE NOCASE LIMIT 1").get(name);
    if (byName) return byName.id;
  }
  if (domain) {
    const target = String(domain).toLowerCase().replace(/^@/, "");
    const clients = db.prepare("SELECT id, payload_json FROM clients").all();
    for (const c of clients) {
      if (!c.payload_json) continue;
      try {
        const p = JSON.parse(c.payload_json);
        const contacts = p.contacts || [];
        if (contacts.some((ct) => emailMatchesDomain(ct.email, target))) {
          return c.id;
        }
      } catch { /* skip */ }
    }
  }
  return null;
}

/** True when the email's host equals `domain` or is a subdomain of it. */
function emailMatchesDomain(email, domain) {
  const at = String(email || "").toLowerCase().lastIndexOf("@");
  if (at < 0) return false;
  const host = String(email).toLowerCase().slice(at + 1);
  return host === domain || host.endsWith("." + domain);
}

export function registerProposalRoutes(app, db, auth) {
  const requireStaff = (req, res, next) => {
    if (req.user.role !== "staff" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };

  app.get("/api/proposals", auth, (req, res) => {
    const isClient = req.user.role === "client";
    const scope = clientScope(req.user, req.query.clientId);
    let sql = "SELECT * FROM proposals";
    const args = [];
    const clauses = [];
    if (scope) {
      clauses.push("client_id = ?");
      args.push(scope);
    }
    // Client-role users may only see proposals that have reached them, matching
    // assertProposalAccess's allowed states ('sent', 'signed').
    if (isClient) {
      clauses.push("triage_state IN ('sent', 'signed')");
      if (req.query.triage && (req.query.triage === "sent" || req.query.triage === "signed")) {
        clauses.pop();
        clauses.push("triage_state = ?");
        args.push(req.query.triage);
      }
    } else if (req.query.triage) {
      clauses.push("triage_state = ?");
      args.push(req.query.triage);
    }
    if (clauses.length) sql += " WHERE " + clauses.join(" AND ");
    sql += " ORDER BY created_at DESC LIMIT 500";
    res.json({
      items: db.prepare(sql).all(...args).map((r) => mapProposalRow(db, r, { stripInternal: isClient })),
    });
  });

  app.get("/api/proposals/templates", auth, (req, res) => {
    const clientType = req.query.type || "";
    const templates = clientType ? templatesForClientType(clientType) : PROPOSAL_TEMPLATES;
    res.json({
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        desc: t.desc,
        defaultBlocks: t.defaultBlocks,
        recommended: !clientType || t.clientTypes?.includes(clientType),
      })),
    });
  });

  app.get("/api/proposals/blocks", auth, (req, res) => {
    const clientType = req.query.type || "";
    const recommended = clientType ? recommendedBlocksForType(clientType) : [];
    const recommendedTypes = new Set(recommended.map((b) => b.type));

    const blocks = Object.entries(PROPOSAL_BLOCK_TYPES)
      .filter(([id]) => id !== "executive")
      .map(([id, meta]) => ({
        type: id,
        ...meta,
        recommended: recommendedTypes.has(id),
        defaultContent: defaultBlockContent(id),
      }));

    res.json({ blocks, recommended });
  });

  app.get("/api/proposals/:id", auth, (req, res) => {
    const row = getProposal(db, req.params.id);
    const access = assertProposalAccess(req, row);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    res.json(mapProposalRow(db, row, { stripInternal: req.user.role === "client" }));
  });

  app.post("/api/proposals", auth, requireStaff, (req, res) => {
    const {
      title,
      clientId,
      templateId,
      triageState = "building",
      amount,
      blocks,
      cleatus,
      dueAt,
    } = req.body || {};

    if (!title || !clientId) {
      return res.status(400).json({ error: "title and clientId are required" });
    }

    const client = db.prepare("SELECT name, type FROM clients WHERE id = ?").get(clientId);
    if (!client) return res.status(400).json({ error: "Unknown client" });

    const tplId = templateId || templatesForClientType(client.type)[0]?.id || "campaign";
    const blockList = blocks?.length
      ? blocks
      : blocksFromTemplate(tplId, { clientName: client.name });

    const payload = {
      blocks: sanitizeBlocks(blockList),
      templateId: tplId,
      engagementType: req.body.engagementType || "Retainer · monthly",
      ...(cleatus ? { cleatus } : {}),
    };

    const result = db.prepare(
      `INSERT INTO proposals (title, client_id, status, amount, payload_json, triage_state, source, source_ref, owner_id, template_id, due_at)
       VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      title,
      clientId,
      amount ?? null,
      JSON.stringify(payload),
      TRIAGE_STATES.includes(triageState) ? triageState : "building",
      req.body.source || "manual",
      req.body.sourceRef || null,
      req.user.id,
      tplId,
      dueAt || null,
    );

    res.status(201).json(mapProposalRow(db, getProposal(db, result.lastInsertRowid)));
  });

  app.patch("/api/proposals/:id", auth, requireStaff, (req, res) => {
    const row = getProposal(db, req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });

    const existing = row.payload_json ? JSON.parse(row.payload_json) : {};
    const patch = req.body || {};
    const payload = { ...existing };

    // Snapshot the pre-edit state periodically so History can restore it.
    if (patch.blocks || patch.title != null) maybeAutoSnapshot(db, row, req.user);

    if (patch.blocks) payload.blocks = sanitizeBlocks(patch.blocks);
    if (patch.templateId) payload.templateId = patch.templateId;
    if (patch.engagementType) payload.engagementType = patch.engagementType;
    if (patch.cleatus) payload.cleatus = { ...(existing.cleatus || {}), ...patch.cleatus };

    const sets = [];
    const args = [];
    if (patch.title != null) { sets.push("title = ?"); args.push(patch.title); }
    if (patch.amount != null) { sets.push("amount = ?"); args.push(patch.amount); }
    if (patch.triageState && TRIAGE_STATES.includes(patch.triageState)) {
      sets.push("triage_state = ?");
      args.push(patch.triageState);
    }
    if (patch.ownerId != null) { sets.push("owner_id = ?"); args.push(patch.ownerId || null); }
    if (patch.dueAt != null) { sets.push("due_at = ?"); args.push(patch.dueAt || null); }
    if (patch.status) { sets.push("status = ?"); args.push(patch.status); }
    sets.push("payload_json = ?");
    args.push(JSON.stringify(payload));
    args.push(row.id);

    db.prepare(`UPDATE proposals SET ${sets.join(", ")} WHERE id = ?`).run(...args);
    res.json(mapProposalRow(db, getProposal(db, row.id)));
  });

  app.delete("/api/proposals/:id", auth, requireStaff, (req, res) => {
    const row = getProposal(db, req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    db.prepare("DELETE FROM proposals WHERE id = ?").run(row.id);
    res.json({ ok: true });
  });

  app.get("/api/proposals/:id/notes", auth, requireStaff, (req, res) => {
    const row = getProposal(db, req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    const notes = db.prepare(
      "SELECT * FROM proposal_notes WHERE proposal_id = ? ORDER BY created_at ASC"
    ).all(row.id).map((n) => ({
      id: n.id,
      authorId: n.author_id,
      authorName: n.author_name,
      role: n.role,
      visibility: n.visibility,
      text: n.text,
      createdAt: n.created_at,
    }));
    res.json({ notes });
  });

  app.post("/api/proposals/:id/notes", auth, requireStaff, (req, res) => {
    const row = getProposal(db, req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    const { text, visibility = "staff" } = req.body || {};
    if (!text?.trim()) return res.status(400).json({ error: "text is required" });

    const result = db.prepare(
      `INSERT INTO proposal_notes (proposal_id, author_id, author_name, role, visibility, text)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(row.id, req.user.id, req.user.name, req.user.role, visibility, text.trim());

    const note = db.prepare("SELECT * FROM proposal_notes WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json({
      id: note.id,
      authorId: note.author_id,
      authorName: note.author_name,
      role: note.role,
      visibility: note.visibility,
      text: note.text,
      createdAt: note.created_at,
    });
  });

  // ---------- Comments (block-anchored, assignable) ----------

  app.get("/api/proposals/:id/comments", auth, requireStaff, (req, res) => {
    const row = getProposal(db, req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    const comments = db.prepare(
      "SELECT * FROM proposal_comments WHERE proposal_id = ? ORDER BY created_at ASC, id ASC"
    ).all(row.id).map(mapComment);
    res.json({ comments });
  });

  app.post("/api/proposals/:id/comments", auth, requireStaff, (req, res) => {
    const row = getProposal(db, req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    const { text, blockId, assigneeId } = req.body || {};
    if (!text?.trim()) return res.status(400).json({ error: "text is required" });

    let assigneeName = null;
    if (assigneeId) {
      const u = db.prepare("SELECT name FROM users WHERE id = ?").get(assigneeId);
      if (!u) return res.status(400).json({ error: "Unknown assignee" });
      assigneeName = u.name;
    }

    const result = db.prepare(
      `INSERT INTO proposal_comments (proposal_id, block_id, author_id, author_name, assignee_id, assignee_name, text)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(row.id, blockId || null, req.user.id, req.user.name, assigneeId || null, assigneeName, text.trim());

    const c = db.prepare("SELECT * FROM proposal_comments WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json(mapComment(c));
  });

  app.patch("/api/proposals/:id/comments/:commentId", auth, requireStaff, (req, res) => {
    const row = getProposal(db, req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    const c = db.prepare(
      "SELECT * FROM proposal_comments WHERE id = ? AND proposal_id = ?"
    ).get(req.params.commentId, row.id);
    if (!c) return res.status(404).json({ error: "Comment not found" });

    const { status, assigneeId, text } = req.body || {};
    const sets = [];
    const args = [];
    if (status === "resolved" && c.status !== "resolved") {
      sets.push("status = 'resolved'", "resolved_by = ?", "resolved_at = datetime('now')");
      args.push(req.user.name);
    } else if (status === "open" && c.status !== "open") {
      sets.push("status = 'open'", "resolved_by = NULL", "resolved_at = NULL");
    }
    if (assigneeId !== undefined) {
      let assigneeName = null;
      if (assigneeId) {
        const u = db.prepare("SELECT name FROM users WHERE id = ?").get(assigneeId);
        if (!u) return res.status(400).json({ error: "Unknown assignee" });
        assigneeName = u.name;
      }
      sets.push("assignee_id = ?", "assignee_name = ?");
      args.push(assigneeId || null, assigneeName);
    }
    if (text?.trim() && c.author_id === req.user.id) {
      sets.push("text = ?");
      args.push(text.trim());
    }
    if (!sets.length) return res.json(mapComment(c));
    args.push(c.id);
    db.prepare(`UPDATE proposal_comments SET ${sets.join(", ")} WHERE id = ?`).run(...args);
    res.json(mapComment(db.prepare("SELECT * FROM proposal_comments WHERE id = ?").get(c.id)));
  });

  app.delete("/api/proposals/:id/comments/:commentId", auth, requireStaff, (req, res) => {
    const row = getProposal(db, req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    const c = db.prepare(
      "SELECT * FROM proposal_comments WHERE id = ? AND proposal_id = ?"
    ).get(req.params.commentId, row.id);
    if (!c) return res.status(404).json({ error: "Comment not found" });
    if (c.author_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Only the author or an admin can delete a comment" });
    }
    db.prepare("DELETE FROM proposal_comments WHERE id = ?").run(c.id);
    res.json({ ok: true });
  });

  // ---------- Revisions (version history) ----------

  app.get("/api/proposals/:id/revisions", auth, requireStaff, (req, res) => {
    const row = getProposal(db, req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    const revisions = db.prepare(
      "SELECT id, title, label, author_name, created_at, payload_json FROM proposal_revisions WHERE proposal_id = ? ORDER BY created_at DESC, id DESC"
    ).all(row.id).map((r) => {
      let blockCount = 0;
      try { blockCount = (JSON.parse(r.payload_json).blocks || []).length; } catch { /* ignore */ }
      return {
        id: r.id,
        title: r.title,
        label: r.label,
        authorName: r.author_name,
        createdAt: r.created_at,
        blockCount,
      };
    });
    res.json({ revisions });
  });

  app.post("/api/proposals/:id/revisions", auth, requireStaff, (req, res) => {
    const row = getProposal(db, req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    snapshotProposal(db, row, {
      label: (req.body?.label || "Manual snapshot").slice(0, 120),
      user: req.user,
    });
    res.status(201).json({ ok: true });
  });

  app.post("/api/proposals/:id/revisions/:revId/restore", auth, requireStaff, (req, res) => {
    const row = getProposal(db, req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    const rev = db.prepare(
      "SELECT * FROM proposal_revisions WHERE id = ? AND proposal_id = ?"
    ).get(req.params.revId, row.id);
    if (!rev) return res.status(404).json({ error: "Revision not found" });

    // Preserve the current state so the restore itself is reversible.
    snapshotProposal(db, row, { label: "Before restore", user: req.user });
    db.prepare("UPDATE proposals SET title = ?, payload_json = ? WHERE id = ?")
      .run(rev.title || row.title, rev.payload_json, row.id);
    res.json(mapProposalRow(db, getProposal(db, row.id)));
  });

  // ---------- Suggestions (review-edits mode) ----------

  app.get("/api/proposals/:id/suggestions", auth, requireStaff, (req, res) => {
    const row = getProposal(db, req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    const status = req.query.status || "pending";
    const suggestions = db.prepare(
      "SELECT * FROM proposal_suggestions WHERE proposal_id = ? AND status = ? ORDER BY created_at ASC, id ASC"
    ).all(row.id, status).map(mapSuggestion);
    res.json({ suggestions });
  });

  app.post("/api/proposals/:id/suggestions", auth, requireStaff, (req, res) => {
    const row = getProposal(db, req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    const { blockId, kind = "edit", base, proposed } = req.body || {};
    if (!blockId) return res.status(400).json({ error: "blockId is required" });
    if (!["edit", "remove", "add"].includes(kind)) {
      return res.status(400).json({ error: "kind must be edit, remove, or add" });
    }

    // A same-author pending edit on the same block collapses into one suggestion.
    if (kind === "edit") {
      const existing = db.prepare(
        `SELECT id FROM proposal_suggestions
         WHERE proposal_id = ? AND block_id = ? AND kind = 'edit' AND status = 'pending' AND author_id = ?`
      ).get(row.id, blockId, req.user.id);
      if (existing) {
        db.prepare("UPDATE proposal_suggestions SET proposed_json = ?, created_at = datetime('now') WHERE id = ?")
          .run(JSON.stringify(proposed ?? null), existing.id);
        const s = db.prepare("SELECT * FROM proposal_suggestions WHERE id = ?").get(existing.id);
        return res.json(mapSuggestion(s));
      }
    }

    const result = db.prepare(
      `INSERT INTO proposal_suggestions (proposal_id, block_id, kind, base_json, proposed_json, author_id, author_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      row.id,
      blockId,
      kind,
      base !== undefined ? JSON.stringify(base) : null,
      proposed !== undefined ? JSON.stringify(proposed) : null,
      req.user.id,
      req.user.name,
    );
    const s = db.prepare("SELECT * FROM proposal_suggestions WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json(mapSuggestion(s));
  });

  app.post("/api/proposals/:id/suggestions/:sid/:action", auth, requireStaff, (req, res) => {
    if (req.params.action !== "accept" && req.params.action !== "reject") {
      return res.status(404).json({ error: "Unknown action" });
    }
    const row = getProposal(db, req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    const s = db.prepare(
      "SELECT * FROM proposal_suggestions WHERE id = ? AND proposal_id = ? AND status = 'pending'"
    ).get(req.params.sid, row.id);
    if (!s) return res.status(404).json({ error: "Pending suggestion not found" });

    const action = req.params.action;
    if (action === "accept") {
      const payload = row.payload_json ? JSON.parse(row.payload_json) : {};
      const blocks = payload.blocks || [];
      const proposed = s.proposed_json ? JSON.parse(s.proposed_json) : null;

      snapshotProposal(db, row, { label: `Before accepting suggestion by ${s.author_name}`, user: req.user });

      if (s.kind === "edit") {
        payload.blocks = sanitizeBlocks(
          blocks.map((b) => (b.id === s.block_id ? { ...b, content: proposed?.content ?? b.content } : b))
        );
      } else if (s.kind === "remove") {
        payload.blocks = blocks.filter((b) => b.id !== s.block_id);
      } else if (s.kind === "add" && proposed?.block) {
        const idx = Math.min(Math.max(proposed.index ?? blocks.length, 0), blocks.length);
        const next = [...blocks];
        next.splice(idx, 0, proposed.block);
        payload.blocks = sanitizeBlocks(next);
      }
      db.prepare("UPDATE proposals SET payload_json = ? WHERE id = ?")
        .run(JSON.stringify(payload), row.id);
    }

    db.prepare(
      `UPDATE proposal_suggestions SET status = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?`
    ).run(action === "accept" ? "accepted" : "rejected", req.user.name, s.id);

    res.json({ ok: true, proposal: mapProposalRow(db, getProposal(db, row.id)) });
  });
}

export function createProposalFromCleatus(db, body, { userId } = {}) {
  const externalId = body.id || body.opportunityId || body.opportunity_id;
  if (!externalId) throw new Error("Missing Cleatus opportunity id");

  const existing = db.prepare("SELECT id, proposal_id FROM cleatus_events WHERE external_id = ?").get(String(externalId));
  if (existing?.proposal_id) {
    return { proposalId: existing.proposal_id, duplicate: true };
  }

  const triageState = normalizeCleatusTriage(body.triage || body.triageState || body.stage);
  const clientId = body.clientId || matchClientByCleatusPayload(db, body) || body.client_id;
  if (!clientId) {
    const eventResult = db.prepare(
      `INSERT INTO cleatus_events (external_id, event_type, payload_json, processing_error)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(external_id) DO UPDATE SET payload_json = excluded.payload_json, processing_error = excluded.processing_error`
    ).run(
      String(externalId),
      body.event || body.eventType || "opportunity.updated",
      JSON.stringify(body),
      "no_matching_client",
    );
    return { eventId: eventResult.lastInsertRowid, unassigned: true };
  }

  const client = db.prepare("SELECT name, type FROM clients WHERE id = ?").get(clientId);
  const tplId = templatesForClientType(client?.type)[0]?.id || "publicaff";
  const title = body.title || body.opportunityTitle || `Proposal — ${client?.name || clientId}`;

  const cleatusMeta = {
    rfpUrl: body.rfp?.url || body.rfpUrl || null,
    rfpSummary: body.rfp?.summary || body.rfpSummary || body.rfpText || null,
    rfpDueDate: body.rfp?.dueDate || body.rfpDueDate || body.dueDate || null,
    staffNotes: body.staffNotes || body.staff_notes || body.notes || null,
    cleatusId: String(externalId),
    rawTriage: body.triage || body.triageState || body.stage,
  };

  const blockList = blocksFromTemplate(tplId, { clientName: client?.name });
  if (cleatusMeta.rfpSummary) {
    const sitIdx = blockList.findIndex((b) => b.type === "situation" || b.type === "executive");
    if (sitIdx >= 0) {
      blockList[sitIdx].content = {
        ...blockList[sitIdx].content,
        body: cleatusMeta.rfpSummary,
        title: blockList[sitIdx].content?.title || "RFP summary",
      };
    }
  }

  const payload = {
    blocks: blockList,
    templateId: tplId,
    cleatus: cleatusMeta,
    engagementType: body.engagementType || "Project · one-time",
  };

  const proposalResult = db.prepare(
    `INSERT INTO proposals (title, client_id, status, amount, payload_json, triage_state, source, source_ref, owner_id, template_id, due_at)
     VALUES (?, ?, 'draft', ?, ?, ?, 'cleatus', ?, ?, ?, ?)`
  ).run(
    title,
    clientId,
    body.amount ?? body.value ?? null,
    JSON.stringify(payload),
    triageState,
    String(externalId),
    userId || null,
    tplId,
    cleatusMeta.rfpDueDate || null,
  );

  const proposalId = proposalResult.lastInsertRowid;

  if (cleatusMeta.staffNotes) {
    db.prepare(
      `INSERT INTO proposal_notes (proposal_id, author_id, author_name, role, visibility, text)
       VALUES (?, ?, ?, 'staff', 'staff', ?)`
    ).run(proposalId, userId || "cleatus", "Cleatus", cleatusMeta.staffNotes);
  }

  db.prepare(
    `INSERT INTO cleatus_events (external_id, event_type, payload_json, processed_at, proposal_id)
     VALUES (?, ?, ?, datetime('now'), ?)
     ON CONFLICT(external_id) DO UPDATE SET
       payload_json = excluded.payload_json,
       processed_at = excluded.processed_at,
       proposal_id = excluded.proposal_id,
       processing_error = NULL`
  ).run(
    String(externalId),
    body.event || body.eventType || "opportunity.updated",
    JSON.stringify(body),
    proposalId,
  );

  return { proposalId, triageState };
}
