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

function clientScope(user, clientId) {
  if (user.role === "client") return user.clientId;
  if (!clientId || clientId === "all") return null;
  return clientId;
}

function mapProposalRow(db, r) {
  const payload = r.payload_json ? JSON.parse(r.payload_json) : {};
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
    const clients = db.prepare("SELECT id, payload_json FROM clients").all();
    for (const c of clients) {
      if (!c.payload_json) continue;
      try {
        const p = JSON.parse(c.payload_json);
        const contacts = p.contacts || [];
        if (contacts.some((ct) => String(ct.email || "").toLowerCase().includes(domain.toLowerCase()))) {
          return c.id;
        }
      } catch { /* skip */ }
    }
  }
  return null;
}

export function registerProposalRoutes(app, db, auth) {
  const requireStaff = (req, res, next) => {
    if (req.user.role !== "staff" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };

  app.get("/api/proposals", auth, (req, res) => {
    const scope = clientScope(req.user, req.query.clientId);
    let sql = "SELECT * FROM proposals";
    const args = [];
    const clauses = [];
    if (scope) {
      clauses.push("client_id = ?");
      args.push(scope);
    }
    if (req.query.triage) {
      clauses.push("triage_state = ?");
      args.push(req.query.triage);
    }
    if (clauses.length) sql += " WHERE " + clauses.join(" AND ");
    sql += " ORDER BY created_at DESC LIMIT 500";
    res.json({ items: db.prepare(sql).all(...args).map((r) => mapProposalRow(db, r)) });
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
    res.json(mapProposalRow(db, row));
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
      blocks: blockList,
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

    if (patch.blocks) payload.blocks = patch.blocks;
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
}

export function createProposalFromCleatus(db, body, { userId } = {}) {
  const externalId = body.id || body.opportunityId || body.opportunity_id;
  if (!externalId) throw new Error("Missing Cleatus opportunity id");

  const existing = db.prepare("SELECT id FROM cleatus_events WHERE external_id = ?").get(String(externalId));
  if (existing?.id) {
    const linked = db.prepare("SELECT proposal_id FROM cleatus_events WHERE external_id = ?").get(String(externalId));
    if (linked?.proposal_id) {
      return { proposalId: linked.proposal_id, duplicate: true };
    }
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
