// server/middleware/authMiddleware.js
import jwt from "jsonwebtoken";

export function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      req.user = null;
      return next();
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    req.user = payload;
    next();
  } catch (err) {
    console.error("[authMiddleware] jwt.verify failed:", err?.message);
    console.error(
      "[authMiddleware] hasAuthHeader:",
      !!req.headers.authorization,
    );
    console.error(
      "[authMiddleware] secretLen:",
      (process.env.JWT_SECRET || "dev-secret").length,
    );
    req.user = null;
  }
}

export function authRequired(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }
  next();
}

export default authRequired;
