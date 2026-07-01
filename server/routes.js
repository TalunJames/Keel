import { randomUUID } from "crypto";
import { DEFAULT_MODULES, DEFAULT_LOGIN_ANNOUNCEMENT } from "./db.js";
import { computeEffectiveModules } from "./access.js";
import { getSetupStatus, isBootstrapPending, markSetupComplete, findBootstrapUser } from "./bootstrap.js";
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
import {
  queryVoters,
  queryVoterMap,
  getVoterMeta,
  hasWarehouse,
  ingestVoterFile,
  geocodeClientVoters,
  registerVoterFileInDb,
  resolveVoterFile,
  countVoterExport,
  iterateVoterExport,
  voterExportCsvHeader,
  voterExportCsvRow,
} from "./voter/warehouse.js";
import { registerDesignRoutes } from "./design-routes.js";
import { ACTIVE_STATUSES } from "./design-status.js";

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
  const extra = row.payload_json ? JSON.parse(row.payload_json) : {};
  return {
    id: row.id,
    name: row.name,
    tag: row.tag,
    initials: row.initials,
    account: row.account,
    type: row.type,
    color: row.color,
    audience: row.audience || "",
    active: row.active !== 0,
    ...extra,
    logo: row.logo || extra.logo || null,
  };
}

function slugifyClientId(tag) {
  return String(tag || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function registerRoutes(app, db) {
  const auth = requireAuth(db);

  app.get("/api/setup/status", (_req, res) => {
    res.json(getSetupStatus(db));
  });

  app.post("/api/setup/complete", async (req, res) => {
    const status = getSetupStatus(db);
    if (!status.needsSetup) {
      return res.status(400).json({ error: "Setup already completed" });
    }
    const { password, name } = req.body || {};
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const row = findBootstrapUser(db);
    if (!row) {
      return res.status(400).json({ error: "Bootstrap admin account not found" });
    }

    const displayName = (name || row.name || status.name || "").trim();
    if (!displayName) {
      return res.status(400).json({ error: "Name is required" });
    }

    db.prepare(
      "UPDATE users SET password_hash = ?, name = ?, role = 'admin', system_admin = 1 WHERE id = ?"
    ).run(await hashPassword(password), displayName, row.id);
    markSetupComplete(db);
    db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
      status.email,
      "Completed first-boot setup and set admin password",
      "System"
    );

    const user = {
      id: row.id,
      email: row.email,
      name: displayName,
      team: row.team || "Operations",
      role: "admin",
      clientId: row.clientId ?? null,
      systemAdmin: true,
      title: row.title || "",
      location: row.location || "",
      about: row.about || "",
      phone: row.phone || "",
      photo: row.photo ?? null,
      isDesigner: false,
    };
    const token = signToken(user, { remember: true });
    setAuthCookie(res, token, { remember: true, req });
    res.json({ user, token });
  });

  app.post("/api/auth/login", async (req, res) => {
    const setup = getSetupStatus(db);
    if (setup.needsSetup) {
      return res.status(403).json({
        error: "Complete first-time setup before signing in",
        needsSetup: true,
      });
    }

    const { email, password, remember } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    const user = db.prepare(
      `SELECT id, email, password_hash, name, team, role, client_id AS clientId,
              system_admin AS systemAdmin, is_designer AS isDesigner,
              title, location, about, phone, photo
       FROM users WHERE email = ? COLLATE NOCASE`
    ).get(email.trim());
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    if (isBootstrapPending(user.password_hash)) {
      return res.status(403).json({
        error: "Complete first-time setup to create your password",
        needsSetup: true,
      });
    }
    if (!(await comparePassword(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    delete user.password_hash;
    user.systemAdmin = !!user.systemAdmin;
    user.isDesigner = !!user.isDesigner;
    const token = signToken(user, { remember: !!remember });
    setAuthCookie(res, token, { remember: !!remember, req });
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
      enabled: !!enabled,
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
              system_admin AS systemAdmin, is_designer AS isDesigner,
              title, location, about, phone, photo
       FROM users WHERE id = ?`
    ).get(req.user.id);
    user.systemAdmin = !!user.systemAdmin;
    user.isDesigner = !!user.isDesigner;
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

  app.post("/api/auth/logout", (req, res) => {
    clearAuthCookie(res, req);
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
    const mapped = rows.map(rowToClient).filter(Boolean);
    if (req.user.role === "client") {
      return res.json({ clients: mapped });
    }
    // With a single account, skip the synthetic "All Clients" row so voter/polling scope correctly.
    const clients = mapped.length === 1 ? mapped : [ALL_CLIENT, ...mapped];
    res.json({ clients });
  });

  function roleModuleDefaults(role) {
    const row = db.prepare("SELECT modules_json FROM user_modules WHERE role = ?").get(role);
    return row ? JSON.parse(row.modules_json) : DEFAULT_MODULES[role];
  }

  function userOverridesForClient(userId, clientId) {
    if (!clientId || clientId === "all") return null;
    const row = db.prepare(
      "SELECT modules_json FROM user_client_modules WHERE user_id = ? AND client_id = ?"
    ).get(userId, clientId);
    return row ? JSON.parse(row.modules_json) : null;
  }

  function allUserOverrides(userId) {
    const rows = db.prepare(
      "SELECT client_id, modules_json FROM user_client_modules WHERE user_id = ?"
    ).all(userId);
    const out = {};
    for (const r of rows) out[r.client_id] = JSON.parse(r.modules_json);
    return out;
  }

  function effectiveModulesFor(user, clientId) {
    const roleModules = roleModuleDefaults(user.role);
    let client = null;
    if (clientId && clientId !== "all") {
      const row = db.prepare("SELECT * FROM clients WHERE id = ?").get(clientId);
      client = rowToClient(row);
    }
    const overrides = userOverridesForClient(user.id, clientId);
    return computeEffectiveModules({
      role: user.role,
      roleModules,
      client,
      userOverrides: overrides,
    });
  }

  app.get("/api/modules", auth, (req, res) => {
    const clientId = req.query.clientId || "all";
    const roleModules = roleModuleDefaults(req.user.role);
    res.json({
      modules: roleModules,
      effective: effectiveModulesFor(req.user, clientId),
      overrides: allUserOverrides(req.user.id),
    });
  });

  app.get("/api/access/overrides", auth, (req, res) => {
    res.json({ overrides: allUserOverrides(req.user.id) });
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
    const ph = ACTIVE_STATUSES.map(() => "?").join(", ");
    const designWhere = scope ? ` AND client_id = ?` : "";
    const designArgs = [...ACTIVE_STATUSES, ...(scope ? [scope] : [])];
    const openDesign = db.prepare(
      `SELECT COUNT(*) AS n FROM design_requests WHERE status IN (${ph})${designWhere}`
    ).get(...designArgs)?.n || 0;
    const mediaWhere = scope ? " WHERE client_id = ?" : "";
    const mediaN = db.prepare(`SELECT COUNT(*) AS n FROM media_mentions${mediaWhere}`).get(...(scope ? [scope] : []))?.n || 0;
    // Election badge lights up when the ENR collector has a live, recent heartbeat
    let electionLive = false;
    try {
      const live = getElectionLiveStatus();
      const lastUpdate = live?.heartbeat?.lastUpdateAt ? Date.parse(live.heartbeat.lastUpdateAt) : null;
      electionLive = !!(live?.available && live.mode === "live" && lastUpdate && Date.now() - lastUpdate < 30 * 60 * 1000);
    } catch {
      electionLive = false;
    }
    res.json({ design: openDesign, media: mediaN, election: electionLive ? "LIVE" : null });
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

    // Live races come straight from the ENR collector DB (staff/admin only)
    let races = [];
    if (role !== "client") {
      try {
        const live = getElectionLiveStatus();
        if (live?.available) {
          races = (listElectionContests() || []).slice(0, 20).map((c) => ({
            name: c.name,
            next: c.precinctsReported != null && c.totalPrecincts
              ? `${c.precinctsReported}/${c.totalPrecincts} precincts in`
              : null,
          }));
        }
      } catch {
        races = [];
      }
    }

    const ph = ACTIVE_STATUSES.map(() => "?").join(", ");
    const openDesign = db.prepare(
      `SELECT COUNT(*) AS n FROM design_requests WHERE status IN (${ph})${scope ? " AND client_id = ?" : ""}`
    ).get(...(scope ? [...ACTIVE_STATUSES, scope] : ACTIVE_STATUSES))?.n || 0;

    res.json({
      announcements,
      tasks,
      races,
      stats: {
        openProofs: openDesign,
        tasksDue: tasks.filter((t) => !t.done).length,
        racesTonight: races.length,
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

  const mapCalendarEvent = (r) => ({
    id: r.id,
    title: r.title,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    clientId: r.client_id,
    kind: r.kind,
    location: r.location,
    ...(r.payload_json ? JSON.parse(r.payload_json) : {}),
  });

  const mapProposal = (r) => ({
    id: r.id,
    title: r.title,
    clientId: r.client_id,
    status: r.status,
    amount: r.amount,
    ...(r.payload_json ? JSON.parse(r.payload_json) : {}),
  });

  const mapMediaMention = (r) => ({
    id: r.id,
    outlet: r.outlet,
    headline: r.headline,
    clientId: r.client_id,
    sentiment: r.sentiment,
    publishedAt: r.published_at,
    url: r.url,
    excerpt: r.excerpt,
  });

  const mapStakeholder = (r) => ({
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
  });

  const mapResource = (r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    clientId: r.client_id,
    account: r.account,
    author: r.author,
    kind: r.kind,
    tags: r.tags_json ? JSON.parse(r.tags_json) : [],
    url: r.url,
  });

  const mapOnboardingProgram = (r) => ({
    id: r.id,
    clientId: r.client_id,
    name: r.name,
    status: r.status,
    ...(r.payload_json ? JSON.parse(r.payload_json) : {}),
  });

  app.get("/api/calendar/events", auth, list("calendar_events", mapCalendarEvent));

  registerDesignRoutes(app, db, auth);

  app.get("/api/proposals", auth, list("proposals", mapProposal));

  app.get("/api/media/mentions", auth, list("media_mentions", mapMediaMention));

  app.get("/api/stakeholders", auth, list("stakeholders", mapStakeholder));

  app.get("/api/resources", auth, list("resources", mapResource));

  app.get("/api/onboarding/programs", auth, list("onboarding_programs", mapOnboardingProgram));

  // ---------- Generic module CRUD (staff/admin writes; clients keep read-only GETs) ----------
  const clientExists = (id) => !!db.prepare("SELECT id FROM clients WHERE id = ?").get(id);

  const crud = (base, { table, label, nameColumn = "title", fields, mapRow }) => {
    const staffOnly = requireRole("staff", "admin");
    const getRow = (id) => db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);

    // Turns an API body into a column map. `partial` skips missing fields (PATCH);
    // otherwise required fields must be present and non-empty.
    const buildRow = (body, { partial = false, existing = null } = {}) => {
      const row = {};
      for (const f of fields) {
        const value = body[f.api];
        if (value === undefined) {
          if (f.required && !partial) return { error: `${f.api} is required` };
          continue;
        }
        if (f.type === "number") {
          if (value === null || value === "") {
            if (!f.defaulted) row[f.column] = null;
            continue;
          }
          const n = Number(value);
          if (!Number.isFinite(n)) return { error: `${f.api} must be a number` };
          row[f.column] = n;
          continue;
        }
        if (f.type === "json") {
          if (value === null) {
            row[f.column] = null;
            continue;
          }
          if (typeof value !== "object" || Array.isArray(value)) {
            return { error: `${f.api} must be an object` };
          }
          const prev = partial && existing?.[f.column] ? JSON.parse(existing[f.column]) : {};
          row[f.column] = JSON.stringify({ ...prev, ...value });
          continue;
        }
        if (f.type === "tags") {
          const tags = Array.isArray(value)
            ? value.map((t) => String(t).trim()).filter(Boolean)
            : String(value || "").split(",").map((t) => t.trim()).filter(Boolean);
          row[f.column] = tags.length ? JSON.stringify(tags) : null;
          continue;
        }
        const s = value == null ? "" : String(value).trim();
        if (!s || (f.client && s === "all")) {
          if (f.required) return { error: `${f.api} is required` };
          if (f.defaulted) continue;
          row[f.column] = f.notNull ? "" : null;
          continue;
        }
        if (f.client && !clientExists(s)) return { error: `Unknown client: ${s}` };
        row[f.column] = s;
      }
      return { row };
    };

    const logAction = (who, verb, row) => {
      db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
        who,
        `${verb} ${label} "${row[nameColumn]}"`,
        "Data",
      );
    };

    app.post(base, auth, staffOnly, (req, res) => {
      const { row, error } = buildRow(req.body || {});
      if (error) return res.status(400).json({ error });
      const cols = Object.keys(row);
      const info = db.prepare(
        `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`
      ).run(...cols.map((c) => row[c]));
      const created = getRow(info.lastInsertRowid);
      logAction(req.user.email, "Created", created);
      res.status(201).json({ item: mapRow(created) });
    });

    app.patch(`${base}/:id`, auth, staffOnly, (req, res) => {
      const existing = getRow(req.params.id);
      if (!existing) return res.status(404).json({ error: "Not found" });
      const { row, error } = buildRow(req.body || {}, { partial: true, existing });
      if (error) return res.status(400).json({ error });
      const cols = Object.keys(row);
      if (!cols.length) return res.status(400).json({ error: "No fields" });
      db.prepare(
        `UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`
      ).run(...cols.map((c) => row[c]), req.params.id);
      const updated = getRow(req.params.id);
      logAction(req.user.email, "Updated", updated);
      res.json({ item: mapRow(updated) });
    });

    app.delete(`${base}/:id`, auth, staffOnly, (req, res) => {
      const existing = getRow(req.params.id);
      if (!existing) return res.status(404).json({ error: "Not found" });
      db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
      logAction(req.user.email, "Deleted", existing);
      res.json({ ok: true });
    });
  };

  crud("/api/calendar/events", {
    table: "calendar_events",
    label: "calendar event",
    mapRow: mapCalendarEvent,
    fields: [
      { api: "title", column: "title", required: true },
      { api: "startsAt", column: "starts_at", required: true },
      { api: "endsAt", column: "ends_at" },
      { api: "clientId", column: "client_id", client: true },
      { api: "kind", column: "kind", defaulted: true },
      { api: "location", column: "location" },
      { api: "payload", column: "payload_json", type: "json" },
    ],
  });

  crud("/api/proposals", {
    table: "proposals",
    label: "proposal",
    mapRow: mapProposal,
    fields: [
      { api: "title", column: "title", required: true },
      { api: "clientId", column: "client_id", required: true, client: true },
      { api: "status", column: "status", defaulted: true },
      { api: "amount", column: "amount", type: "number" },
      { api: "payload", column: "payload_json", type: "json" },
    ],
  });

  crud("/api/media/mentions", {
    table: "media_mentions",
    label: "media mention",
    nameColumn: "headline",
    mapRow: mapMediaMention,
    fields: [
      { api: "outlet", column: "outlet", required: true },
      { api: "headline", column: "headline", required: true },
      { api: "clientId", column: "client_id", client: true },
      { api: "sentiment", column: "sentiment" },
      { api: "publishedAt", column: "published_at" },
      { api: "url", column: "url" },
      { api: "excerpt", column: "excerpt" },
    ],
  });

  crud("/api/stakeholders", {
    table: "stakeholders",
    label: "stakeholder",
    nameColumn: "name",
    mapRow: mapStakeholder,
    fields: [
      { api: "name", column: "name", required: true },
      { api: "org", column: "org", notNull: true },
      { api: "title", column: "title", notNull: true },
      { api: "clientId", column: "client_id", required: true, client: true },
      { api: "tier", column: "tier", type: "number", defaulted: true },
      { api: "status", column: "status", defaulted: true },
      { api: "email", column: "email" },
      { api: "phone", column: "phone" },
      { api: "owner", column: "owner" },
      { api: "payload", column: "payload_json", type: "json" },
    ],
  });

  crud("/api/resources", {
    table: "resources",
    label: "resource",
    mapRow: mapResource,
    fields: [
      { api: "title", column: "title", required: true },
      { api: "category", column: "category", required: true },
      { api: "clientId", column: "client_id", client: true },
      { api: "account", column: "account" },
      { api: "author", column: "author" },
      { api: "kind", column: "kind" },
      { api: "tags", column: "tags_json", type: "tags" },
      { api: "url", column: "url" },
    ],
  });

  crud("/api/onboarding/programs", {
    table: "onboarding_programs",
    label: "onboarding program",
    nameColumn: "name",
    mapRow: mapOnboardingProgram,
    fields: [
      { api: "clientId", column: "client_id", required: true, client: true },
      { api: "name", column: "name", required: true },
      { api: "status", column: "status", defaulted: true },
      { api: "payload", column: "payload_json", type: "json" },
    ],
  });

  app.get("/api/polling/polls", auth, (req, res) => {
    const scope = clientScope(req.user, req.query.clientId);
    let sql = "SELECT * FROM polls";
    const args = [];
    if (scope) {
      sql += " WHERE client_id IS NULL OR client_id = ?";
      args.push(scope);
    }
    let polls = db.prepare(sql + " ORDER BY created_at DESC").all(...args).map((p) => ({
      id: p.id,
      title: p.title,
      n: p.n,
      moe: p.moe,
      date: p.date_range,
      unlocked: !!p.unlocked,
      tone: p.payload_json ? JSON.parse(p.payload_json).tone : null,
      payload: p.payload_json ? JSON.parse(p.payload_json) : null,
    }));
    if (req.user.role === "client") {
      polls = polls.filter((p) => p.unlocked);
    }
    res.json({ polls });
  });

  app.patch("/api/polling/polls/:id", auth, requireRole("admin"), (req, res) => {
    const row = db.prepare("SELECT * FROM polls WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });

    if (req.body.unlocked !== undefined) {
      db.prepare("UPDATE polls SET unlocked = ? WHERE id = ?").run(req.body.unlocked ? 1 : 0, req.params.id);
    }

    const payload = row.payload_json ? JSON.parse(row.payload_json) : {};
    if (req.body.payload && typeof req.body.payload === "object") {
      db.prepare("UPDATE polls SET payload_json = ? WHERE id = ?").run(
        JSON.stringify({ ...payload, ...req.body.payload }),
        req.params.id,
      );
    }

    db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
      req.user.email,
      `Updated poll ${req.params.id}${req.body.unlocked !== undefined ? ` (unlocked=${!!req.body.unlocked})` : ""}`,
      "Data",
    );
    res.json({ ok: true });
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
    const file = resolveVoterFile(db, scope);
    res.json({ file: file || null });
  });

  app.get("/api/voter/meta", auth, requireRole("staff", "admin"), (req, res) => {
    const scope = clientScope(req.user, req.query.clientId);
    if (!scope || scope === "all") {
      return res.json({ meta: null, message: "Select a client to load voter metadata." });
    }
    const meta = getVoterMeta(scope);
    if (!meta) {
      return res.json({ meta: null, message: "No ingested voter warehouse for this client." });
    }
    res.json({ meta });
  });

  app.post("/api/voter/query", auth, requireRole("staff", "admin"), (req, res) => {
    const { clientId, filters, query, page = 1, pageSize = 50 } = req.body || {};
    const scope = clientScope(req.user, clientId);
    if (!scope) {
      return res.status(400).json({ error: "Select a specific client for voter queries." });
    }
    const file = resolveVoterFile(db, scope);
    if (!file && !hasWarehouse(scope)) {
      return res.json({ total: 0, rows: [], stats: { avgScore: 0, partyMix: { D: 0, R: 0, I: 0 } }, page, pageSize });
    }
    if (!hasWarehouse(scope)) {
      return res.json({
        total: 0,
        recordCount: file?.record_count || 0,
        rows: [],
        stats: { avgScore: 0, partyMix: { D: 0, R: 0, I: 0 } },
        page,
        pageSize,
        message: "Voter file is registered but row data is not loaded. Run npm run voter:ingest for this client.",
      });
    }
    const result = queryVoters(scope, { filters, query, page, pageSize });
    res.json({ ...result, recordCount: file?.record_count ?? result.total });
  });

  app.post("/api/voter/map", auth, requireRole("staff", "admin"), (req, res) => {
    const { clientId, filters, query, bbox, zoom, limit } = req.body || {};
    const scope = clientScope(req.user, clientId);
    if (!scope) {
      return res.status(400).json({ error: "Select a specific client for voter map queries." });
    }
    if (!hasWarehouse(scope)) {
      return res.json({
        type: "FeatureCollection",
        features: [],
        mode: "points",
        geocodedTotal: 0,
        matchingInView: 0,
        message: "Run npm run voter:ingest and voter:geocode for this client.",
      });
    }
    const result = queryVoterMap(scope, { filters, query, bbox, zoom, limit });
    const meta = getVoterMeta(scope);
    res.json({
      type: "FeatureCollection",
      ...result,
      map: meta?.map || null,
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
    const { name, filters, query, clientId, bbox, scope = "filters" } = req.body || {};
    const client = clientScope(req.user, clientId);
    if (!client) {
      return res.status(400).json({ error: "Select a specific client for export." });
    }
    if (!hasWarehouse(client)) {
      return res.status(400).json({ error: "No ingested voter warehouse for this client." });
    }

    const exportBbox = scope === "map" && Array.isArray(bbox) && bbox.length === 4 ? bbox : undefined;
    const total = countVoterExport(client, { filters: filters || {}, query: query || "", bbox: exportBbox });
    if (total === 0) {
      return res.status(400).json({ error: "No voters match the current filters." });
    }

    const slug = String(name || "keel-universe").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "keel-universe";
    const filename = `${slug}-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("X-Export-Count", String(total));
    res.write("\uFEFF" + voterExportCsvHeader() + "\n");

    for (const row of iterateVoterExport(client, {
      filters: filters || {},
      query: query || "",
      bbox: exportBbox,
    })) {
      res.write(voterExportCsvRow(row) + "\n");
    }
    res.end();
  });

  app.post("/api/voter/export/count", auth, requireRole("staff", "admin"), (req, res) => {
    const { filters, query, clientId, bbox, scope = "filters" } = req.body || {};
    const client = clientScope(req.user, clientId);
    if (!client) {
      return res.status(400).json({ error: "Select a specific client." });
    }
    if (!hasWarehouse(client)) {
      return res.json({ total: 0 });
    }
    const exportBbox = scope === "map" && Array.isArray(bbox) && bbox.length === 4 ? bbox : undefined;
    const total = countVoterExport(client, { filters: filters || {}, query: query || "", bbox: exportBbox });
    res.json({ total });
  });

  // ---------- Admin ----------
  app.get("/api/admin/users", auth, requireRole("admin"), (_req, res) => {
    const users = db.prepare(
      `SELECT u.id, u.email, u.name, u.team, u.role, u.client_id AS clientId,
              u.system_admin AS systemAdmin, u.is_designer AS isDesigner,
              u.title, u.location, u.created_at AS createdAt,
              c.name AS clientName
       FROM users u
       LEFT JOIN clients c ON c.id = u.client_id
       ORDER BY u.name COLLATE NOCASE`
    ).all().map((u) => ({ ...u, systemAdmin: !!u.systemAdmin, isDesigner: !!u.isDesigner }));
    res.json({ users });
  });

  app.post("/api/admin/users", auth, requireRole("admin"), async (req, res) => {
    const { email, password, name, team, role, clientId, systemAdmin, isDesigner } = req.body || {};
    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (systemAdmin && !req.user.systemAdmin) {
      return res.status(403).json({ error: "Only a system admin can grant system_admin" });
    }
    const id = randomUUID();
    try {
      db.prepare(
        `INSERT INTO users (id, email, password_hash, name, team, role, client_id, system_admin, is_designer)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, email.trim(), await hashPassword(password), name, team || "", role, clientId || null,
            (systemAdmin && role === "admin") ? 1 : 0,
            (isDesigner && role !== "client") ? 1 : 0);
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

  app.patch("/api/admin/users/:id", auth, requireRole("admin"), async (req, res) => {
    const target = db.prepare(
      "SELECT id, role, email, system_admin AS systemAdmin FROM users WHERE id = ?"
    ).get(req.params.id);
    if (!target) return res.status(404).json({ error: "Not found" });

    const { name, team, role, clientId, password, systemAdmin, isDesigner } = req.body || {};
    const updates = [];
    const args = [];
    const changes = [];

    if (name !== undefined) {
      const trimmed = (name || "").trim();
      if (!trimmed) return res.status(400).json({ error: "Name cannot be empty" });
      updates.push("name = ?");
      args.push(trimmed);
      changes.push("name");
    }
    if (team !== undefined) {
      updates.push("team = ?");
      args.push(team || "");
      changes.push("team");
    }
    if (role !== undefined) {
      if (!["staff", "admin", "client"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      if (target.id === req.user.id && role !== target.role) {
        return res.status(400).json({ error: "Cannot change your own role" });
      }
      updates.push("role = ?");
      args.push(role);
      changes.push("role");
      if (role !== "admin") updates.push("system_admin = 0");
    }
    if (clientId !== undefined) {
      updates.push("client_id = ?");
      args.push(clientId || null);
      changes.push("client");
    }
    if (password) {
      updates.push("password_hash = ?");
      args.push(await hashPassword(password));
      changes.push("password");
    }
    if (systemAdmin !== undefined) {
      if (!req.user.systemAdmin) {
        return res.status(403).json({ error: "Only a system admin can change system admin status" });
      }
      const effectiveRole = role !== undefined ? role : target.role;
      if (systemAdmin && effectiveRole !== "admin") {
        return res.status(400).json({ error: "User must have admin role first" });
      }
      if (target.id === req.user.id && !systemAdmin) {
        return res.status(400).json({ error: "Cannot revoke your own system admin" });
      }
      updates.push("system_admin = ?");
      args.push(systemAdmin ? 1 : 0);
      changes.push("system admin");
    }
    if (isDesigner !== undefined) {
      const effectiveRole = role !== undefined ? role : target.role;
      if (effectiveRole === "client" && isDesigner) {
        return res.status(400).json({ error: "Clients cannot be designers" });
      }
      updates.push("is_designer = ?");
      args.push(isDesigner ? 1 : 0);
      changes.push("designer");
    }

    if (!updates.length) return res.status(400).json({ error: "No changes provided" });

    args.push(target.id);
    db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...args);
    db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
      req.user.email,
      `Updated user ${target.email} (${changes.join(", ")})`,
      "Users"
    );
    res.json({ ok: true });
  });

  app.get("/api/admin/clients", auth, requireRole("admin"), (_req, res) => {
    const clients = db.prepare("SELECT * FROM clients ORDER BY name").all().map(rowToClient);
    res.json({ clients });
  });

  app.get("/api/team", auth, requireRole("staff", "admin"), (_req, res) => {
    const members = db.prepare(
      `SELECT id, name, email, team, title, role FROM users
       WHERE role IN ('staff', 'admin')
       ORDER BY name`
    ).all();
    res.json({ members });
  });

  app.post("/api/admin/clients", auth, requireRole("admin"), (req, res) => {
    const {
      id: rawId, name, tag, initials, account, type, color, audience, logo, payload,
    } = req.body || {};
    if (!name || !tag || !initials) {
      return res.status(400).json({ error: "name, tag, initials required" });
    }
    const id = rawId || slugifyClientId(tag);
    if (!id) return res.status(400).json({ error: "Could not derive client id from tag" });
    const exists = db.prepare("SELECT id FROM clients WHERE id = ?").get(id);
    if (exists) return res.status(409).json({ error: "A client with this id already exists" });

    const payloadJson = payload ? JSON.stringify(payload) : null;
    db.prepare(
      `INSERT INTO clients (id, name, tag, initials, account, type, color, audience, logo, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, name, tag, initials, account || "", type || "", color || "var(--fs-navy)",
      audience || "", logo || null, payloadJson,
    );
    db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
      req.user.email,
      `Created client ${name}`,
      "Clients"
    );
    res.status(201).json({ ok: true, id });
  });

  app.patch("/api/admin/clients/:id", auth, requireRole("admin"), (req, res) => {
    const fields = ["name", "tag", "initials", "account", "type", "color", "audience", "active", "logo"];
    const sets = [];
    const args = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        sets.push(`${f} = ?`);
        args.push(req.body[f]);
      }
    }

    if (req.body.payload !== undefined) {
      const existing = db.prepare("SELECT payload_json FROM clients WHERE id = ?").get(req.params.id);
      if (!existing) return res.status(404).json({ error: "Not found" });
      const prev = existing.payload_json ? JSON.parse(existing.payload_json) : {};
      const merged = { ...prev, ...req.body.payload };
      sets.push("payload_json = ?");
      args.push(JSON.stringify(merged));
    }

    if (!sets.length) return res.status(400).json({ error: "No fields" });
    args.push(req.params.id);
    const result = db.prepare(`UPDATE clients SET ${sets.join(", ")} WHERE id = ?`).run(...args);
    if (!result.changes) return res.status(404).json({ error: "Not found" });
    db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
      req.user.email,
      `Updated client ${req.params.id}`,
      "Clients"
    );
    res.json({ ok: true });
  });

  app.get("/api/admin/users/:userId/access", auth, requireRole("admin"), (req, res) => {
    const { userId } = req.params;
    const { clientId } = req.query;
    const target = db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").get(userId);
    if (!target) return res.status(404).json({ error: "User not found" });
    if (!clientId) {
      return res.json({ overrides: allUserOverrides(userId) });
    }
    const clientRow = db.prepare("SELECT * FROM clients WHERE id = ?").get(clientId);
    if (!clientRow) return res.status(404).json({ error: "Client not found" });
    const client = rowToClient(clientRow);
    const roleModules = roleModuleDefaults(target.role);
    const overrides = userOverridesForClient(userId, clientId);
    const base = computeEffectiveModules({
      role: target.role,
      roleModules,
      client,
      userOverrides: null,
    });
    const effective = computeEffectiveModules({
      role: target.role,
      roleModules,
      client,
      userOverrides: overrides,
    });
    res.json({ base, effective, overrides: overrides || {} });
  });

  app.put("/api/admin/users/:userId/access", auth, requireRole("admin"), (req, res) => {
    const { userId } = req.params;
    const { clientId, modules } = req.body || {};
    if (!clientId || !modules || typeof modules !== "object") {
      return res.status(400).json({ error: "clientId and modules required" });
    }
    const target = db.prepare("SELECT id, email, role FROM users WHERE id = ?").get(userId);
    if (!target) return res.status(404).json({ error: "User not found" });
    const clientExists = db.prepare("SELECT id FROM clients WHERE id = ?").get(clientId);
    if (!clientExists) return res.status(404).json({ error: "Client not found" });

    const sparse = modules;
    const keys = Object.keys(sparse);
    if (!keys.length) {
      db.prepare("DELETE FROM user_client_modules WHERE user_id = ? AND client_id = ?").run(userId, clientId);
    } else {
      db.prepare(
        `INSERT INTO user_client_modules (user_id, client_id, modules_json, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(user_id, client_id) DO UPDATE SET
           modules_json = excluded.modules_json,
           updated_at = excluded.updated_at`
      ).run(userId, clientId, JSON.stringify(sparse));
    }
    db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
      req.user.email,
      `Set module overrides for ${target.email} on ${clientId}`,
      "Access"
    );
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

  app.post("/api/admin/voter-files/ingest", auth, requireRole("admin"), async (req, res) => {
    const { clientId, filePath, source, link } = req.body || {};
    if (!clientId || !filePath) return res.status(400).json({ error: "clientId and filePath required" });
    try {
      const manifest = await ingestVoterFile({ clientId, sourcePath: filePath, source, link: !!link });
      registerVoterFileInDb(db, { clientId, manifest });
      db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
        req.user.email,
        `Ingested voter file for ${clientId}: ${manifest.source} (${manifest.recordCount} records)`,
        "Data"
      );
      res.status(201).json({ ok: true, manifest });
    } catch (e) {
      res.status(400).json({ error: e.message || "Ingest failed" });
    }
  });

  app.post("/api/admin/voter-files/geocode", auth, requireRole("admin"), async (req, res) => {
    const { clientId } = req.body || {};
    if (!clientId) return res.status(400).json({ error: "clientId required" });
    try {
      const result = await geocodeClientVoters(clientId);
      db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
        req.user.email,
        `Geocoded voter file for ${clientId}: ${result.geocodedCount} voters`,
        "Data"
      );
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(400).json({ error: e.message || "Geocode failed" });
    }
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
