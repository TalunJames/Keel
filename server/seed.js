import "dotenv/config";
import { randomUUID } from "crypto";
import { openDb } from "./db.js";
import { hashPassword } from "./auth.js";

const db = openDb();
const count = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;

if (count > 0) {
  console.log("Users already exist — skipping seed.");
  process.exit(0);
}

const email = process.env.ADMIN_EMAIL || "admin@fogsignal.co";
const password = process.env.ADMIN_PASSWORD;
if (!password || password === "change-me-on-first-login") {
  console.error("Set ADMIN_PASSWORD in .env before running db:seed");
  process.exit(1);
}

async function main() {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, name, team, role, client_id)
     VALUES (?, ?, ?, ?, ?, 'admin', NULL)`
  ).run(
    id,
    email,
    await hashPassword(password),
    process.env.ADMIN_NAME || "Keel Administrator",
    "Operations"
  );

  db.prepare(
    "INSERT INTO audit_log (who, what, category) VALUES (?, ?, ?)"
  ).run(email, "Initial admin account created via db:seed", "System");

  console.log("Created admin user:", email);
  console.log("Sign in at the app URL with these credentials, then create clients and users in Admin Console.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
