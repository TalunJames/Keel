import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { parsePreferences } from "./user-prefs.js";

const COOKIE = "keel_token";
const SHORT_TTL_SECONDS = 8 * 60 * 60;            // 8h
const LONG_TTL_SECONDS  = 30 * 24 * 60 * 60;      // 30d

// Resolve the signing secret once, at startup. In production a missing secret
// is a hard failure — never fall back to a shared, source-visible default that
// would let anyone forge an admin token. In dev we allow an ephemeral secret.
const JWT_SECRET = (() => {
  const s = process.env.JWT_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET must be set to a strong random value (>=16 chars) in production."
    );
  }
  console.warn("[auth] JWT_SECRET unset — using an insecure ephemeral dev secret. Do NOT use in production.");
  return "dev-only-" + Math.random().toString(36).slice(2);
})();

// Effective token lifetime. JWT_EXPIRES_IN_SECONDS, if set, caps BOTH the short
// session and the "remember me" token, so shortening it actually takes effect.
function ttlSeconds(remember) {
  const envTtl = Number(process.env.JWT_EXPIRES_IN_SECONDS) || 0;
  if (remember) return envTtl > 0 ? Math.min(LONG_TTL_SECONDS, envTtl) : LONG_TTL_SECONDS;
  return envTtl > 0 ? envTtl : SHORT_TTL_SECONDS;
}

export function signToken(user, { remember = false } = {}) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      clientId: user.client_id || user.clientId,
      tv: user.token_version ?? user.tokenVersion ?? 0,
      remember,
    },
    JWT_SECRET,
    { expiresIn: ttlSeconds(remember) }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function resolveCookieSecure(req) {
  if (process.env.COOKIE_SECURE === "0") return false;
  if (process.env.COOKIE_SECURE === "1") return true;
  if (req?.secure) return true;
  const proto = req?.headers?.["x-forwarded-proto"];
  if (proto && String(proto).split(",")[0].trim() === "https") return true;
  return process.env.NODE_ENV === "production";
}

export function setAuthCookie(res, token, { remember = false, req } = {}) {
  const secure = resolveCookieSecure(req);
  const opts = {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: ttlSeconds(remember) * 1000,
    path: "/",
  };
  res.cookie(COOKIE, token, opts);
}

export function clearAuthCookie(res, req) {
  res.clearCookie(COOKIE, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: resolveCookieSecure(req),
  });
}

export function tokenFromReq(req) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return req.cookies?.[COOKIE] || null;
}

export function requireAuth(db) {
  return (req, res, next) => {
    try {
      const token = tokenFromReq(req);
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const payload = verifyToken(token);
      const user = db.prepare(
        `SELECT id, email, name, team, role, client_id AS clientId,
                system_admin AS systemAdmin, is_designer AS isDesigner,
                token_version AS tokenVersion,
                title, location, about, phone, photo,
                preferences_json AS preferencesJson
         FROM users WHERE id = ?`
      ).get(payload.sub);
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      // Reject tokens minted before the user's credentials/privileges last
      // changed (password reset, role/admin change, forced logout).
      if ((payload.tv ?? 0) !== (user.tokenVersion ?? 0)) {
        return res.status(401).json({ error: "Session expired" });
      }
      user.systemAdmin = !!user.systemAdmin;
      user.isDesigner = !!user.isDesigner;
      user.preferences = parsePreferences(user.preferencesJson);
      delete user.tokenVersion;
      delete user.preferencesJson;
      req.user = user;
      next();
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }
  };
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

export { COOKIE };
