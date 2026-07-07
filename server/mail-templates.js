import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INVITE_HTML_TEMPLATE = readFileSync(
  join(__dirname, "templates", "keel-invite.email.html"),
  "utf8",
);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function formatInviteExpiry(expiresAt) {
  if (!expiresAt) return "";
  return new Date(expiresAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function alternateLinkBlock(secondaryUrl) {
  if (!secondaryUrl) return "";
  const href = escapeAttr(secondaryUrl);
  const label = escapeHtml(secondaryUrl);
  return [
    `<p style="margin:0 0 6px; font-family:'Helvetica Neue',Arial,sans-serif; font-size:13px; line-height:1.6; color:#6A7580;">Keel is also available at:</p>`,
    `<p style="margin:0 0 20px; font-family:'Helvetica Neue',Arial,sans-serif; font-size:13px; line-height:1.5; word-break:break-all;"><a class="keel-alt" href="${href}" style="color:#1A3A5C; text-decoration:underline; text-decoration-thickness:1px; text-underline-offset:2px;">${label}</a></p>`,
  ].join("");
}

function renderInviteHtml({
  name,
  roleLabel,
  roleDescription,
  invitedBy,
  inviteUrl,
  alternateInviteUrls,
  expiresAt,
  logoUrl,
}) {
  const secondaryUrl = alternateInviteUrls?.[0] || "";
  const tokens = {
    recipient_name: escapeHtml(name || "there"),
    inviter_name: escapeHtml(invitedBy || "Your team"),
    role: escapeHtml(roleLabel || ""),
    role_line_1: escapeHtml(roleDescription?.[0] || ""),
    role_line_2: escapeHtml(roleDescription?.[1] || ""),
    primary_url: escapeAttr(inviteUrl || ""),
    expiry_date: escapeHtml(formatInviteExpiry(expiresAt)),
    logo_url: escapeAttr(logoUrl || ""),
    alternate_link_block: alternateLinkBlock(secondaryUrl),
  };

  let html = INVITE_HTML_TEMPLATE;
  for (const [key, value] of Object.entries(tokens)) {
    html = html.replaceAll(`{{${key}}}`, value);
  }
  return html;
}

export function assignedEmail({ title, clientName, due, appUrl }) {
  return {
    subject: `Assigned: ${title}`,
    text: [
      `You've been assigned a design request.`,
      ``,
      `Title: ${title}`,
      `Client: ${clientName}`,
      due ? `Due: ${due}` : "",
      ``,
      appUrl ? `Open in Keel: ${appUrl}` : "",
    ].filter(Boolean).join("\n"),
  };
}

export function rushPoolEmail({ title, priority, clientName, appUrl }) {
  return {
    subject: `New ${priority} request in pool: ${title}`,
    text: [
      `A new ${priority} design request is available in the unassigned pool.`,
      ``,
      `Title: ${title}`,
      `Client: ${clientName}`,
      ``,
      appUrl ? `Claim in Keel: ${appUrl}` : "",
    ].join("\n"),
  };
}

export function claimedEmail({ title, appUrl }) {
  return {
    subject: `You claimed: ${title}`,
    text: [
      `You successfully claimed this design request.`,
      ``,
      `Title: ${title}`,
      ``,
      appUrl ? `Open in Keel: ${appUrl}` : "",
    ].join("\n"),
  };
}

export function commentEmail({ title, authorName, clientName, excerpt, appUrl }) {
  return {
    subject: `${clientName || "Client"} commented on ${title}`,
    text: [
      `${authorName} left a comment on "${title}".`,
      excerpt ? `\n"${excerpt}"` : "",
      ``,
      appUrl ? `View in Keel: ${appUrl}` : "",
    ].join("\n"),
  };
}

export function proofReadyEmail({ title, clientName, appUrl }) {
  return {
    subject: `Proof ready: ${title}`,
    text: [
      `A new proof is ready for your review.`,
      ``,
      `Title: ${title}`,
      `Client: ${clientName}`,
      ``,
      appUrl ? `Review in Keel: ${appUrl}` : "",
    ].join("\n"),
  };
}

export function dueReminderEmail({ title, due, appUrl }) {
  return {
    subject: `Reminder: ${title} due ${due}`,
    text: [
      `This design request is due soon.`,
      ``,
      `Title: ${title}`,
      `Due: ${due}`,
      ``,
      appUrl ? `Open in Keel: ${appUrl}` : "",
    ].join("\n"),
  };
}

export function inviteEmail({
  name,
  roleLabel,
  roleDescription,
  keelOverview,
  clientName,
  invitedBy,
  inviteUrl,
  alternateInviteUrls,
  expiresAt,
  logoUrl,
}) {
  const expiry = formatInviteExpiry(expiresAt);
  const intro = invitedBy
    ? `${invitedBy} has invited you to join Keel — the internal workspace for Fog Signal Strategies, and a steady signal through noisy weeks.`
    : `You've been invited to join Keel — the internal workspace for Fog Signal Strategies, and a steady signal through noisy weeks.`;

  const lines = [
    `Hi ${name || "there"},`,
    ``,
    intro,
    ``,
    `WHAT IS KEEL`,
    ...(keelOverview || []).map((line) => `• ${line}`),
    ``,
    `YOUR ROLE · ${roleLabel}`,
    ...(roleDescription || []).map((line) => `• ${line}`),
  ];

  if (clientName) {
    lines.push(``, `Client account: ${clientName}`);
  }

  lines.push(
    ``,
    `Create your account and set a password using the link below:`,
    inviteUrl || "",
  );

  if (alternateInviteUrls?.length) {
    lines.push(
      ``,
      `Keel is also available at:`,
      ...alternateInviteUrls,
    );
  }

  lines.push(
    ``,
    expiry ? `This link expires on ${expiry}.` : "",
    ``,
    `If you weren't expecting this invitation, you can ignore this email — no account will be created.`,
    ``,
    `— Fog Signal Strategies`,
  );

  return {
    subject: "You're invited to Keel — the Fog Signal Strategies workspace",
    text: lines.filter((line) => line !== "").join("\n"),
    html: renderInviteHtml({
      name,
      roleLabel,
      roleDescription,
      invitedBy,
      inviteUrl,
      alternateInviteUrls,
      expiresAt,
      logoUrl,
    }),
  };
}
