import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const COOKIE = "keel_token";
const SHORT_TTL_SECONDS = 8 * 60 * 60;            // 8h
const LONG_TTL_SECONDS  = 30 * 24 * 60 * 60;      // 30d

export function signToken(user, { remember = false } = {}) {
  const expiresIn = remember
    ? LONG_TTL_SECONDS
    : (Number(process.env.JWT_EXPIRES_IN_SECONDS) || SHORT_TTL_SECONDS);
  return jwt.sign(
    { sub: user.id, role: user.role, clientId: user.client_id || user.clientId, remember },
    process.env.JWT_SECRET || "dev-only-change-me",
    { expiresIn }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET || "dev-only-change-me");
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
    maxAge: (remember ? LONG_TTL_SECONDS : SHORT_TTL_SECONDS) * 1000,
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
                system_admin AS systemAdmin, title, location, about, phone, photo
         FROM users WHERE id = ?`
      ).get(payload.sub);
      if (user) user.systemAdmin = !!user.systemAdmin;
      if (!user) return res.status(401).json({ error: "Unauthorized" });
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
