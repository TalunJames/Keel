import { randomUUID } from "crypto";

/** Sentinel stored until the owner completes first-boot setup. Never valid bcrypt. */
export const BOOTSTRAP_PENDING_HASH = "!BOOTSTRAP_PENDING!";

export function getBootstrapEmail() {
  return (process.env.BOOTSTRAP_ADMIN_EMAIL || "cjames@fogsignal.co").trim().toLowerCase();
}

export function getBootstrapName() {
  return process.env.BOOTSTRAP_ADMIN_NAME || "Carter James";
}

export function isBootstrapPending(passwordHash) {
  return passwordHash === BOOTSTRAP_PENDING_HASH;
}

export function getSetupStatus(db) {
  const email = getBootstrapEmail();
  const user = db.prepare(
    "SELECT id, email, name, password_hash AS passwordHash FROM users WHERE email = ? COLLATE NOCASE"
  ).get(email);

  if (!user) {
    return { needsSetup: false };
  }

  if (process.env.BOOTSTRAP_FORCE_RESET === "1") {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(BOOTSTRAP_PENDING_HASH, user.id);
    return { needsSetup: true, email: user.email, name: user.name || getBootstrapName() };
  }

  if (!isBootstrapPending(user.passwordHash)) {
    return { needsSetup: false };
  }

  return { needsSetup: true, email: user.email, name: user.name || getBootstrapName() };
}

export function ensureBootstrapAdmin(db) {
  const email = getBootstrapEmail();
  const name = getBootstrapName();
  const total = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  const existing = db.prepare(
    "SELECT id, email, password_hash AS passwordHash, role, system_admin AS systemAdmin FROM users WHERE email = ? COLLATE NOCASE"
  ).get(email);
  const systemAdminCount = db.prepare("SELECT COUNT(*) AS n FROM users WHERE system_admin = 1").get().n;

  if (process.env.BOOTSTRAP_FORCE_RESET === "1" && existing) {
    db.prepare(
      "UPDATE users SET password_hash = ?, role = 'admin', system_admin = 1 WHERE id = ?"
    ).run(BOOTSTRAP_PENDING_HASH, existing.id);
    db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
      email,
      "Bootstrap password reset requested (BOOTSTRAP_FORCE_RESET)",
      "System"
    );
    return;
  }

  if (!existing && total === 0) {
    const id = randomUUID();
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, team, role, client_id, system_admin)
       VALUES (?, ?, ?, ?, ?, 'admin', NULL, 1)`
    ).run(id, email, BOOTSTRAP_PENDING_HASH, name, "Operations");
    db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
      email,
      "Bootstrap admin account created — awaiting first-boot password",
      "System"
    );
    return;
  }

  if (existing && systemAdminCount === 0) {
    db.prepare(
      "UPDATE users SET role = 'admin', system_admin = 1 WHERE id = ?"
    ).run(existing.id);
    db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
      email,
      "Promoted bootstrap admin (no system admin was configured)",
      "System"
    );
  } else if (existing && (!existing.systemAdmin || existing.role !== "admin")) {
    db.prepare(
      "UPDATE users SET role = 'admin', system_admin = 1 WHERE id = ?"
    ).run(existing.id);
    db.prepare("INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)").run(
      email,
      "Ensured bootstrap account has system administrator access",
      "System"
    );
  }
}
