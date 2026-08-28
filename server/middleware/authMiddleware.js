// server/middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import { Server } from "node:http";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    const cookieToken = req.cookies?.fj_token || null;

    const token = bearerToken || cookieToken;

    if (!token) {
      // 🎯 LOUD LOG: See this in Railway
      console.log(`[AUTH-DEBUG] No token found for path: ${req.path}`);
      req.user = null;
      return next();
    }

    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;

    // 🎯 LOUD LOG: Confirming identity
    console.log(
      `[AUTH-DEBUG] User Identified: ${req.user.email} on ${req.path}`,
    );
    return next();
  } catch (err) {
    console.error("[AUTH-DEBUG] Token Verification Failed:", err.message);
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
