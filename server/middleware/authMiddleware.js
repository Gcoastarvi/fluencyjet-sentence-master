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

    const normalizedId =
      payload?.id ||
      payload?.userId ||
      payload?.user_id ||
      payload?.sub ||
      null;

    req.user = {
      ...payload,
      id: normalizedId,
      email: payload?.email || null,
    };

    console.log("[AUTH MIDDLEWARE USER]", req.user);
    return next();
  } catch (err) {
    console.error("[authMiddleware] jwt.verify failed:", err?.message);
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
