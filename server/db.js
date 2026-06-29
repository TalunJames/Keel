import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ensureBootstrapAdmin } from "./bootstrap.js";
import { syncPortalPolls } from "./polling/ingest.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

export function openDb() {
  const dbPath = process.env.DATABASE_PATH || path.join(root, "data", "keel.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      team TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL CHECK (role IN ('staff', 'admin', 'client')),
      client_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      system_admin INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      about TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      photo TEXT
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tag TEXT NOT NULL,
      initials TEXT NOT NULL,
      account TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT 'var(--fs-navy)',
      audience TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_modules (
      role TEXT PRIMARY KEY,
      modules_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_client_modules (
      user_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      modules_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, client_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pin INTEGER NOT NULL DEFAULT 0,
      audience_json TEXT NOT NULL,
      from_name TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      tag TEXT NOT NULL DEFAULT '',
      client_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      label TEXT NOT NULL,
      due TEXT NOT NULL DEFAULT '',
      done INTEGER NOT NULL DEFAULT 0,
      kind TEXT NOT NULL DEFAULT 'ops',
      client_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      ends_at TEXT,
      client_id TEXT,
      kind TEXT NOT NULL DEFAULT 'meeting',
      location TEXT,
      payload_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS design_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      client_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'normal',
      due TEXT,
      assignee TEXT,
      payload_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      client_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      amount REAL,
      payload_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS media_mentions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      outlet TEXT NOT NULL,
      headline TEXT NOT NULL,
      client_id TEXT,
      sentiment TEXT,
      published_at TEXT,
      url TEXT,
      excerpt TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stakeholders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      org TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      client_id TEXT NOT NULL,
      tier INTEGER NOT NULL DEFAULT 2,
      status TEXT NOT NULL DEFAULT 'prospect',
      email TEXT,
      phone TEXT,
      owner TEXT,
      payload_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      client_id TEXT,
      account TEXT,
      author TEXT,
      kind TEXT,
      tags_json TEXT,
      url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS onboarding_programs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      payload_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS polls (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      client_id TEXT,
      n INTEGER,
      moe TEXT,
      date_range TEXT,
      unlocked INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS election_races (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      client_id TEXT,
      state TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled',
      payload_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS voter_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL,
      source TEXT NOT NULL,
      record_count INTEGER NOT NULL DEFAULT 0,
      refreshed_at TEXT NOT NULL,
      storage_path TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS voter_cuts (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      filters_json TEXT NOT NULL,
      query TEXT NOT NULL DEFAULT '',
      record_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      who TEXT NOT NULL,
      what TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'System',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  ensureUserColumns(db);
  ensureClientColumns(db);
  ensureDesignColumns(db);
  ensureDesignTables(db);
  seedDefaultModules(db);
  seedDefaultSettings(db);
  seedDesignData(db);
  ensureBootstrapAdmin(db);
  syncPortalPolls(db, root);
}

function ensureUserColumns(db) {
  const cols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
  const add = (name, ddl) => {
    if (!cols.includes(name)) db.exec(`ALTER TABLE users ADD COLUMN ${ddl}`);
  };
  add("system_admin", "system_admin INTEGER NOT NULL DEFAULT 0");
  add("title",        "title TEXT NOT NULL DEFAULT ''");
  add("location",     "location TEXT NOT NULL DEFAULT ''");
  add("about",        "about TEXT NOT NULL DEFAULT ''");
  add("phone",        "phone TEXT NOT NULL DEFAULT ''");
  add("photo",        "photo TEXT");
  add("is_designer",  "is_designer INTEGER NOT NULL DEFAULT 0");
}

function ensureDesignColumns(db) {
  const cols = db.prepare("PRAGMA table_info(design_requests)").all().map((c) => c.name);
  const add = (name, ddl) => {
    if (!cols.includes(name)) db.exec(`ALTER TABLE design_requests ADD COLUMN ${ddl}`);
  };
  add("assignee_id", "assignee_id TEXT");
  add("submitted_by", "submitted_by TEXT");
}

function ensureDesignTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS design_proofs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      version TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      file_url TEXT,
      mime_type TEXT,
      uploaded_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (request_id) REFERENCES design_requests(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS design_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      proof_id INTEGER,
      author_id TEXT,
      author_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '',
      text TEXT NOT NULL,
      marker_x REAL,
      marker_y REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (request_id) REFERENCES design_requests(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS design_notification_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER,
      recipient_email TEXT NOT NULL,
      event_type TEXT NOT NULL,
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      error TEXT
    );
  `);
}

function seedDesignData(db) {
  const n = db.prepare("SELECT COUNT(*) AS n FROM design_requests").get().n;
  if (n > 0) return;

  const clients = db.prepare("SELECT id, name FROM clients WHERE active = 1 LIMIT 3").all();
  const clientId = clients[0]?.id || "demo";
  const clientName = clients[0]?.name || "Demo Client";

  const designers = db.prepare(
    `SELECT id, name FROM users WHERE role IN ('staff', 'admin') ORDER BY name LIMIT 2`
  ).all();
  if (designers.length) {
    const mark = db.prepare("UPDATE users SET is_designer = 1 WHERE id = ?");
    for (const d of designers.slice(0, 2)) mark.run(d.id);
  }

  const insert = db.prepare(
    `INSERT INTO design_requests (title, client_id, status, priority, due, assignee_id, submitted_by, payload_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const samples = [
    {
      title: "Coalition launch one-pager",
      status: "In Design",
      priority: "Standard",
      due: "2026-07-05",
      assigneeId: designers[0]?.id || null,
      payload: { assetType: "Print — one-pager / leave-behind", audience: "Suburban voters 35–54", cta: "Renewal starts locally." },
    },
    {
      title: "30s TV spot — lighthouse concept",
      status: "Proofing",
      priority: "Rush",
      due: "2026-07-02",
      assigneeId: designers[1]?.id || designers[0]?.id || null,
      payload: { assetType: "Video — broadcast TV", audience: "OH suburban women 35–54", cta: "Steady leadership for Ohio." },
    },
    {
      title: "Direct mail piece #4",
      status: "Brief Review",
      priority: "Standard",
      due: "2026-07-10",
      assigneeId: null,
      payload: { assetType: "Print — direct mail", audience: "Likely voters", cta: "Vote early." },
    },
    {
      title: "Social cut-downs (6 assets)",
      status: "Intake",
      priority: "Election critical",
      due: "2026-07-01",
      assigneeId: null,
      payload: { assetType: "Social — static", audience: "Digital persuasion", cta: "Join the movement." },
    },
    {
      title: "Memo cover series — June batch",
      status: "Approved",
      priority: "Standard",
      due: "2026-06-20",
      assigneeId: designers[0]?.id || null,
      payload: { assetType: "Print — one-pager / leave-behind" },
    },
  ];

  for (const s of samples) {
    insert.run(
      s.title,
      clientId,
      s.status,
      s.priority,
      s.due,
      s.assigneeId,
      null,
      JSON.stringify(s.payload),
    );
  }

  const reqIds = db.prepare("SELECT id FROM design_requests ORDER BY id").all();
  const proofing = reqIds.find((_, i) => samples[i]?.status === "Proofing");
  if (proofing) {
    db.prepare(
      `INSERT INTO design_proofs (request_id, version, label, file_url, mime_type, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(proofing.id, "v1", "First cut", "", "video/mp4", designers[1]?.id || designers[0]?.id || null);
    db.prepare(
      `INSERT INTO design_proofs (request_id, version, label, file_url, mime_type, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(proofing.id, "v3", "Final mix", "", "video/mp4", designers[1]?.id || designers[0]?.id || null);
    db.prepare(
      `INSERT INTO design_comments (request_id, author_name, role, text, marker_x, marker_y)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(proofing.id, "Strategy lead", "staff", "Beam needs to read at thumbnail size.", 31, 24);
  }
}

function ensureClientColumns(db) {
  const cols = db.prepare("PRAGMA table_info(clients)").all().map((c) => c.name);
  const add = (name, ddl) => {
    if (!cols.includes(name)) db.exec(`ALTER TABLE clients ADD COLUMN ${ddl}`);
  };
  add("logo",         "logo TEXT");
  add("payload_json", "payload_json TEXT");
}

const DEFAULT_LOGIN_ANNOUNCEMENT = {
  enabled: false,
  title: "Welcome to Keel",
  body: "A steady signal through noisy weeks.",
  tone: "info",
};

function seedDefaultSettings(db) {
  const ins = db.prepare(
    "INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)"
  );
  ins.run("login_announcement", JSON.stringify(DEFAULT_LOGIN_ANNOUNCEMENT));
}

export { DEFAULT_LOGIN_ANNOUNCEMENT };

const DEFAULT_MODULES = {
  staff: { home: true, calendar: true, design: true, proposals: true, media: true, election: false, voter: true, polling: true, stakeholders: true, resources: true, onboarding: true },
  admin: { home: true, calendar: true, design: true, proposals: true, media: true, election: true, voter: true, polling: true, stakeholders: true, resources: true, onboarding: true },
  client: { home: true, calendar: true, design: true, proposals: false, media: false, election: false, voter: false, polling: true, stakeholders: false, resources: true, onboarding: false },
};

function seedDefaultModules(db) {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO user_modules (role, modules_json) VALUES (?, ?)"
  );
  for (const [role, modules] of Object.entries(DEFAULT_MODULES)) {
    insert.run(role, JSON.stringify(modules));
  }
}

export { DEFAULT_MODULES };
