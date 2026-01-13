import jwt from "jsonwebtoken";

function extractToken(req) {
  // 1) Authorization: Bearer <token>
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7);

  // 2) Cookie token (common names)
  const c = req.cookies || {};
  return c.token || c.access_token || c.jwt || null;
}

export function authMiddleware(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      req.user = null;
      return next();
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    req.user = payload;
    return next();
  } catch (err) {
    req.user = null;
    return next(); // IMPORTANT: always next()
  }
}

export function authRequired(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }
  next();
}

export default authRequired;
