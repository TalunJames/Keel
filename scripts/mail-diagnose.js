import "dotenv/config";
import { sendMail } from "../server/mail.js";
import os from "os";

const to = process.argv[2];
if (!to) {
  console.error("Usage: node scripts/mail-diagnose.js you@example.com");
  process.exit(1);
}

console.log("=== Keel mail diagnose ===");
console.log("MAIL_ENABLED:", process.env.MAIL_ENABLED);
console.log("SMTP_HOST:", process.env.SMTP_HOST);
console.log("SMTP_PORT:", process.env.SMTP_PORT);
console.log("SMTP_FROM:", process.env.SMTP_FROM);
console.log("SMTP_NAME:", process.env.SMTP_NAME || "(unset)");
console.log("os.hostname():", os.hostname());
console.log("APP_URL:", process.env.APP_URL);
console.log("");

const result = await sendMail({
  to,
  subject: "Keel SMTP diagnose",
  text: "If you received this, SMTP relay is working.",
  eventType: "diagnose",
});

if (result.error) {
  console.error("FAILED:", result.error);
  process.exit(1);
}

console.log("OK — test message sent to", to);
