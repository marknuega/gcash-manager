import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { query } from "./db.js";

const SECRET = process.env.JWT_SECRET || "dev-insecure-secret";
const TOKEN_TTL = "30d"; // long-lived: outlet staff stay logged in on their phone

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role, outlet_id: user.outlet_id },
    SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

export async function login(username, password) {
  const { rows } = await query(
    "SELECT * FROM app_users WHERE lower(username) = lower($1) AND is_active = true",
    [username]
  );
  const user = rows[0];
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;
  return user;
}

export function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

// Middleware: require a valid bearer token.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    req.user = jwt.verify(token, SECRET);
  } catch {
    return res.status(401).json({ error: "Session expired — please log in again" });
  }
  next();
}

// Middleware factory: require one of the given roles (e.g. admin-only screens).
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You don't have permission for this action" });
    }
    next();
  };
}

// Public-safe user object returned to the client (no password hash). Shaped to
// match the frontend's `session` object (id, name, username, role, outlet).
export function publicUser(u) {
  return { id: u.id, name: u.full_name, username: u.username, role: u.role, outlet: u.outlet_id };
}
