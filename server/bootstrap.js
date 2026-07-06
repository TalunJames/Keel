import { randomUUID, randomBytes } from "crypto";

/** Sentinel stored until the owner completes first-boot setup. Never valid bcrypt. */
export const BOOTSTRAP_PENDING_HASH = "!BOOTSTRAP_PENDING!";

const SETUP_COMPLETE_KEY = "setup_complete";

export function getBootstrapEmail() {
  const env = (process.env.BOOTSTRAP_ADMIN_EMAIL || "").trim().toLowerCase();
  if (env) return env;
  if (process.env.NODE_ENV === "production") {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL must be set (the first-boot admin's email address).");
  }
  return "admin@example.com"; // dev-only placeholder; never a real person's address
}

export function getBootstrapName() {
  return process.env.BOOTSTRAP_ADMIN_NAME || "Administrator";
}

// One-time token that gates first-boot setup so an anonymous visitor who reaches
// a fresh deploy can't claim the admin account. Generated at boot when setup is
// pending and printed to the server console (operator reads it from the logs).
let expectedSetupToken = null;

export function getExpectedSetupToken() {
  return expectedSetupToken;
}

export function verifySetupToken(provided) {
  return !!expectedSetupToken && typeof provided === "string" && provided === expectedSetupToken;
}

/** Call once at boot (after ensureBootstrapAdmin). Prints the token if setup is pending. */
export function initSetupToken(db) {
  const user = findBootstrapUser(db);
  const pending = !!user && (!isSetupComplete(db) || isBootstrapPending(user.passwordHash));
  if (!pending) {
    expectedSetupToken = null;
    return;
  }
  expectedSetupToken = randomBytes(24).toString("base64url");
  console.log("\n========================================================");
  console.log("  FIRST-BOOT SETUP TOKEN (enter this on the setup screen):");
  console.log(`  ${expectedSetupToken}`);
  console.log("========================================================\n");
}

/** Clears the token once setup has been completed. */
export function clearSetupToken() {
  expectedSetupToken = null;
}

export function isBootstrapPending(passwordHash) {
  return passwordHash === BOOTSTRAP_PENDING_HASH;
}

export function isSetupComplete(db) {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(SETUP_COMPLETE_KEY);
  return row?.value === "1";
}

export function markSetupComplete(db) {
  db.prepare(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, '1', datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = datetime('now')`
  ).run(SETUP_COMPLETE_KEY);
}

/** Bootstrap account by env email, or any admin before setup has completed. */
export function findBootstrapUser(db) {
  const email = getBootstrapEmail();
  const byEmail = db.prepare(
    `SELECT id, email, name, password_hash AS passwordHash, role, system_admin AS systemAdmin,
            team, client_id AS clientId, title, location, about, phone, photo
     FROM users WHERE email = ? COLLATE NOCASE`
  ).get(email);
  if (byEmail) return byEmail;

  if (!isSetupComplete(db)) {
    const firstAdmin = db.prepare(
      `SELECT id, email, name, password_hash AS passwordHash, role, system_admin AS systemAdmin,
              team, client_id AS clientId, title, location, about, phone, photo
       FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1`
    ).get();
    if (firstAdmin) return firstAdmin;
  }

  const admins = db.prepare(
    `SELECT id, email, name, password_hash AS passwordHash, role, system_admin AS systemAdmin,
            team, client_id AS clientId, title, location, about, phone, photo
     FROM users WHERE role = 'admin' ORDER BY created_at ASC`
  ).all();
  if (admins.length === 1) return admins[0];
  return null;
}

// Read-only: reports whether first-boot setup is still pending. It must NOT
// mutate state — it runs on every /api/setup/status poll and every login. The
// BOOTSTRAP_FORCE_RESET side effect lives in ensureBootstrapAdmin (boot-only).
export function getSetupStatus(db) {
  const user = findBootstrapUser(db);
  if (!user) return { needsSetup: false };

  const pending = !isSetupComplete(db) || isBootstrapPending(user.passwordHash);
  if (!pending) return { needsSetup: false };

  // Note: we intentionally do NOT return the admin email to unauthenticated
  // callers — it leaks the account identity. The setup screen collects it fresh.
  return { needsSetup: true, requiresToken: !!expectedSetupToken };
}

export function ensureBootstrapAdmin(db) {
  const email = getBootstrapEmail();
  const name = getBootstrapName();
  let existing = db.prepare(
    "SELECT id, email, password_hash AS passwordHash, role, system_admin AS systemAdmin FROM users WHERE email = ? COLLATE NOCASE"
  ).get(email);

  if (!existing) {
    const soleAdmin = db.prepare(
      "SELECT id, email, password_hash AS passwordHash, role, system_admin AS systemAdmin FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1"
    ).get();
    const adminCount = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;
    if (soleAdmin && adminCount === 1) {
      existing = soleAdmin;
    }
  }

  if (process.env.BOOTSTRAP_FORCE_RESET === "1" && existing) {
    db.prepare(
      "UPDATE users SET password_hash = ?, role = 'admin', system_admin = 1 WHERE id = ?"
    ).run(BOOTSTRAP_PENDING_HASH, existing.id);
    db.prepare("DELETE FROM app_settings WHERE key = ?").run(SETUP_COMPLETE_KEY);
    db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
      existing.email,
      "Bootstrap password reset requested (BOOTSTRAP_FORCE_RESET)",
      "System"
    );
    return;
  }

  if (!existing) {
    const id = randomUUID();
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, team, role, client_id, system_admin)
       VALUES (?, ?, ?, ?, ?, 'admin', NULL, 1)`
    ).run(id, email, BOOTSTRAP_PENDING_HASH, name, "Operations");
    db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
      email,
      "Bootstrap admin account created — awaiting first-boot setup",
      "System"
    );
    return;
  }

  if (!existing.systemAdmin || existing.role !== "admin") {
    db.prepare(
      "UPDATE users SET role = 'admin', system_admin = 1 WHERE id = ?"
    ).run(existing.id);
    db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
      existing.email,
      "Ensured bootstrap account has system administrator access",
      "System"
    );
  }
}
