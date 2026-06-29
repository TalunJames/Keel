import "dotenv/config";
import { openDb } from "./db.js";
import { getSetupStatus } from "./bootstrap.js";

const db = openDb();
const status = getSetupStatus(db);

if (status.needsSetup) {
  console.log("Bootstrap admin is awaiting first-boot setup at:", status.email);
  console.log("Open the app URL — you will be prompted to create a password.");
  process.exit(0);
}

const count = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
if (count > 0) {
  console.log("Users already exist — nothing to seed.");
  process.exit(0);
}

console.log("No users and no pending bootstrap account.");
console.log("Restart the API — bootstrap admin is created automatically on an empty database.");
console.log("Set BOOTSTRAP_ADMIN_EMAIL in .env to change the default administrator email.");
