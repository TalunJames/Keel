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
  // Bound how long a hung/slow SMTP server can tie up a send. Without these,
  // a stalled connection blocks indefinitely.
  const timeoutMs = Number(process.env.SMTP_TIMEOUT_MS) || 10000;
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "1",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" }
      : undefined,
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
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

/**
 * Fire-and-forget wrapper: dispatch a notification batch without blocking the
 * caller (HTTP request handler). Delivery failures are still recorded in
 * design_notification_log by sendDesignMail; anything unexpected is logged.
 * Returns a promise so callers/tests can await it if they want to.
 */
function dispatchNotifications(recipients, send) {
  const work = Promise.allSettled(recipients.map(send)).catch((e) => {
    console.error("[mail] notification batch error:", e?.message || e);
  });
  // Don't let a rejection become an unhandled promise rejection.
  work.catch(() => {});
  return work;
}

export function notifyDesigners(db, { requestId, eventType, data, excludeEmail }) {
  const designers = db.prepare(
    `SELECT email, name FROM users WHERE is_designer = 1 AND role IN ('staff', 'admin')`
  ).all();
  const targets = designers.filter((d) => !(excludeEmail && d.email === excludeEmail));
  return dispatchNotifications(targets, (d) =>
    sendDesignMail(db, { requestId, eventType, to: d.email, data })
  );
}

export function notifyClientUsers(db, clientId, { requestId, eventType, data }) {
  const users = db.prepare(
    `SELECT email FROM users WHERE role = 'client' AND client_id = ?`
  ).all(clientId);
  return dispatchNotifications(users, (u) =>
    sendDesignMail(db, { requestId, eventType, to: u.email, data })
  );
}
