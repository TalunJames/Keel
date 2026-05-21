import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const COOKIE = "keel_token";

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, clientId: user.client_id },
    process.env.JWT_SECRET || "dev-only-change-me",
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
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

export function setAuthCookie(res, token) {
  const secure = process.env.NODE_ENV === "production";
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 8 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE, { path: "/" });
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
        "SELECT id, email, name, team, role, client_id AS clientId FROM users WHERE id = ?"
      ).get(payload.sub);
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
