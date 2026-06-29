import {
  assignedEmail,
  rushPoolEmail,
  claimedEmail,
  commentEmail,
  proofReadyEmail,
  dueReminderEmail,
} from "./mail-templates.js";

const TEMPLATES = {
  assigned: assignedEmail,
  rush_pool: rushPoolEmail,
  claimed: claimedEmail,
  comment: commentEmail,
  proof_ready: proofReadyEmail,
  due_reminder: dueReminderEmail,
};

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;
  if (process.env.MAIL_ENABLED !== "1") return null;
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const nodemailer = await import("nodemailer");
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "1",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" }
      : undefined,
  });
  return transporter;
}

function appBaseUrl() {
  return process.env.APP_URL || "http://localhost:5173";
}

export function designAppUrl(requestId) {
  return `${appBaseUrl()}/#design/${requestId}`;
}

export async function sendDesignMail(db, { requestId, eventType, to, data }) {
  const templateFn = TEMPLATES[eventType];
  if (!templateFn || !to) return { sent: false, reason: "no_template_or_recipient" };

  const { subject, text } = templateFn({ ...data, appUrl: requestId ? designAppUrl(requestId) : appBaseUrl() });
  const from = process.env.SMTP_FROM || "keel@localhost";
  let error = null;
  let sent = false;

  try {
    const tx = await getTransporter();
    if (tx) {
      await tx.sendMail({ from, to, subject, text });
      sent = true;
      console.log(`[mail] ${eventType} → ${to}`);
    } else {
      console.log(`[mail:dev] ${eventType} → ${to}\n${text}`);
    }
  } catch (e) {
    error = e.message;
    console.error(`[mail] failed ${eventType} → ${to}:`, e.message);
  }

  if (db && requestId) {
    db.prepare(
      `INSERT INTO design_notification_log (request_id, recipient_email, event_type, error)
       VALUES (?, ?, ?, ?)`
    ).run(requestId, to, eventType, error);
  }

  return { sent: sent || process.env.MAIL_ENABLED !== "1", error };
}

export async function notifyDesigners(db, { requestId, eventType, data, excludeEmail }) {
  const designers = db.prepare(
    `SELECT email, name FROM users WHERE is_designer = 1 AND role IN ('staff', 'admin')`
  ).all();
  for (const d of designers) {
    if (excludeEmail && d.email === excludeEmail) continue;
    await sendDesignMail(db, { requestId, eventType, to: d.email, data });
  }
}

export async function notifyClientUsers(db, clientId, { requestId, eventType, data }) {
  const users = db.prepare(
    `SELECT email FROM users WHERE role = 'client' AND client_id = ?`
  ).all(clientId);
  for (const u of users) {
    await sendDesignMail(db, { requestId, eventType, to: u.email, data });
  }
}
