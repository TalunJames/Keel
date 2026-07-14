// Fog Signal Proposals builder — mounted under /proposals/app inside Keel.
// Vendored from Desktop/Editor. REST + SSE backed by Keel's SQLite proposals table.

import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import express from "express";
import { registerAiRoutes } from "./ai/routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VENDOR_DIR = path.join(__dirname, "..", "vendor", "proposals");
const BASE = "/proposals/app";
const SETTINGS_KEY = "proposal_workspace_settings";
const ASSETS_KEY = "proposal_workspace_assets";
const EDITOR_FORMAT = "editor-v1";

const CLIENT_TYPE_MAP = {
  "Campaign Services": "county",
  "Community Outreach": "special",
  "Crisis Communications": "city",
  "Public Affairs": "county",
  "Financial Strategy": "county",
  Custom: "county",
};

const PRESENCE_COLORS = ["#1A3A5C", "#2A527F", "#3F6A99", "#B8932A", "#2F6B4F", "#A8341E"];

/** @type {Map<string, { cid: string, docId: string, user: object, res: import('express').Response }>} */
const sseClients = new Map();

function initialsOf(name) {
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorForUser(id) {
  let h = 0;
  for (let i = 0; i < String(id).length; i++) h = (h * 31 + String(id).charCodeAt(i)) >>> 0;
  return PRESENCE_COLORS[h % PRESENCE_COLORS.length];
}

function readSetting(db, key, fallback) {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key);
  if (!row?.value) return fallback;
  try {
    return JSON.parse(row.value);
  } catch {
    return fallback;
  }
}

function writeSetting(db, key, value) {
  db.prepare(
  `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
   ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, JSON.stringify(value));
}

function clientScope(user, clientId) {
  if (user.role === "client") return user.clientId;
  if (!clientId || clientId === "all") return null;
  return clientId;
}

function editorClientType(clientType) {
  return CLIENT_TYPE_MAP[clientType] || "county";
}

function parsePayload(row) {
  try {
    return row?.payload_json ? JSON.parse(row.payload_json) : {};
  } catch {
    return {};
  }
}

function rowUpdatedMs(row) {
  const raw = row.updated_at || row.created_at;
  if (!raw) return Date.now();
  return new Date(String(raw).replace(" ", "T") + "Z").getTime();
}

function metaOf(row, payload) {
  return {
    id: String(row.id),
    title: row.title,
    agency: payload.agency || "",
    clientType: payload.clientType || "county",
    rfpNumber: payload.rfpNumber || "",
    deadline: row.due_at || payload.deadline || "",
    updatedAt: rowUpdatedMs(row),
    createdAt: rowUpdatedMs({ created_at: row.created_at }),
  };
}

function rowToEditorDoc(row, client) {
  const payload = parsePayload(row);
  if (payload.format === EDITOR_FORMAT) {
    return {
      ...payload,
      id: String(row.id),
      title: row.title || payload.title,
      agency: payload.agency || client?.name || "",
      clientType: payload.clientType || editorClientType(client?.type),
      deadline: row.due_at || payload.deadline || "",
      keelClientId: row.client_id,
      triageState: row.triage_state || payload.triageState || "building",
    };
  }
  return null;
}

function broadcast(event, payload, { docId = null, exclude = null } = {}) {
  const msg = JSON.stringify({ type: event, ...payload });
  for (const [cid, client] of sseClients) {
    if (exclude && cid === exclude) continue;
    if (docId != null && client.docId !== docId) continue;
    try {
      client.res.write(`data: ${msg}\n\n`);
    } catch {
      sseClients.delete(cid);
    }
  }
}

function presenceList(docId) {
  const users = [];
  for (const [cid, client] of sseClients) {
    if (client.docId === docId) users.push({ ...client.user, cid });
  }
  return users;
}

function broadcastPresence(docId) {
  broadcast("presence", { doc: docId, users: presenceList(docId) }, { docId });
}

function uid(prefix) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

function buildFullTemplateBlocks(clientType) {
  let divNum = 1;
  const bumpDiv = (label) => ({ id: uid("b"), type: "divider", num: ++divNum, label });
  return [
    { id: uid("b"), type: "cover" },
    { id: uid("b"), type: "coverLetter" },
    { id: uid("b"), type: "toc", pageBreak: true },
    bumpDiv("Firm Qualifications & Experience"),
    { id: uid("b"), type: "about" },
    { id: uid("b"), type: "why" },
    bumpDiv("Project Team"),
    { id: uid("b"), type: "team", staff: ["carter", "luke", "digital", "earned", "designer", "coord"], variant: clientType },
    { id: uid("b"), type: "experience" },
    bumpDiv("Technical Approach & Work Plan"),
    { id: uid("b"), type: "understanding" },
    { id: uid("b"), type: "workplan" },
    { id: uid("b"), type: "schedule" },
    bumpDiv("Cost Proposal"),
    { id: uid("b"), type: "cost" },
    { id: uid("b"), type: "terms" },
    { id: uid("b"), type: "conclusion" },
  ];
}

function requireStaff(req, res, next) {
  if (req.user.role !== "staff" && req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

function assertProposalRowAccess(req, row) {
  if (!row) return { ok: false, status: 404, error: "Not found" };
  if (req.user.role === "client") {
    if (row.client_id !== req.user.clientId) return { ok: false, status: 403, error: "Forbidden" };
    if (row.triage_state !== "sent" && row.triage_state !== "signed") {
      return { ok: false, status: 403, error: "Forbidden" };
    }
  }
  return { ok: true };
}

function syncRowFromDoc(db, rowId, doc, user) {
  const payload = { ...doc, format: EDITOR_FORMAT };
  const title = doc.title || "Untitled Proposal";
  const dueAt = doc.deadline || null;
  const clientId = doc.keelClientId || null;
  const triageState = doc.triageState || "building";

  const existing = db.prepare("SELECT client_id FROM proposals WHERE id = ?").get(rowId);
  const resolvedClientId = clientId || existing?.client_id;
  if (!resolvedClientId) throw new Error("clientId required");

  db.prepare(
    `UPDATE proposals SET title = ?, payload_json = ?, due_at = ?, triage_state = ?,
     owner_id = COALESCE(owner_id, ?), updated_at = datetime('now')
     WHERE id = ?`
  ).run(title, JSON.stringify(payload), dueAt, triageState, user?.id || null, rowId);

  if (clientId && clientId !== existing?.client_id) {
    db.prepare("UPDATE proposals SET client_id = ? WHERE id = ?").run(clientId, rowId);
  }
}

function insertDoc(db, doc, user, { clientId, triageState = "building", source = "manual", sourceRef = null } = {}) {
  const resolvedClientId = clientId || doc.keelClientId;
  if (!resolvedClientId) throw new Error("clientId required");

  const payload = { ...doc, format: EDITOR_FORMAT, keelClientId: resolvedClientId };
  const result = db.prepare(
    `INSERT INTO proposals (title, client_id, status, amount, payload_json, triage_state, source, source_ref, owner_id, due_at, updated_at)
     VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(
    doc.title || "Untitled Proposal",
    resolvedClientId,
    doc.amount ?? null,
    JSON.stringify(payload),
    triageState,
    source,
    sourceRef,
    user?.id || null,
    doc.deadline || null,
  );

  const id = String(result.lastInsertRowid);
  payload.id = id;
  db.prepare("UPDATE proposals SET payload_json = ? WHERE id = ?").run(JSON.stringify(payload), result.lastInsertRowid);
  return id;
}

export function registerProposalsAppRoutes(app, db, auth) {
  const api = express.Router({ mergeParams: true });
  api.use(express.json({ limit: "25mb" }));

  api.get("/health", auth, (_req, res) => {
    res.json({ ok: true, storage: "keel", clients: sseClients.size, ts: Date.now() });
  });

  api.get("/workspace", auth, requireStaff, (req, res) => {
    const scope = clientScope(req.user, req.query.clientId);
    const members = db.prepare(
      `SELECT id, name, email, team, title, role, system_admin AS systemAdmin
       FROM users WHERE role IN ('staff', 'admin') ORDER BY name`
    ).all().map((m, i) => ({
      id: m.id,
      name: m.name,
      initials: initialsOf(m.name),
      color: colorForUser(m.id),
      email: m.email,
      role: m.role,
      systemAdmin: !!m.systemAdmin,
    }));

    let clientSql = "SELECT id, name, tag, type FROM clients WHERE active = 1";
    const clientArgs = [];
    if (scope) {
      clientSql += " AND id = ?";
      clientArgs.push(scope);
    }
    clientSql += " ORDER BY name";
    const clients = db.prepare(clientSql).all(...clientArgs).map((c) => ({
      id: c.id,
      name: c.name,
      tag: c.tag,
      type: c.type,
      editorClientType: editorClientType(c.type),
    }));

    res.json({
      me: {
        id: req.user.id,
        name: req.user.name,
        initials: initialsOf(req.user.name),
        color: colorForUser(req.user.id),
        role: req.user.role,
        systemAdmin: !!req.user.systemAdmin,
      },
      users: members,
      clients,
      clientId: scope,
      isAdmin: req.user.role === "admin" || !!req.user.systemAdmin,
    });
  });

  api.get("/proposals", auth, (req, res) => {
    const scope = clientScope(req.user, req.query.clientId);
    let sql = "SELECT * FROM proposals";
    const args = [];
    const clauses = [];
    if (scope) {
      clauses.push("client_id = ?");
      args.push(scope);
    }
    if (req.user.role === "client") {
      clauses.push("triage_state IN ('sent', 'signed')");
    }
    clauses.push("(json_extract(payload_json, '$.format') = ? OR payload_json IS NULL)");
    args.push(EDITOR_FORMAT);
    if (clauses.length) sql += " WHERE " + clauses.join(" AND ");
    sql += " ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 500";

    const rows = db.prepare(sql).all(...args);
    const list = rows
      .map((row) => {
        const payload = parsePayload(row);
        if (payload.format !== EDITOR_FORMAT) return null;
        return metaOf(row, payload);
      })
      .filter(Boolean);
    res.json(list);
  });

  api.post("/proposals", auth, requireStaff, (req, res) => {
    const doc = req.body;
    if (!doc || typeof doc !== "object") return res.status(400).json({ error: "bad body" });

    const scope = clientScope(req.user, req.query.clientId);
    const clientId = doc.keelClientId || scope;
    if (!clientId) return res.status(400).json({ error: "clientId required — select a client in Keel" });

    try {
      const id = insertDoc(db, doc, req.user, { clientId });
      broadcast("index", { by: req.query.client || "" });
      res.status(201).json({ ok: true, id });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  api.get("/proposals/:id", auth, (req, res) => {
    const row = db.prepare("SELECT * FROM proposals WHERE id = ?").get(req.params.id);
    const access = assertProposalRowAccess(req, row);
    if (!access.ok) return res.status(access.status).json({ error: access.error });

    const client = db.prepare("SELECT name, type FROM clients WHERE id = ?").get(row.client_id);
    const doc = rowToEditorDoc(row, client);
    if (!doc) return res.status(409).json({ error: "Legacy proposal format — open in Keel archive or recreate" });
    res.json(doc);
  });

  const saveDocHandler = (req, res) => {
    const row = db.prepare("SELECT * FROM proposals WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "not found" });

    const doc = req.body;
    if (!doc || String(doc.id) !== String(req.params.id)) {
      return res.status(400).json({ error: "bad body" });
    }

    try {
      syncRowFromDoc(db, row.id, doc, req.user);
      broadcast("doc", { id: String(row.id), updatedAt: doc.updatedAt, by: req.query.client || "" }, {
        docId: String(row.id),
        exclude: req.query.client || null,
      });
      broadcast("index", { by: req.query.client || "" });
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  };

  api.put("/proposals/:id", auth, requireStaff, saveDocHandler);
  // sendBeacon can only POST — the tab-close flush uses this twin of the PUT
  // above. (Flushing to POST /proposals would create a duplicate row.)
  api.post("/proposals/:id/flush", auth, requireStaff, saveDocHandler);

  api.delete("/proposals/:id", auth, requireStaff, (req, res) => {
    const row = db.prepare("SELECT id FROM proposals WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "not found" });
    db.prepare("DELETE FROM proposals WHERE id = ?").run(req.params.id);
    broadcast("index", { by: req.query.client || "" });
    res.json({ ok: true });
  });

  api.get("/assets", auth, requireStaff, (_req, res) => {
    res.json(readSetting(db, ASSETS_KEY, { bgs: [], sigs: {} }));
  });

  api.put("/assets", auth, requireStaff, (req, res) => {
    const assets = req.body;
    if (!assets || typeof assets !== "object") return res.status(400).json({ error: "bad body" });
    writeSetting(db, ASSETS_KEY, assets);
    broadcast("assets", { by: req.query.client || "" });
    res.json({ ok: true });
  });

  api.get("/settings", auth, requireStaff, (_req, res) => {
    res.json(readSetting(db, SETTINGS_KEY, {}));
  });

  api.put("/settings", auth, requireStaff, (req, res) => {
    const settings = req.body;
    if (!settings || typeof settings !== "object") return res.status(400).json({ error: "bad body" });
    const existing = readSetting(db, SETTINGS_KEY, {});
    const canEdit = req.user.role === "admin" || !!req.user.systemAdmin
      || (existing.access?.admins || []).includes(req.user.id);
    if (!canEdit) {
      return res.status(403).json({ error: "Workspace settings require admin access" });
    }
    writeSetting(db, SETTINGS_KEY, settings);
    broadcast("settings", { by: req.query.client || "" });
    res.json({ ok: true });
  });

  api.get("/events", auth, (req, res) => {
    const docId = req.query.doc || "";
    const cid = req.query.client || randomUUID();
    const user = {
      name: req.query.name || req.user.name || "Someone",
      initials: (req.query.initials || initialsOf(req.user.name)).slice(0, 2),
      color: req.query.color || colorForUser(req.user.id),
    };

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    sseClients.set(cid, { cid, docId, user, res });
    broadcastPresence(docId);

    const ping = setInterval(() => {
      try {
        res.write(": ping\n\n");
      } catch {
        clearInterval(ping);
        sseClients.delete(cid);
      }
    }, 20000);

    req.on("close", () => {
      clearInterval(ping);
      sseClients.delete(cid);
      broadcastPresence(docId);
    });
  });

  registerAiRoutes(api, db, { requireStaff, createEditorProposal, editorClientType });

  app.use(`${BASE}/api`, auth, api);

  app.use(BASE, express.static(VENDOR_DIR, { index: false }));

  const indexPath = path.join(VENDOR_DIR, "index-keel.html");
  const sendShell = (_req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.sendFile(indexPath, (err) => {
      if (err && !res.headersSent) {
        console.error("[proposals] shell missing:", indexPath, err.message);
        res.status(500).send("Proposals builder shell missing");
      }
    });
  };
  app.get(`${BASE}`, sendShell);
  app.get(`${BASE}/`, sendShell);
  app.get(`${BASE}/app`, sendShell);
}

/** Create an editor-format proposal document (used by Cleatus ingest). */
export function createEditorProposal(db, {
  title,
  clientId,
  agency,
  clientType,
  rfpNumber,
  deadline,
  serviceTitle,
  template = "full",
  triageState = "inbox",
  source = "manual",
  sourceRef = null,
  ownerId = null,
  cleatus = null,
  blocks = null,
  content = null,
  amount = null,
} = {}) {
  const ct = clientType || editorClientType(
    db.prepare("SELECT type FROM clients WHERE id = ?").get(clientId)?.type
  );

  const blockList = blocks || (template === "blank" ? [] : buildFullTemplateBlocks(ct));

  const doc = {
    title: title || "Untitled Proposal",
    agency: agency || "",
    clientType: ct,
    rfpNumber: rfpNumber || "",
    serviceTitle: serviceTitle || "Public Education & Community Outreach Services",
    deadline: deadline || "",
    pageSize: "letter",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    marginPx: null,
    pageBg: { id: null, skipFirst: true },
    pageNums: { show: true, format: "Page {n}", pos: "bottom-center", font: "source", size: 10, color: "#7A7975", skipFirst: true },
    blocks: blockList,
    content: content || {},
    floats: [],
    comments: [],
    rfp: {
      items: [],
      pageLimit: null,
      cleatusUrl: cleatus?.rfpUrl || null,
      sourceUrl: cleatus?.rfpUrl || null,
    },
    versions: [],
    proofing: { signoffs: {} },
    keelClientId: clientId,
    triageState,
    template,
    amount,
  };

  const rowId = insertDoc(db, doc, { id: ownerId }, { clientId, triageState, source, sourceRef });
  doc.id = rowId;

  if (cleatus?.staffNotes) {
    db.prepare(
      `INSERT INTO proposal_notes (proposal_id, author_id, author_name, role, text)
       VALUES (?, ?, ?, 'staff', ?)`
    ).run(rowId, ownerId, "Cleatus", cleatus.staffNotes);
  }

  if (amount != null) {
    db.prepare("UPDATE proposals SET amount = ? WHERE id = ?").run(amount, rowId);
  }

  const stored = { ...doc, format: EDITOR_FORMAT, id: rowId };
  db.prepare("UPDATE proposals SET payload_json = ? WHERE id = ?").run(JSON.stringify(stored), rowId);
  return { proposalId: Number(rowId), doc: stored };
}

export { BASE as PROPOSALS_APP_BASE, EDITOR_FORMAT, editorClientType };
