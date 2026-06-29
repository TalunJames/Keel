import { randomUUID } from "crypto";
import { DEFAULT_MODULES, DEFAULT_LOGIN_ANNOUNCEMENT } from "./db.js";
import {
  getElectionLiveStatus,
  listElectionContests,
  getElectionLiveResults,
} from "./election-live.js";
import {
  getCollectorStatus,
  getCollectorConfig,
  updateCollectorConfig,
  startCollector,
  stopCollector,
  runCollectorOnce,
  discoverCollectorEids,
  testCollector,
} from "./election-collector-service.js";
import {
  comparePassword,
  hashPassword,
  requireAuth,
  requireRole,
  setAuthCookie,
  clearAuthCookie,
  signToken,
} from "./auth.js";

const ALL_CLIENT = {
  id: "all",
  name: "All Clients",
  tag: "ALL",
  initials: "ALL",
  account: "—",
  type: "",
  color: "linear-gradient(135deg, var(--fs-navy) 0%, var(--fs-gold) 100%)",
};

function clientScope(user, clientId) {
  if (user.role === "client") return user.clientId;
  if (!clientId || clientId === "all") return null;
  return clientId;
}

function rowToClient(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    tag: row.tag,
    initials: row.initials,
    account: row.account,
    type: row.type,
    color: row.color,
    audience: row.audience || "",
  };
}

export function registerRoutes(app, db) {
  const auth = requireAuth(db);

  app.post("/api/auth/login", async (req, res) => {
    const { email, password, remember } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    const user = db.prepare(
      `SELECT id, email, password_hash, name, team, role, client_id AS clientId,
              system_admin AS systemAdmin, title, location, about, phone, photo
       FROM users WHERE email = ? COLLATE NOCASE`
    ).get(email.trim());
    if (!user || !(await comparePassword(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    delete user.password_hash;
    user.systemAdmin = !!user.systemAdmin;
    const token = signToken(user, { remember: !!remember });
    setAuthCookie(res, token, { remember: !!remember });
    res.json({ user, token });
  });

  const requireSystemAdmin = (req, res, next) => {
    if (!req.user?.systemAdmin) return res.status(403).json({ error: "Forbidden" });
    next();
  };

  // ---------- Login announcement (public read; system_admin write) ----------
  app.get("/api/login-announcement", (_req, res) => {
    const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get("login_announcement");
    const ann = row ? JSON.parse(row.value) : DEFAULT_LOGIN_ANNOUNCEMENT;
    res.json({ announcement: ann });
  });

  app.put("/api/login-announcement", auth, requireSystemAdmin, (req, res) => {
    const { enabled, title, body, tone } = req.body || {};
    const next = {
      enabled: enabled !== false,
      title: (title || "").toString().slice(0, 120),
      body: (body || "").toString().slice(0, 600),
      tone: ["info", "warning", "success"].includes(tone) ? tone : "info",
    };
    db.prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    ).run("login_announcement", JSON.stringify(next));
    db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
      req.user.email,
      "Updated login announcement",
      "System"
    );
    res.json({ announcement: next });
  });

  // ---------- Account profile (self-service) ----------
  app.get("/api/account/me", auth, (req, res) => {
    const u = req.user;
    const clientList = db.prepare(
      `SELECT id, name, tag, initials, color, type
       FROM clients WHERE active = 1 ORDER BY name`
    ).all();
    res.json({
      user: u,
      clients: u.role === "client"
        ? clientList.filter((c) => c.id === u.clientId)
        : clientList,
    });
  });

  app.patch("/api/account/me", auth, (req, res) => {
    const allowed = ["name", "team", "title", "location", "about", "phone", "photo"];
    const sets = [];
    const args = [];
    for (const f of allowed) {
      if (req.body[f] !== undefined) {
        sets.push(`${f} = ?`);
        args.push(req.body[f]);
      }
    }
    if (!sets.length) return res.status(400).json({ error: "No fields" });
    args.push(req.user.id);
    db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...args);
    const user = db.prepare(
      `SELECT id, email, name, team, role, client_id AS clientId,
              system_admin AS systemAdmin, title, location, about, phone, photo
       FROM users WHERE id = ?`
    ).get(req.user.id);
    user.systemAdmin = !!user.systemAdmin;
    res.json({ user });
  });

  app.get("/api/account/calendar", auth, (req, res) => {
    const start = new Date(req.query.start || Date.now());
    const days = Math.max(1, Math.min(120, Number(req.query.days) || 42));
    const end = new Date(start);
    end.setDate(end.getDate() + days);
    const scope = req.user.role === "client" ? req.user.clientId : null;
    let sql = "SELECT id, title, starts_at AS startsAt, ends_at AS endsAt, client_id AS clientId, kind, location FROM calendar_events WHERE starts_at >= ? AND starts_at < ?";
    const args = [start.toISOString(), end.toISOString()];
    if (scope) { sql += " AND (client_id IS NULL OR client_id = ?)"; args.push(scope); }
    sql += " ORDER BY starts_at ASC LIMIT 500";
    res.json({ events: db.prepare(sql).all(...args) });
  });

  app.post("/api/auth/logout", (_req, res) => {
    clearAuthCookie(res);
    res.json({ ok: true });
  });

  app.get("/api/auth/me", auth, (req, res) => {
    res.json({ user: req.user });
  });

  app.get("/api/clients", auth, (req, res) => {
    let rows;
    if (req.user.role === "client") {
      rows = db.prepare("SELECT * FROM clients WHERE id = ? AND active = 1").all(req.user.clientId);
    } else {
      rows = db.prepare("SELECT * FROM clients WHERE active = 1 ORDER BY name").all();
    }
    const clients = [ALL_CLIENT, ...rows.map(rowToClient).filter(Boolean)];
    if (req.user.role === "client") {
      return res.json({ clients: rows.map(rowToClient) });
    }
    res.json({ clients });
  });

  app.get("/api/modules", auth, (req, res) => {
    const row = db.prepare("SELECT modules_json FROM user_modules WHERE role = ?").get(req.user.role);
    const modules = row ? JSON.parse(row.modules_json) : DEFAULT_MODULES[req.user.role];
    res.json({ modules });
  });

  app.put("/api/modules/:role", auth, requireRole("admin"), (req, res) => {
    const { role } = req.params;
    if (!DEFAULT_MODULES[role]) return res.status(400).json({ error: "Invalid role" });
    db.prepare(
      "INSERT INTO user_modules (role, modules_json) VALUES (?, ?) ON CONFLICT(role) DO UPDATE SET modules_json = excluded.modules_json"
    ).run(role, JSON.stringify(req.body.modules || DEFAULT_MODULES[role]));
    res.json({ ok: true });
  });

  app.get("/api/badges", auth, (req, res) => {
    const scope = clientScope(req.user, req.query.clientId);
    const designWhere = scope ? " AND client_id = ?" : "";
    const designArgs = scope ? [scope] : [];
    const openDesign = db.prepare(
      `SELECT COUNT(*) AS n FROM design_requests WHERE status IN ('open','in_review')${designWhere}`
    ).get(...designArgs)?.n || 0;
    const mediaWhere = scope ? " WHERE client_id = ?" : "";
    const mediaN = db.prepare(`SELECT COUNT(*) AS n FROM media_mentions${mediaWhere}`).get(...(scope ? [scope] : []))?.n || 0;
    const liveRaces = db.prepare(
      "SELECT COUNT(*) AS n FROM election_races WHERE status = 'live'"
    ).get().n || 0;
    res.json({ design: openDesign, media: mediaN, election: liveRaces ? "LIVE" : null });
  });

  // ---------- Home ----------
  app.get("/api/home", auth, (req, res) => {
    const scope = clientScope(req.user, req.query.clientId);
    const role = req.user.role;
    let annSql = "SELECT * FROM announcements ORDER BY pin DESC, created_at DESC LIMIT 50";
    const annArgs = [];
    if (scope) {
      annSql = "SELECT * FROM announcements WHERE client_id IS NULL OR client_id = ? ORDER BY pin DESC, created_at DESC LIMIT 50";
      annArgs.push(scope);
    }
    const announcements = db.prepare(annSql).all(...annArgs)
      .filter((a) => JSON.parse(a.audience_json).includes(role))
      .map((a) => ({
        id: a.id,
        pin: !!a.pin,
        from: a.from_name,
        title: a.title,
        body: a.body,
        tag: a.tag,
        time: a.created_at,
      }));

    const tasks = db.prepare(
      "SELECT id, label, due, done, kind FROM tasks WHERE user_id = ? ORDER BY done ASC, created_at DESC"
    ).all(req.user.id).map((t) => ({
      id: t.id,
      label: t.label,
      due: t.due,
      done: !!t.done,
      kind: t.kind,
    }));

    let raceSql = "SELECT name, payload_json FROM election_races ORDER BY created_at DESC LIMIT 20";
    const raceArgs = [];
    if (scope) {
      raceSql = "SELECT name, payload_json FROM election_races WHERE client_id = ? ORDER BY created_at DESC LIMIT 20";
      raceArgs.push(scope);
    }
    const races = db.prepare(raceSql).all(...raceArgs).map((r) => {
      const p = r.payload_json ? JSON.parse(r.payload_json) : {};
      return { name: r.name, ...p };
    });

    const openDesign = db.prepare(
      `SELECT COUNT(*) AS n FROM design_requests WHERE status IN ('open','in_review')${scope ? " AND client_id = ?" : ""}`
    ).get(...(scope ? [scope] : []))?.n || 0;

    res.json({
      announcements,
      tasks,
      races,
      stats: {
        openProofs: openDesign,
        tasksDue: tasks.filter((t) => !t.done).length,
        racesTonight: db.prepare("SELECT COUNT(*) AS n FROM election_races WHERE status = 'live'").get().n || 0,
      },
    });
  });

  app.patch("/api/home/tasks/:id", auth, (req, res) => {
    const row = db.prepare("SELECT * FROM tasks WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    const done = req.body.done ? 1 : 0;
    db.prepare("UPDATE tasks SET done = ? WHERE id = ?").run(done, req.params.id);
    res.json({ ok: true });
  });

  // ---------- Generic list endpoints ----------
  const list = (table, mapRow, clientColumn = "client_id") => (req, res) => {
    const scope = clientScope(req.user, req.query.clientId);
    let sql = `SELECT * FROM ${table}`;
    const args = [];
    if (scope) {
      sql += ` WHERE ${clientColumn} = ?`;
      args.push(scope);
    }
    sql += " ORDER BY created_at DESC LIMIT 500";
    res.json({ items: db.prepare(sql).all(...args).map(mapRow) });
  };

  app.get("/api/calendar/events", auth, list("calendar_events", (r) => ({
    id: r.id,
    title: r.title,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    clientId: r.client_id,
    kind: r.kind,
    location: r.location,
    ...(r.payload_json ? JSON.parse(r.payload_json) : {}),
  })));

  app.get("/api/design/requests", auth, list("design_requests", (r) => ({
    id: r.id,
    title: r.title,
    clientId: r.client_id,
    status: r.status,
    priority: r.priority,
    due: r.due,
    assignee: r.assignee,
    ...(r.payload_json ? JSON.parse(r.payload_json) : {}),
  })));

  app.get("/api/proposals", auth, list("proposals", (r) => ({
    id: r.id,
    title: r.title,
    clientId: r.client_id,
    status: r.status,
    amount: r.amount,
    ...(r.payload_json ? JSON.parse(r.payload_json) : {}),
  })));

  app.get("/api/media/mentions", auth, list("media_mentions", (r) => ({
    id: r.id,
    outlet: r.outlet,
    headline: r.headline,
    clientId: r.client_id,
    sentiment: r.sentiment,
    publishedAt: r.published_at,
    url: r.url,
    excerpt: r.excerpt,
  })));

  app.get("/api/stakeholders", auth, list("stakeholders", (r) => ({
    id: r.id,
    name: r.name,
    org: r.org,
    title: r.title,
    clientId: r.client_id,
    tier: r.tier,
    status: r.status,
    email: r.email,
    phone: r.phone,
    owner: r.owner,
    ...(r.payload_json ? JSON.parse(r.payload_json) : {}),
  })));

  app.get("/api/resources", auth, list("resources", (r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    clientId: r.client_id,
    account: r.account,
    author: r.author,
    kind: r.kind,
    tags: r.tags_json ? JSON.parse(r.tags_json) : [],
    url: r.url,
  })));

  app.get("/api/onboarding/programs", auth, list("onboarding_programs", (r) => ({
    id: r.id,
    clientId: r.client_id,
    name: r.name,
    status: r.status,
    ...(r.payload_json ? JSON.parse(r.payload_json) : {}),
  })));

  app.get("/api/polling/polls", auth, (req, res) => {
    const scope = clientScope(req.user, req.query.clientId);
    let sql = "SELECT * FROM polls";
    const args = [];
    if (scope) {
      sql += " WHERE client_id IS NULL OR client_id = ?";
      args.push(scope);
    }
    const polls = db.prepare(sql + " ORDER BY created_at DESC").all(...args).map((p) => ({
      id: p.id,
      title: p.title,
      n: p.n,
      moe: p.moe,
      date: p.date_range,
      unlocked: !!p.unlocked || req.user.role !== "client",
      payload: p.payload_json ? JSON.parse(p.payload_json) : null,
    }));
    res.json({ polls });
  });

  app.get("/api/election/races", auth, (req, res) => {
    const scope = clientScope(req.user, req.query.clientId);
    let sql = "SELECT * FROM election_races";
    const args = [];
    if (scope) {
      sql += " WHERE client_id = ?";
      args.push(scope);
    }
    const races = db.prepare(sql + " ORDER BY created_at DESC").all(...args).map((r) => ({
      id: r.id,
      name: r.name,
      clientId: r.client_id,
      state: r.state,
      status: r.status,
      ...(r.payload_json ? JSON.parse(r.payload_json) : {}),
    }));
    res.json({ races });
  });

  app.get("/api/election/live/status", auth, requireRole("staff", "admin"), (_req, res) => {
    res.json(getElectionLiveStatus());
  });

  app.get("/api/election/live/contests", auth, requireRole("staff", "admin"), (req, res) => {
    const patterns = req.query.patterns
      ? String(req.query.patterns).split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
    res.json({ contests: listElectionContests(patterns) });
  });

  app.get("/api/election/live/results", auth, requireRole("staff", "admin"), (req, res) => {
    const { contestKey, contestName } = req.query;
    res.json(getElectionLiveResults({ contestKey, contestName }));
  });

  app.get("/api/election/collector/status", auth, requireRole("staff", "admin"), (_req, res) => {
    res.json(getCollectorStatus());
  });

  app.get("/api/election/collector/config", auth, requireRole("staff", "admin"), (_req, res) => {
    res.json(getCollectorConfig());
  });

  app.put("/api/election/collector/config", auth, requireRole("staff", "admin"), (req, res) => {
    const config = updateCollectorConfig(req.body || {});
    res.json({ config, status: getCollectorStatus() });
  });

  app.post("/api/election/collector/start", auth, requireRole("staff", "admin"), (req, res) => {
    res.json(startCollector(req.body || {}));
  });

  app.post("/api/election/collector/stop", auth, requireRole("staff", "admin"), (_req, res) => {
    res.json(stopCollector());
  });

  app.post("/api/election/collector/once", auth, requireRole("staff", "admin"), async (req, res) => {
    try {
      const result = await runCollectorOnce(req.body || {});
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/election/collector/discover", auth, requireRole("staff", "admin"), async (req, res) => {
    try {
      const result = await discoverCollectorEids(req.body || {});
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/election/collector/test", auth, requireRole("staff", "admin"), async (req, res) => {
    try {
      const result = await testCollector(req.body || {});
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ---------- Voter ----------
  app.get("/api/voter/file", auth, requireRole("staff", "admin"), (req, res) => {
    const scope = clientScope(req.user, req.query.clientId);
    if (!scope || scope === "all") {
      return res.json({ file: null, message: "Select a client to load their voter file." });
    }
    const file = db.prepare(
      "SELECT id, client_id, source, record_count, refreshed_at FROM voter_files WHERE client_id = ? AND active = 1 ORDER BY refreshed_at DESC LIMIT 1"
    ).get(scope);
    res.json({ file: file || null });
  });

  app.post("/api/voter/query", auth, requireRole("staff", "admin"), (req, res) => {
    const { clientId, filters, query, page = 1, pageSize = 50 } = req.body || {};
    const scope = clientScope(req.user, clientId);
    if (!scope) {
      return res.status(400).json({ error: "Select a specific client for voter queries." });
    }
    const file = db.prepare(
      "SELECT record_count FROM voter_files WHERE client_id = ? AND active = 1 LIMIT 1"
    ).get(scope);
    if (!file) {
      return res.json({ total: 0, rows: [], stats: { avgScore: 0, partyMix: { D: 0, R: 0, I: 0 } }, page, pageSize });
    }
    // Production: run warehouse query. Until ingest is wired, return empty page with estimated count from stored metadata only when no shard is loaded.
    const total = 0;
    res.json({
      total,
      recordCount: file.record_count,
      rows: [],
      stats: { avgScore: 0, partyMix: { D: 0, R: 0, I: 0 } },
      page,
      pageSize,
      message: "Voter file is registered but row data is not loaded. Complete TargetSmart ingest to enable queries.",
    });
  });

  app.get("/api/voter/cuts", auth, requireRole("staff", "admin"), (req, res) => {
    const scope = clientScope(req.user, req.query.clientId);
    let sql = "SELECT * FROM voter_cuts";
    const args = [];
    if (scope) {
      sql += " WHERE client_id = ?";
      args.push(scope);
    }
    sql += " ORDER BY created_at DESC LIMIT 100";
    const cuts = db.prepare(sql).all(...args).map((c) => ({
      id: c.id,
      name: c.name,
      filters: JSON.parse(c.filters_json),
      query: c.query,
      count: c.record_count,
      clientId: c.client_id,
      createdAt: c.created_at,
    }));
    res.json({ cuts });
  });

  app.post("/api/voter/cuts", auth, requireRole("staff", "admin"), (req, res) => {
    const { name, filters, query, clientId, count } = req.body || {};
    const scope = clientScope(req.user, clientId);
    if (!scope || !name) return res.status(400).json({ error: "clientId and name required" });
    const id = "cut-" + randomUUID();
    db.prepare(
      `INSERT INTO voter_cuts (id, client_id, user_id, name, filters_json, query, record_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, scope, req.user.id, name, JSON.stringify(filters || {}), query || "", count || 0);
    res.status(201).json({ id });
  });

  app.delete("/api/voter/cuts/:id", auth, requireRole("staff", "admin"), (req, res) => {
    db.prepare("DELETE FROM voter_cuts WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  });

  app.post("/api/voter/export", auth, requireRole("staff", "admin"), (req, res) => {
    const { name, filters, query, clientId, count } = req.body || {};
    res.json({
      jobId: randomUUID(),
      status: "queued",
      manifest: {
        type: "keel_voter_universe",
        version: 1,
        name: name || "export",
        recordCount: count || 0,
        filters: filters || {},
        query: query || "",
        clientId: clientScope(req.user, clientId),
      },
    });
  });

  // ---------- Admin ----------
  app.get("/api/admin/users", auth, requireRole("admin"), (_req, res) => {
    const users = db.prepare(
      `SELECT id, email, name, team, role, client_id AS clientId,
              system_admin AS systemAdmin, title, location, created_at AS createdAt
       FROM users ORDER BY created_at DESC`
    ).all().map((u) => ({ ...u, systemAdmin: !!u.systemAdmin }));
    res.json({ users });
  });

  app.post("/api/admin/users", auth, requireRole("admin"), async (req, res) => {
    const { email, password, name, team, role, clientId, systemAdmin } = req.body || {};
    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (systemAdmin && !req.user.systemAdmin) {
      return res.status(403).json({ error: "Only a system admin can grant system_admin" });
    }
    const id = randomUUID();
    try {
      db.prepare(
        `INSERT INTO users (id, email, password_hash, name, team, role, client_id, system_admin)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, email.trim(), await hashPassword(password), name, team || "", role, clientId || null,
            (systemAdmin && role === "admin") ? 1 : 0);
    } catch (e) {
      if (e.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return res.status(409).json({ error: "Email already exists" });
      }
      throw e;
    }
    db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
      req.user.email,
      `Created user ${email} (${role}${systemAdmin ? ", system admin" : ""})`,
      "Users"
    );
    res.status(201).json({ id });
  });

  app.patch("/api/admin/users/:id", auth, requireSystemAdmin, (req, res) => {
    const target = db.prepare("SELECT id, role, email FROM users WHERE id = ?").get(req.params.id);
    if (!target) return res.status(404).json({ error: "Not found" });
    const { systemAdmin } = req.body || {};
    if (systemAdmin !== undefined) {
      if (systemAdmin && target.role !== "admin") {
        return res.status(400).json({ error: "User must have admin role first" });
      }
      db.prepare("UPDATE users SET system_admin = ? WHERE id = ?").run(systemAdmin ? 1 : 0, target.id);
      db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
        req.user.email,
        `${systemAdmin ? "Granted" : "Revoked"} system admin for ${target.email}`,
        "Users"
      );
    }
    res.json({ ok: true });
  });

  app.get("/api/admin/clients", auth, requireRole("admin"), (_req, res) => {
    const clients = db.prepare("SELECT * FROM clients ORDER BY name").all().map(rowToClient);
    res.json({ clients });
  });

  app.post("/api/admin/clients", auth, requireRole("admin"), (req, res) => {
    const { id, name, tag, initials, account, type, color, audience } = req.body || {};
    if (!id || !name || !tag || !initials) {
      return res.status(400).json({ error: "id, name, tag, initials required" });
    }
    db.prepare(
      `INSERT INTO clients (id, name, tag, initials, account, type, color, audience)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, name, tag, initials, account || "", type || "", color || "var(--fs-navy)", audience || "");
    db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
      req.user.email,
      `Created client ${name}`,
      "Clients"
    );
    res.status(201).json({ ok: true });
  });

  app.patch("/api/admin/clients/:id", auth, requireRole("admin"), (req, res) => {
    const fields = ["name", "tag", "initials", "account", "type", "color", "audience", "active"];
    const sets = [];
    const args = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        sets.push(`${f} = ?`);
        args.push(req.body[f]);
      }
    }
    if (!sets.length) return res.status(400).json({ error: "No fields" });
    args.push(req.params.id);
    db.prepare(`UPDATE clients SET ${sets.join(", ")} WHERE id = ?`).run(...args);
    res.json({ ok: true });
  });

  app.post("/api/admin/voter-files", auth, requireRole("admin"), (req, res) => {
    const { clientId, source, recordCount, refreshedAt, storagePath } = req.body || {};
    if (!clientId || !source) return res.status(400).json({ error: "clientId and source required" });
    db.prepare("UPDATE voter_files SET active = 0 WHERE client_id = ?").run(clientId);
    db.prepare(
      `INSERT INTO voter_files (client_id, source, record_count, refreshed_at, storage_path, active)
       VALUES (?, ?, ?, ?, ?, 1)`
    ).run(clientId, source, recordCount || 0, refreshedAt || new Date().toISOString(), storagePath || null);
    db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
      req.user.email,
      `Registered voter file for ${clientId}: ${source} (${recordCount || 0} records)`,
      "Data"
    );
    res.status(201).json({ ok: true });
  });

  app.get("/api/admin/audit", auth, requireRole("admin"), (_req, res) => {
    const items = db.prepare(
      "SELECT who, what, category, created_at AS at FROM audit_log ORDER BY created_at DESC LIMIT 100"
    ).all();
    res.json({ items });
  });

  app.get("/api/admin/announcements", auth, requireRole("admin"), (_req, res) => {
    const items = db.prepare("SELECT * FROM announcements ORDER BY created_at DESC").all();
    res.json({ items });
  });

  app.post("/api/admin/announcements", auth, requireRole("admin"), (req, res) => {
    const { pin, audience, from, title, body, tag, clientId } = req.body || {};
    if (!title || !body) return res.status(400).json({ error: "title and body required" });
    db.prepare(
      `INSERT INTO announcements (pin, audience_json, from_name, title, body, tag, client_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      pin ? 1 : 0,
      JSON.stringify(audience || ["staff", "admin", "client"]),
      from || req.user.name,
      title,
      body,
      tag || "",
      clientId || null
    );
    res.status(201).json({ ok: true });
  });
}
