import {
  assignedEmail,
  rushPoolEmail,
  claimedEmail,
  commentEmail,
  proofReadyEmail,
  dueReminderEmail,
  inviteEmail,
} from "./mail-templates.js";
import { roleLabel, roleDescription, keelOverview } from "./invites.js";

const TEMPLATES = {
  assigned: assignedEmail,
  rush_pool: rushPoolEmail,
  claimed: claimedEmail,
  comment: commentEmail,
  proof_ready: proofReadyEmail,
  due_reminder: dueReminderEmail,
};

let transporter = null;

function isGoogleSmtpRelay(host) {
  return /smtp-relay\.gmail\.com$/i.test(String(host || "").trim());
}

/** Google SMTP relay rejects Docker's default EHLO hostname (container id). */
function smtpEhloName() {
  const explicit = (process.env.SMTP_NAME || "").trim();
  if (explicit) return explicit;
  try {
    const primary = appUrls()[0];
    if (primary) return new URL(primary).hostname;
  } catch { /* ignore */ }
  return "keel.fogsignalstrategies.com";
}

async function getTransporter() {
  if (transporter) return transporter;
  if (process.env.MAIL_ENABLED !== "1") return null;
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  const relay = isGoogleSmtpRelay(host);
  const useAuth = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
  const ehloName = smtpEhloName();
  if (relay && !useAuth) {
    console.log(`[mail] Google Workspace SMTP relay (EHLO ${ehloName}, IP allowlist must match egress)`);
  }

  const nodemailer = await import("nodemailer");
  const timeoutMs = Number(process.env.SMTP_TIMEOUT_MS) || 10000;
  transporter = nodemailer.createTransport({
    name: ehloName,
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "1",
    // Google SMTP relay requires TLS on port 587.
    requireTLS: relay || process.env.SMTP_REQUIRE_TLS === "1",
    auth: useAuth
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" }
      : undefined,
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
  });
  return transporter;
}

// APP_URL may be comma-separated; first entry is the canonical link in outbound mail.
function appUrls() {
  const raw = process.env.APP_URL || "http://localhost:5173";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function appBaseUrl() {
  return appUrls()[0] || "http://localhost:5173";
}

function appPath(base, path) {
  return `${base.replace(/\/$/, "")}${path}`;
}

export function designAppUrl(requestId) {
  return appPath(appBaseUrl(), `/#design/${requestId}`);
}

function inviteLink(base, token) {
  return appPath(base, `/?invite=${encodeURIComponent(token)}`);
}

export function inviteAppUrl(token) {
  return inviteLink(appBaseUrl(), token);
}

function inviteAlternateUrls(token) {
  return appUrls().slice(1).map((base) => inviteLink(base, token));
}

/** SMTP envelope MAIL FROM (Google relay rejects empty/mismatched envelope). */
function smtpEnvelopeFrom(fromHeader) {
  const explicit = (process.env.SMTP_ENVELOPE_FROM || "").trim();
  if (explicit) return explicit;
  const raw = String(fromHeader || "").trim();
  const bracketed = raw.match(/<([^>]+)>/);
  return (bracketed ? bracketed[1] : raw).trim();
}

export async function sendMail({ to, subject, text, html, eventType = "general" }) {
  const from = process.env.SMTP_FROM || "keel@localhost";
  const envelopeFrom = smtpEnvelopeFrom(from);
  let error = null;
  let sent = false;

  // Mail disabled: report honestly (sent: false) instead of pretending the
  // message went out — otherwise invites flash "sent" and the link is lost
  // forever. Print the body so the operator can copy the invite URL from logs.
  if (process.env.MAIL_ENABLED !== "1") {
    console.log(`[mail:dev] MAIL_ENABLED is off — ${eventType} → ${to} NOT sent. Body:\n${text}`);
    return {
      sent: false,
      error: "Email delivery is disabled (MAIL_ENABLED is not set). The message, including any invite link, was printed to the server log.",
    };
  }

  try {
    const tx = await getTransporter();
    if (tx) {
      await tx.sendMail({
        from,
        to,
        subject,
        text,
        html,
        envelope: { from: envelopeFrom, to },
      });
      sent = true;
      console.log(`[mail] ${eventType} → ${to} (from ${from}, envelope ${envelopeFrom})`);
    } else {
      error = "SMTP not configured (MAIL_ENABLED=1 but transporter unavailable)";
      console.error(`[mail] ${error}`);
    }
  } catch (e) {
    error = [e.message, e.response].filter(Boolean).join(" | ");
    console.error(`[mail] failed ${eventType} → ${to} (EHLO ${smtpEhloName()}):`, error);
  }

  return { sent: sent && !error, error };
}

export async function sendInviteMail({ to, data }) {
  const { subject, text, html } = inviteEmail(data);
  return sendMail({ to, subject, text, html, eventType: "user_invite" });
}

export function buildInviteMailData({ user, token, expiresAt, invitedBy }) {
  const base = appBaseUrl().replace(/\/$/, "");
  return {
    name: user.name,
    roleLabel: roleLabel(user.role),
    roleDescription: roleDescription(user.role, { clientName: user.clientName }),
    keelOverview: keelOverview(),
    clientName: user.clientName || null,
    invitedBy,
    inviteUrl: inviteAppUrl(token),
    alternateInviteUrls: inviteAlternateUrls(token),
    expiresAt,
    logoUrl: `${base}/logo-wordmark-white.png`,
  };
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
