import "dotenv/config";
import { sendMail } from "../server/mail.js";

const to = process.argv[2];
if (!to) {
  console.error("Usage: node scripts/test-mail.js you@example.com");
  process.exit(1);
}

if (process.env.MAIL_ENABLED !== "1") {
  console.error("Set MAIL_ENABLED=1 in .env first.");
  process.exit(1);
}
if (!process.env.SMTP_HOST) {
  console.error("Set SMTP_HOST in .env first.");
  process.exit(1);
}

const relay = /smtp-relay\.gmail\.com$/i.test(process.env.SMTP_HOST || "");
const useAuth = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
if (!relay && !useAuth) {
  console.error("Set SMTP_USER and SMTP_PASS, or use smtp-relay.gmail.com with IP allowlist.");
  process.exit(1);
}
if (relay && !useAuth) {
  console.log("SMTP relay mode: no auth — ensure your egress IP is allowlisted in Workspace admin.");
}

const from = process.env.SMTP_FROM || "keel@localhost";
const result = await sendMail({
  to,
  subject: "Keel SMTP test",
  text: [
    "If you received this, Keel can send mail through Gmail.",
    "",
    `From header: ${from}`,
    `SMTP user: ${process.env.SMTP_USER}`,
  ].join("\n"),
  eventType: "smtp_test",
});

if (result.error) {
  console.error("Send failed:", result.error);
  process.exit(1);
}

console.log(`Test email sent to ${to}`);
console.log(`From: ${from}`);
if (process.env.MAIL_ENABLED !== "1") {
  console.log("(MAIL_ENABLED is off — check server console for dev output instead.)");
}
