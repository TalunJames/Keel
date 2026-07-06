import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import {
  ACTIVE_STATUSES,
  CLIENT_VISIBLE_STATUSES,
  DESIGN_STATUSES,
  DESIGNER_SETTABLE_STATUSES,
  POOL_STATUSES,
  HIGH_PRIORITIES,
  isDesigner,
  isStaffOrAdmin,
} from "./design-status.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const UPLOAD_DIR = process.env.DESIGN_UPLOAD_DIR
  || path.join(__dirname, "..", "data", "uploads", "design");

const UPLOAD_MIME_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

const UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
import {
  sendDesignMail,
  notifyDesigners,
  notifyClientUsers,
} from "./mail.js";
import { provisionDesignIntegrations, queueDesignIntegrationEvent } from "./design-integrations.js";

// Fire-and-forget a single notification email so a hung SMTP server can't stall
// the HTTP response. sendDesignMail records success/failure in
// design_notification_log internally; this only guards the async boundary.
function queueDesignMail(db, opts) {
  Promise.resolve()
    .then(() => sendDesignMail(db, opts))
    .catch((e) => console.error(`[mail] notify failed ${opts?.eventType}:`, e?.message || e));
}

function mapRequestRow(db, r, cache) {
  const payload = r.payload_json ? JSON.parse(r.payload_json) : {};
  let assigneeName = r.assignee || null;
  let assigneeEmail = null;
  if (r.assignee_id) {
    let u;
    if (cache?.users.has(r.assignee_id)) {
      u = cache.users.get(r.assignee_id);
    } else {
      u = db.prepare("SELECT name, email FROM users WHERE id = ?").get(r.assignee_id);
      cache?.users.set(r.assignee_id, u);
    }
    if (u) {
      assigneeName = u.name;
      assigneeEmail = u.email;
    }
  }
  let client;
  if (cache?.clients.has(r.client_id)) {
    client = cache.clients.get(r.client_id);
  } else {
    client = db.prepare("SELECT name FROM clients WHERE id = ?").get(r.client_id);
    cache?.clients.set(r.client_id, client);
  }
  return {
    id: r.id,
    title: r.title,
    clientId: r.client_id,
    clientName: client?.name || r.client_id,
    status: r.status,
    priority: r.priority,
    due: r.due,
    assigneeId: r.assignee_id || null,
    assigneeName,
    assigneeEmail,
    submittedBy: r.submitted_by,
    createdAt: r.created_at,
    ...payload,
  };
}

function getRequest(db, id) {
  return db.prepare("SELECT * FROM design_requests WHERE id = ?").get(id);
}

// Proof URLs must point at app-served, same-origin paths. This blocks
// `javascript:`, `data:`, protocol-relative (`//host`) and external URLs that
// would otherwise be stored and echoed to client users.
function isInternalProofUrl(url) {
  return /^\/api\/design\/files\/[A-Za-z0-9._-]+$/.test(url)
    || /^\/periscope\/[A-Za-z0-9._/?=&%-]*$/.test(url);
}

function assertRequestAccess(req, row) {
  if (!row) return { ok: false, status: 404, error: "Not found" };
  if (req.user.role === "client") {
    if (row.client_id !== req.user.clientId) return { ok: false, status: 403, error: "Forbidden" };
    if (!CLIENT_VISIBLE_STATUSES.includes(row.status) && row.status !== "Closed") {
      return { ok: false, status: 403, error: "Forbidden" };
    }
  }
  return { ok: true };
}

function clientScope(user, clientId) {
  if (user.role === "client") return user.clientId;
  if (!clientId || clientId === "all") return null;
  return clientId;
}

function activeDesignCountSql(scope) {
  const placeholders = ACTIVE_STATUSES.map(() => "?").join(", ");
  let sql = `SELECT COUNT(*) AS n FROM design_requests WHERE status IN (${placeholders})`;
  const args = [...ACTIVE_STATUSES];
  if (scope) {
    sql += " AND client_id = ?";
    args.push(scope);
  }
  return { sql, args };
}

function tryMatchUserByName(db, name) {
  if (!name) return null;
  const user = db.prepare(
    `SELECT id, name, email FROM users WHERE name = ? AND role IN ('staff', 'admin') LIMIT 1`
  ).get(name);
  return user || null;
}

function resolveReviewerIds(db, clientPayload, explicitIds) {
  const ids = new Set((explicitIds || []).filter(Boolean));
  const leadName = clientPayload?.team?.lead;
  const lead = tryMatchUserByName(db, leadName);
  if (lead) ids.add(lead.id);
  return [...ids];
}

function loadApprovals(db, requestId) {
  return db.prepare(
    "SELECT user_id AS userId, user_name AS userName, note, created_at AS createdAt FROM design_approvals WHERE request_id = ? ORDER BY created_at ASC"
  ).all(requestId);
}

function isReviewer(db, row, userId) {
  const payload = row.payload_json ? JSON.parse(row.payload_json) : {};
  return (payload.reviewerIds || []).includes(userId);
}

function canProofOrClose(user, row, db) {
  if (isStaffOrAdmin(user)) return true;
  return isReviewer(db, row, user.id);
}

function tryMatchLeadDesigner(db, clientId) {
  const row = db.prepare("SELECT payload_json FROM clients WHERE id = ?").get(clientId);
  if (!row?.payload_json) return null;
  try {
    const payload = JSON.parse(row.payload_json);
    const name = payload?.team?.designer;
    if (!name) return null;
    const user = db.prepare(
      `SELECT id FROM users WHERE name = ? AND role IN ('staff', 'admin') LIMIT 1`
    ).get(name);
    return user?.id || null;
  } catch {
    return null;
  }
}

export function registerDesignRoutes(app, db, auth) {
  const requireStaff = (req, res, next) => {
    if (!isStaffOrAdmin(req.user)) return res.status(403).json({ error: "Forbidden" });
    next();
  };

  const requireDesignerCapable = (req, res, next) => {
    if (!isStaffOrAdmin(req.user) && !isDesigner(req.user)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };

  app.get("/api/design/requests", auth, (req, res) => {
    const scope = clientScope(req.user, req.query.clientId);
    let sql = "SELECT * FROM design_requests";
    const args = [];
    const clauses = [];
    if (scope) {
      clauses.push("client_id = ?");
      args.push(scope);
    }
    if (req.user.role === "client") {
      clauses.push(`status IN (${CLIENT_VISIBLE_STATUSES.map(() => "?").join(", ")})`);
      args.push(...CLIENT_VISIBLE_STATUSES);
    }
    if (clauses.length) sql += " WHERE " + clauses.join(" AND ");
    sql += " ORDER BY created_at DESC LIMIT 500";
    const cache = { users: new Map(), clients: new Map() };
    res.json({ items: db.prepare(sql).all(...args).map((r) => mapRequestRow(db, r, cache)) });
  });

  app.get("/api/design/stats", auth, (req, res) => {
    const scope = clientScope(req.user, req.query.clientId);
    const base = scope ? " AND client_id = ?" : "";
    const baseArgs = scope ? [scope] : [];
    const count = (status) => {
      if (Array.isArray(status)) {
        const ph = status.map(() => "?").join(", ");
        return db.prepare(
          `SELECT COUNT(*) AS n FROM design_requests WHERE status IN (${ph})${base}`
        ).get(...status, ...baseArgs)?.n || 0;
      }
      return db.prepare(
        `SELECT COUNT(*) AS n FROM design_requests WHERE status = ?${base}`
      ).get(status, ...baseArgs)?.n || 0;
    };
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const approvedWeek = db.prepare(
      `SELECT COUNT(*) AS n FROM design_requests WHERE status = 'Closed' AND created_at >= ?${base}`
    ).get(weekAgo.toISOString().slice(0, 10), ...baseArgs)?.n || 0;

    res.json({
      intake: count("Submitted"),
      briefReview: count("Assigned"),
      inDesign: count("In Design"),
      proofing: count("Final Proof"),
      approvedWeek: approvedWeek,
      pool: count(POOL_STATUSES),
    });
  });

  app.get("/api/design/designers", auth, requireStaff, (_req, res) => {
    let designers = db.prepare(
      `SELECT id, name, email, team, title FROM users
       WHERE is_designer = 1 AND role IN ('staff', 'admin')
       ORDER BY name`
    ).all();
    if (!designers.length) {
      designers = db.prepare(
        `SELECT id, name, email, team, title FROM users
         WHERE role IN ('staff', 'admin') ORDER BY name`
      ).all();
    }
    res.json({ designers });
  });

  app.get("/api/design/my-queue", auth, requireDesignerCapable, (req, res) => {
    if (!isDesigner(req.user)) return res.json({ items: [] });
    const rows = db.prepare(
      `SELECT * FROM design_requests
       WHERE assignee_id = ? AND status != 'Closed' AND status != 'draft'
       ORDER BY created_at DESC LIMIT 200`
    ).all(req.user.id);
    const cache = { users: new Map(), clients: new Map() };
    const items = rows.map((r) => mapRequestRow(db, r, cache));
    items.sort((a, b) => {
      const pr = { Urgent: 0, Important: 1, Normal: 2, Backburner: 3 };
      const pa = pr[a.priority] ?? 3;
      const pb = pr[b.priority] ?? 3;
      if (pa !== pb) return pa - pb;
      if (a.due && b.due) return a.due.localeCompare(b.due);
      return 0;
    });
    res.json({ items });
  });

  app.get("/api/design/pool", auth, requireDesignerCapable, (req, res) => {
    const scope = clientScope(req.user, req.query.clientId);
    const ph = POOL_STATUSES.map(() => "?").join(", ");
    let sql = `SELECT * FROM design_requests WHERE assignee_id IS NULL AND status IN (${ph})`;
    const args = [...POOL_STATUSES];
    if (scope) {
      sql += " AND client_id = ?";
      args.push(scope);
    }
    sql += " ORDER BY created_at DESC LIMIT 100";
    const cache = { users: new Map(), clients: new Map() };
    res.json({ items: db.prepare(sql).all(...args).map((r) => mapRequestRow(db, r, cache)) });
  });

  app.get("/api/design/desk-stats", auth, requireDesignerCapable, (req, res) => {
    if (!isDesigner(req.user)) return res.json({ dueToday: 0, overdue: 0, inDesign: 0, awaitingUpload: 0, inProofing: 0 });
    const uid = req.user.id;
    const today = new Date().toISOString().slice(0, 10);
    const row = (sql, ...a) => db.prepare(sql).get(...a)?.n || 0;
    res.json({
      dueToday: row(
        `SELECT COUNT(*) AS n FROM design_requests WHERE assignee_id = ? AND due = ? AND status != 'Closed'`,
        uid, today
      ),
      overdue: row(
        `SELECT COUNT(*) AS n FROM design_requests WHERE assignee_id = ? AND due < ? AND status NOT IN ('Closed', 'draft')`,
        uid, today
      ),
      inDesign: row(
        `SELECT COUNT(*) AS n FROM design_requests WHERE assignee_id = ? AND status = 'In Design'`,
        uid
      ),
      awaitingUpload: row(
        `SELECT COUNT(*) AS n FROM design_requests WHERE assignee_id = ? AND status IN ('Assigned', 'In Design')`,
        uid
      ),
      inProofing: row(
        `SELECT COUNT(*) AS n FROM design_requests WHERE assignee_id = ? AND status IN ('Final Proof', 'Revisions')`,
        uid
      ),
    });
  });

  app.get("/api/design/requests/:id", auth, (req, res) => {
    const row = getRequest(db, req.params.id);
    const access = assertRequestAccess(req, row);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const proofs = db.prepare(
      "SELECT * FROM design_proofs WHERE request_id = ? ORDER BY id ASC"
    ).all(row.id).map((p) => ({
      id: p.id,
      version: p.version,
      label: p.label,
      fileUrl: p.file_url,
      mimeType: p.mime_type,
      uploadedBy: p.uploaded_by,
      periscopeShareId: p.periscope_share_id || null,
      createdAt: p.created_at,
    }));
    const comments = db.prepare(
      "SELECT * FROM design_comments WHERE request_id = ? ORDER BY created_at ASC"
    ).all(row.id).map((c) => ({
      id: c.id,
      proofId: c.proof_id,
      authorId: c.author_id,
      authorName: c.author_name,
      role: c.role,
      text: c.text,
      marker: c.marker_x != null ? { x: c.marker_x, y: c.marker_y } : null,
      createdAt: c.created_at,
    }));
    const payload = row.payload_json ? JSON.parse(row.payload_json) : {};
    const reviewerIds = payload.reviewerIds || [];
    const reviewers = reviewerIds.map((id) => {
      const u = db.prepare("SELECT id, name, email FROM users WHERE id = ?").get(id);
      return u ? { id: u.id, name: u.name, email: u.email } : { id, name: id };
    });
    const approvals = loadApprovals(db, row.id);
    res.json({
      request: mapRequestRow(db, row),
      proofs,
      comments,
      reviewers,
      approvals,
    });
  });

  app.post("/api/design/requests", auth, requireStaff, async (req, res) => {
    const {
      title, clientId, priority, due, assigneeId, draft,
      assetType, audience, cta, spec, attachments, reviewerIds,
    } = req.body || {};
    if (!title?.trim() || !clientId) {
      return res.status(400).json({ error: "title and clientId required" });
    }
    const client = db.prepare("SELECT id, name, payload_json FROM clients WHERE id = ?").get(clientId);
    if (!client) return res.status(400).json({ error: "Invalid client" });
    const clientPayload = client.payload_json ? JSON.parse(client.payload_json) : {};

    let resolvedAssignee = assigneeId || tryMatchLeadDesigner(db, clientId);
    const status = draft ? "draft" : (resolvedAssignee ? "Assigned" : "Submitted");
    const resolvedReviewers = resolveReviewerIds(db, clientPayload, reviewerIds);
    const payload = {
      assetType: assetType || "",
      audience: audience || "",
      cta: cta || "",
      spec: spec || "",
      attachments: attachments || [],
      reviewerIds: resolvedReviewers,
      draft: !!draft,
    };

    const result = db.prepare(
      `INSERT INTO design_requests (title, client_id, status, priority, due, assignee_id, submitted_by, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      title.trim(),
      clientId,
      status,
      priority || "Normal",
      due || null,
      resolvedAssignee || null,
      req.user.id,
      JSON.stringify(payload),
    );

    const requestId = result.lastInsertRowid;

    if (!draft) {
      try {
        const provisioned = await provisionDesignIntegrations({
          requestId,
          clientId,
          clientName: client.name,
          clientDriveFolderUrl: clientPayload.driveFolderUrl,
          title: title.trim(),
          assetType: payload.assetType,
          audience: payload.audience,
          cta: payload.cta,
          spec: payload.spec,
          priority: priority || "Normal",
          due: due || null,
        });
        payload.integrations = provisioned.integrations;
        if (provisioned.driveFolderUrl) {
          payload.driveFolderUrl = provisioned.driveFolderUrl;
          payload.driveFolderId = provisioned.driveFolderId;
          payload.briefDocUrl = provisioned.briefDocUrl;
        }
        db.prepare("UPDATE design_requests SET payload_json = ? WHERE id = ?").run(
          JSON.stringify(payload),
          requestId
        );
      } catch (e) {
        console.error(`[integrations] DR-${requestId}:`, e?.message || e);
      }
    }

    db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
      req.user.email,
      `Created design request ${title.trim()} (#${requestId})`,
      "Design"
    );

    if (!draft && resolvedAssignee) {
      const assignee = db.prepare("SELECT email, name FROM users WHERE id = ?").get(resolvedAssignee);
      if (assignee?.email) {
        queueDesignMail(db, {
          requestId,
          eventType: "assigned",
          to: assignee.email,
          data: { title: title.trim(), clientName: client.name, due: due || "" },
        });
      }
    } else if (!draft && !resolvedAssignee && HIGH_PRIORITIES.includes(priority)) {
      notifyDesigners(db, {
        requestId,
        eventType: "rush_pool",
        data: { title: title.trim(), priority, clientName: client.name },
      });
    }

    res.status(201).json({
      id: requestId,
      driveFolderUrl: payload.driveFolderUrl || null,
      briefDocUrl: payload.briefDocUrl || null,
    });
  });

  app.patch("/api/design/requests/:id", auth, async (req, res) => {
    const row = getRequest(db, req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });

    const staff = isStaffOrAdmin(req.user);
    const designer = isDesigner(req.user);
    const isAssignee = row.assignee_id === req.user.id;

    if (req.user.role === "client") {
      if (row.client_id !== req.user.clientId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (!CLIENT_VISIBLE_STATUSES.includes(row.status)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { action } = req.body || {};
      if (action === "approve") {
        db.prepare("UPDATE design_requests SET status = 'Closed' WHERE id = ?").run(row.id);
        db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
          req.user.email, `Client approved design #${row.id}`, "Design"
        );
        return res.json({ ok: true });
      }
      if (action === "revisions") {
        db.prepare("UPDATE design_requests SET status = 'Revisions' WHERE id = ?").run(row.id);
        if (row.assignee_id) {
          const assignee = db.prepare("SELECT email FROM users WHERE id = ?").get(row.assignee_id);
          if (assignee?.email) {
            queueDesignMail(db, {
              requestId: row.id,
              eventType: "comment",
              to: assignee.email,
              data: { title: row.title, authorName: req.user.name, clientName: "", excerpt: "Revisions requested" },
            });
          }
        }
        return res.json({ ok: true });
      }
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!staff && !(designer && isAssignee) && !canProofOrClose(req.user, row, db)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const {
      title, status, priority, due, assigneeId,
      assetType, audience, cta, spec, action, reviewerIds, approvalNote,
    } = req.body || {};

    // Consultant / reviewer actions (Final Proof stage)
    if (action === "approve_proof") {
      if (!canProofOrClose(req.user, row, db)) {
        return res.status(403).json({ error: "Not assigned as a reviewer" });
      }
      db.prepare(
        `INSERT INTO design_approvals (request_id, user_id, user_name, note)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(request_id, user_id) DO UPDATE SET note = excluded.note, created_at = datetime('now')`
      ).run(row.id, req.user.id, req.user.name, (approvalNote || "").trim() || null);
      db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
        req.user.email, `Proofed design #${row.id}`, "Design"
      );
      return res.json({ ok: true });
    }

    if (action === "close") {
      if (!canProofOrClose(req.user, row, db)) {
        return res.status(403).json({ error: "Only consultants can close a request" });
      }
      db.prepare("UPDATE design_requests SET status = 'Closed' WHERE id = ?").run(row.id);
      queueDesignIntegrationEvent("design.closed", { requestId: row.id, clientId: row.client_id, title: row.title });
      db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
        req.user.email, `Closed design request #${row.id}`, "Design"
      );
      return res.json({ ok: true });
    }

    if (action === "send_to_design") {
      if (!canProofOrClose(req.user, row, db) && !(designer && isAssignee)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      db.prepare("UPDATE design_requests SET status = 'Revisions' WHERE id = ?").run(row.id);
      if (row.assignee_id) {
        const assignee = db.prepare("SELECT email FROM users WHERE id = ?").get(row.assignee_id);
        if (assignee?.email) {
          queueDesignMail(db, {
            requestId: row.id,
            eventType: "comment",
            to: assignee.email,
            data: { title: row.title, authorName: req.user.name, clientName: "", excerpt: "Sent back to design" },
          });
        }
      }
      return res.json({ ok: true });
    }

    if (!staff && !(designer && isAssignee)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!staff) {
      const allowed = ["status", "action"];
      const keys = Object.keys(req.body || {}).filter((k) => req.body[k] !== undefined);
      if (keys.some((k) => !allowed.includes(k))) {
        return res.status(403).json({ error: "Designers cannot edit intake fields" });
      }
    }

    const updates = [];
    const args = [];

    if (staff && title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ error: "title must be a non-empty string" });
      }
      updates.push("title = ?");
      args.push(title.trim());
    }
    if (status !== undefined) {
      if (!DESIGN_STATUSES.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      // Designer-assignees may only move a request through the safe workflow
      // subset; only staff/admins can set 'Approved', 'draft', etc.
      if (!staff && !DESIGNER_SETTABLE_STATUSES.includes(status)) {
        return res.status(403).json({ error: "Designers cannot set this status" });
      }
      updates.push("status = ?");
      args.push(status);
    }
    if (staff && priority !== undefined) { updates.push("priority = ?"); args.push(priority); }
    if (staff && due !== undefined) { updates.push("due = ?"); args.push(due || null); }
    if (staff && assigneeId !== undefined) {
      updates.push("assignee_id = ?");
      args.push(assigneeId || null);
      if (assigneeId && row.status === "Submitted") {
        updates.push("status = ?");
        args.push("Assigned");
      }
      if (!assigneeId && row.status === "Assigned") {
        updates.push("status = ?");
        args.push("Submitted");
      }
    }

    let payloadDirty = false;
    let payload = row.payload_json ? JSON.parse(row.payload_json) : {};

    if (staff && reviewerIds !== undefined) {
      payload.reviewerIds = Array.isArray(reviewerIds) ? reviewerIds.filter(Boolean) : [];
      payloadDirty = true;
    }

    if (assetType !== undefined || audience !== undefined || cta !== undefined || spec !== undefined) {
      if (!staff) return res.status(403).json({ error: "Forbidden" });
      if (assetType !== undefined) payload.assetType = assetType;
      if (audience !== undefined) payload.audience = audience;
      if (cta !== undefined) payload.cta = cta;
      if (spec !== undefined) payload.spec = spec;
      payloadDirty = true;
    }

    if (payloadDirty) {
      updates.push("payload_json = ?");
      args.push(JSON.stringify(payload));
    }

    if (action === "ready_for_review") {
      updates.push("status = ?");
      args.push("Final Proof");
    }

    if (!updates.length) return res.status(400).json({ error: "No changes" });

    args.push(row.id);
    db.prepare(`UPDATE design_requests SET ${updates.join(", ")} WHERE id = ?`).run(...args);

    if (staff && assigneeId !== undefined && assigneeId && assigneeId !== row.assignee_id) {
      const assignee = db.prepare("SELECT email FROM users WHERE id = ?").get(assigneeId);
      const client = db.prepare("SELECT name FROM clients WHERE id = ?").get(row.client_id);
      if (assignee?.email) {
        queueDesignMail(db, {
          requestId: row.id,
          eventType: "assigned",
          to: assignee.email,
          data: { title: row.title, clientName: client?.name || "", due: row.due || "" },
        });
      }
    }

    if (action === "ready_for_review") {
      const client = db.prepare("SELECT name FROM clients WHERE id = ?").get(row.client_id);
      notifyClientUsers(db, row.client_id, {
        requestId: row.id,
        eventType: "proof_ready",
        data: { title: row.title, clientName: client?.name || "" },
      });
    }

    db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
      req.user.email,
      `Updated design request #${row.id}`,
      "Design"
    );
    res.json({ ok: true });
  });

  app.post("/api/design/requests/:id/claim", auth, async (req, res) => {
    if (!isDesigner(req.user)) return res.status(403).json({ error: "Designers only" });
    const row = getRequest(db, req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    if (row.assignee_id) return res.status(409).json({ error: "Already assigned" });
    if (!POOL_STATUSES.includes(row.status)) {
      return res.status(400).json({ error: "Not available to claim" });
    }
    const newStatus = row.status === "Submitted" ? "Assigned" : row.status;
    db.prepare("UPDATE design_requests SET assignee_id = ?, status = ? WHERE id = ?").run(
      req.user.id, newStatus, row.id
    );
    db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
      req.user.email,
      `Claimed design request #${row.id}`,
      "Design"
    );
    queueDesignMail(db, {
      requestId: row.id,
      eventType: "claimed",
      to: req.user.email,
      data: { title: row.title },
    });
    res.json({ ok: true });
  });

  // Accepts a base64 data URL, stores the decoded file under UPLOAD_DIR, and
  // returns a portal-relative URL served by GET /api/design/files/:name below.
  app.post("/api/design/uploads", auth, requireDesignerCapable, (req, res) => {
    const { name, dataUrl } = req.body || {};
    if (typeof dataUrl !== "string") {
      return res.status(400).json({ error: "dataUrl required" });
    }
    const match = dataUrl.match(/^data:([\w.+/-]+);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return res.status(400).json({ error: "Malformed data URL" });
    const mimeType = match[1].toLowerCase();
    const ext = UPLOAD_MIME_EXT[mimeType];
    if (!ext) {
      return res.status(400).json({
        error: `Unsupported file type. Allowed: ${Object.keys(UPLOAD_MIME_EXT).join(", ")}`,
      });
    }
    const buf = Buffer.from(match[2], "base64");
    if (!buf.length) return res.status(400).json({ error: "Empty file" });
    if (buf.length > UPLOAD_MAX_BYTES) {
      return res.status(413).json({ error: "File exceeds 15 MB limit" });
    }
    const filename = `${crypto.randomBytes(10).toString("hex")}.${ext}`;
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), buf);
    res.status(201).json({
      url: `/api/design/files/${filename}`,
      name: typeof name === "string" && name.trim() ? name.trim().slice(0, 200) : filename,
      size: buf.length,
      mimeType,
    });
  });

  app.get("/api/design/files/:name", auth, (req, res) => {
    const { name } = req.params;
    if (!/^[a-f0-9]+\.[a-z0-9]+$/.test(name)) {
      return res.status(400).json({ error: "Bad filename" });
    }
    res.sendFile(name, { root: UPLOAD_DIR, maxAge: "365d", immutable: true }, (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: "Not found" });
    });
  });

  app.post("/api/design/requests/:id/proofs", auth, requireDesignerCapable, (req, res) => {
    const row = getRequest(db, req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    const staff = isStaffOrAdmin(req.user);
    const designer = isDesigner(req.user);
    if (!staff && !(designer && row.assignee_id === req.user.id)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { version, label, fileUrl, mimeType } = req.body || {};
    if (!version) return res.status(400).json({ error: "version required" });

    // Only accept internal, app-served URLs. Rejecting external/`javascript:`
    // URLs prevents stored-XSS/phishing when the value is echoed to clients.
    if (fileUrl !== undefined && fileUrl !== null && fileUrl !== "") {
      if (typeof fileUrl !== "string" || !isInternalProofUrl(fileUrl)) {
        return res.status(400).json({ error: "fileUrl must be an internal /api/design/files/ or /periscope/ path" });
      }
    }

    const result = db.prepare(
      `INSERT INTO design_proofs (request_id, version, label, file_url, mime_type, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(row.id, version, label || version, fileUrl || "", mimeType || "", req.user.id);

    if (row.status === "In Design") {
      db.prepare("UPDATE design_requests SET status = 'Final Proof' WHERE id = ?").run(row.id);
    }

    res.status(201).json({ id: result.lastInsertRowid });
  });

  app.patch("/api/design/requests/:id/proofs/:proofId", auth, requireDesignerCapable, (req, res) => {
    const row = getRequest(db, req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    const staff = isStaffOrAdmin(req.user);
    const designer = isDesigner(req.user);
    if (!staff && !(designer && row.assignee_id === req.user.id)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const proof = db.prepare(
      "SELECT * FROM design_proofs WHERE id = ? AND request_id = ?"
    ).get(req.params.proofId, row.id);
    if (!proof) return res.status(404).json({ error: "Proof not found" });

    const { periscopeShareId } = req.body || {};
    if (periscopeShareId !== undefined) {
      const id = typeof periscopeShareId === "string" ? periscopeShareId.trim().toLowerCase() : "";
      if (id && !/^[a-z0-9]{6,32}$/.test(id)) {
        return res.status(400).json({ error: "Invalid Periscope share id" });
      }
      db.prepare(
        "UPDATE design_proofs SET periscope_share_id = ? WHERE id = ?"
      ).run(id || null, proof.id);
    }
    const updated = db.prepare("SELECT * FROM design_proofs WHERE id = ?").get(proof.id);
    res.json({
      id: updated.id,
      version: updated.version,
      label: updated.label,
      fileUrl: updated.file_url,
      mimeType: updated.mime_type,
      periscopeShareId: updated.periscope_share_id || null,
    });
  });

  app.get("/api/design/requests/:id/comments", auth, (req, res) => {
    const row = getRequest(db, req.params.id);
    const access = assertRequestAccess(req, row);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const comments = db.prepare(
      "SELECT * FROM design_comments WHERE request_id = ? ORDER BY created_at ASC"
    ).all(row.id).map((c) => ({
      id: c.id,
      authorName: c.author_name,
      role: c.role,
      text: c.text,
      marker: c.marker_x != null ? { x: c.marker_x, y: c.marker_y } : null,
      createdAt: c.created_at,
    }));
    res.json({ comments });
  });

  app.post("/api/design/requests/:id/comments", auth, async (req, res) => {
    const row = getRequest(db, req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    if (req.user.role === "client" && row.client_id !== req.user.clientId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (req.user.role === "client" && !CLIENT_VISIBLE_STATUSES.includes(row.status)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (!isStaffOrAdmin(req.user) && !isDesigner(req.user) && req.user.role !== "client") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { text, proofId, marker } = req.body || {};
    if (!text?.trim()) return res.status(400).json({ error: "text required" });

    const result = db.prepare(
      `INSERT INTO design_comments (request_id, proof_id, author_id, author_name, role, text, marker_x, marker_y)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      row.id,
      proofId || null,
      req.user.id,
      req.user.name,
      req.user.role,
      text.trim(),
      marker?.x ?? null,
      marker?.y ?? null,
    );

    if (req.user.role === "client" && row.assignee_id) {
      const assignee = db.prepare("SELECT email FROM users WHERE id = ?").get(row.assignee_id);
      const client = db.prepare("SELECT name FROM clients WHERE id = ?").get(row.client_id);
      if (assignee?.email) {
        queueDesignMail(db, {
          requestId: row.id,
          eventType: "comment",
          to: assignee.email,
          data: {
            title: row.title,
            authorName: req.user.name,
            clientName: client?.name || "",
            excerpt: text.trim().slice(0, 120),
          },
        });
      }
    }

    res.status(201).json({ id: result.lastInsertRowid });
  });

  return { activeDesignCountSql };
}
