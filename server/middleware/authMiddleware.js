// server/middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import { requireJwtSecret } from "../config/auth.js";

export function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    const cookieToken = req.cookies?.fj_token || null;

    const token = bearerToken || cookieToken;

    if (!token) {
      req.user = null;
      return next();
    }

    const payload = jwt.verify(token, requireJwtSecret());
    req.user = payload;

    return next();
  } catch (err) {
    req.user = null;
    return next();
  }
}

export function authRequired(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }
  return next();
}

export default authRequired;
