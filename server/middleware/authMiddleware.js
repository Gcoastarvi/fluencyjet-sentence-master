import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;

    // ✅ support BOTH cookie names (backwards compatible)
    const cookieToken = req.cookies?.fj_token || req.cookies?.token || null;

    const token = bearer || cookieToken;

    if (!token) {
      req.user = null;
      return next();
    }

    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (err) {
    console.error("[authMiddleware] jwt.verify failed:", err?.message);
    req.user = null;
    return next();
  }
}

export function authRequired(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }
  return next();
}

export default authRequired;
