import { randomUUID, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { hashPassword } from "./auth.js";

/** Sentinel stored until the invitee completes account setup. Never valid bcrypt. */
export const INVITE_PENDING_HASH = "!INVITE_PENDING!";

const INVITE_EXPIRY_DAYS = 7;

const ROLE_LABELS = {
  staff: "Staff",
  admin: "Admin / Partner",
  client: "Client",
};

const ROLE_DESCRIPTIONS = {
  staff: [
    "Work across client accounts on design requests, polling, voter data, calendar, and team resources.",
    "Collaborate with strategists, designers, and data leads inside one workspace.",
  ],
  admin: [
    "Full workspace access across all client accounts, including election night and the admin console.",
    "Manage users, clients, modules, and workspace settings for the team.",
  ],
  client: [
    "A dedicated client portal scoped to your account — design proofs, polling, calendar, and shared resources.",
    "Review work in progress and stay aligned with your Fog Signal team without email chains.",
  ],
};

const KEEL_OVERVIEW = [
  "Keel is the internal portal for Fog Signal Strategies — a steady signal through noisy weeks.",
  "It brings client workstreams, design requests, polling, calendar, and team resources into one place.",
];

export function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}

export function roleDescription(role, { clientName } = {}) {
  const lines = [...(ROLE_DESCRIPTIONS[role] || ROLE_DESCRIPTIONS.staff)];
  if (role === "client" && clientName) {
    lines[0] = `A dedicated client portal for ${clientName} — design proofs, polling, calendar, and shared resources.`;
  }
  return lines;
}

export function keelOverview() {
  return [...KEEL_OVERVIEW];
}

export function isInvitePending(passwordHash) {
  return passwordHash === INVITE_PENDING_HASH;
}

function inviteExpiryIso() {
  const d = new Date();
  d.setDate(d.getDate() + INVITE_EXPIRY_DAYS);
  return d.toISOString();
}

async function hashToken(token) {
  return bcrypt.hash(token, 10);
}

export async function verifyInviteToken(token, tokenHash) {
  if (!token || !tokenHash) return false;
  return bcrypt.compare(token, tokenHash);
}

function findActiveInvitation(db, userId) {
  return db.prepare(
    `SELECT id, token_hash AS tokenHash, expires_at AS expiresAt, accepted_at AS acceptedAt
     FROM user_invitations
     WHERE user_id = ? AND accepted_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`
  ).get(userId);
}

export function getInviteStatus(db, userId, passwordHash) {
  if (!isInvitePending(passwordHash)) return { pending: false };
  const inv = findActiveInvitation(db, userId);
  if (!inv) return { pending: true, expired: true };
  const expired = new Date(inv.expiresAt).getTime() < Date.now();
  return { pending: true, expired, invitationId: inv.id, expiresAt: inv.expiresAt };
}

export async function createUserInvite(db, {
  email,
  name,
  team,
  role,
  clientId,
  systemAdmin,
  isDesigner,
  invitedBy,
}) {
  const trimmedEmail = email.trim();
  const trimmedName = (name || "").trim();
  if (!trimmedEmail || !trimmedName || !role) {
    throw Object.assign(new Error("Missing required fields"), { status: 400 });
  }
  if (!["staff", "admin", "client"].includes(role)) {
    throw Object.assign(new Error("Invalid role"), { status: 400 });
  }
  if (role === "client" && !clientId) {
    throw Object.assign(new Error("Client account required for client role"), { status: 400 });
  }

  const existing = db.prepare(
    "SELECT id, password_hash AS passwordHash FROM users WHERE email = ? COLLATE NOCASE"
  ).get(trimmedEmail);

  let userId;
  if (existing) {
    if (!isInvitePending(existing.passwordHash)) {
      throw Object.assign(new Error("Email already exists"), { status: 409 });
    }
    userId = existing.id;
    db.prepare(
      `UPDATE users SET name = ?, team = ?, role = ?, client_id = ?, system_admin = ?, is_designer = ?
       WHERE id = ?`
    ).run(
      trimmedName,
      team || "",
      role,
      clientId || null,
      (systemAdmin && role === "admin") ? 1 : 0,
      (isDesigner && role !== "client") ? 1 : 0,
      userId,
    );
    db.prepare(
      "UPDATE user_invitations SET accepted_at = datetime('now') WHERE user_id = ? AND accepted_at IS NULL"
    ).run(userId);
  } else {
    userId = randomUUID();
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, team, role, client_id, system_admin, is_designer)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      trimmedEmail,
      INVITE_PENDING_HASH,
      trimmedName,
      team || "",
      role,
      clientId || null,
      (systemAdmin && role === "admin") ? 1 : 0,
      (isDesigner && role !== "client") ? 1 : 0,
    );
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = await hashToken(token);
  const inviteId = randomUUID();
  const expiresAt = inviteExpiryIso();

  db.prepare(
    `INSERT INTO user_invitations (id, user_id, token_hash, invited_by, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(inviteId, userId, tokenHash, invitedBy, expiresAt);

  const user = db.prepare(
    `SELECT u.id, u.email, u.name, u.role, u.team, u.client_id AS clientId,
            c.name AS clientName
     FROM users u
     LEFT JOIN clients c ON c.id = u.client_id
     WHERE u.id = ?`
  ).get(userId);

  return { token, user, expiresAt, inviteId };
}

export async function resendUserInvite(db, userId, invitedBy) {
  const row = db.prepare(
    `SELECT u.id, u.email, u.name, u.password_hash AS passwordHash, u.role, u.team,
            u.client_id AS clientId, c.name AS clientName
     FROM users u
     LEFT JOIN clients c ON c.id = u.client_id
     WHERE u.id = ?`
  ).get(userId);

  if (!row) {
    throw Object.assign(new Error("Not found"), { status: 404 });
  }
  if (!isInvitePending(row.passwordHash)) {
    throw Object.assign(new Error("This user has already accepted their invitation"), { status: 400 });
  }

  db.prepare(
    "UPDATE user_invitations SET accepted_at = datetime('now') WHERE user_id = ? AND accepted_at IS NULL"
  ).run(userId);

  const token = randomBytes(32).toString("base64url");
  const tokenHash = await hashToken(token);
  const inviteId = randomUUID();
  const expiresAt = inviteExpiryIso();

  db.prepare(
    `INSERT INTO user_invitations (id, user_id, token_hash, invited_by, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(inviteId, userId, tokenHash, invitedBy, expiresAt);

  return { token, user: row, expiresAt, inviteId };
}

export async function findInviteByToken(db, token) {
  if (!token || typeof token !== "string") return null;

  const rows = db.prepare(
    `SELECT i.id AS invitationId, i.token_hash AS tokenHash, i.expires_at AS expiresAt,
            i.accepted_at AS acceptedAt, i.invited_by AS invitedBy,
            u.id AS userId, u.email, u.name, u.role, u.team, u.password_hash AS passwordHash,
            u.client_id AS clientId, c.name AS clientName
     FROM user_invitations i
     JOIN users u ON u.id = i.user_id
     LEFT JOIN clients c ON c.id = u.client_id
     WHERE i.accepted_at IS NULL
     ORDER BY i.created_at DESC`
  ).all();

  for (const row of rows) {
    if (await verifyInviteToken(token, row.tokenHash)) {
      return row;
    }
  }
  return null;
}

export function invitePublicView(row) {
  if (!row) return null;
  const expired = new Date(row.expiresAt).getTime() < Date.now();
  return {
    email: row.email,
    name: row.name,
    role: row.role,
    roleLabel: roleLabel(row.role),
    roleDescription: roleDescription(row.role, { clientName: row.clientName }),
    keelOverview: keelOverview(),
    clientName: row.clientName || null,
    team: row.team || null,
    invitedBy: row.invitedBy || null,
    expiresAt: row.expiresAt,
    expired,
  };
}

export async function acceptInvite(db, token, { password, name }) {
  const row = await findInviteByToken(db, token);
  if (!row) {
    throw Object.assign(new Error("Invalid or expired invitation link"), { status: 404 });
  }
  if (!isInvitePending(row.passwordHash)) {
    throw Object.assign(new Error("This invitation has already been accepted"), { status: 400 });
  }
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    throw Object.assign(new Error("This invitation has expired. Ask your admin to send a new one."), { status: 410 });
  }
  if (!password || String(password).length < 8) {
    throw Object.assign(new Error("Password must be at least 8 characters"), { status: 400 });
  }

  const displayName = (name || row.name || "").trim();
  if (!displayName) {
    throw Object.assign(new Error("Name is required"), { status: 400 });
  }

  db.prepare("UPDATE users SET password_hash = ?, name = ? WHERE id = ?").run(
    await hashPassword(password),
    displayName,
    row.userId,
  );
  db.prepare(
    "UPDATE user_invitations SET accepted_at = datetime('now') WHERE id = ?"
  ).run(row.invitationId);

  return db.prepare(
    `SELECT id, email, name, team, role, client_id AS clientId,
            system_admin AS systemAdmin, is_designer AS isDesigner,
            title, location, about, phone, photo
     FROM users WHERE id = ?`
  ).get(row.userId);
}
