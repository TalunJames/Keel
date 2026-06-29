import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ensureBootstrapAdmin } from "./bootstrap.js";

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
  seedDefaultModules(db);
  seedDefaultSettings(db);
  ensureBootstrapAdmin(db);
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
  enabled: true,
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
