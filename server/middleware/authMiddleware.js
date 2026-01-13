import jwt from "jsonwebtoken";

export function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    let token = header.startsWith("Bearer ") ? header.slice(7) : null;

    // ✅ also support cookie-based auth (common for browser apps)
    if (!token) {
      token =
        req.cookies?.token ||
        req.cookies?.jwt ||
        req.cookies?.access_token ||
        req.cookies?.accessToken ||
        req.cookies?.auth_token ||
        req.cookies?.authToken ||
        null;
    }

    if (!token) {
      req.user = null;
      return next();
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    req.user = payload;
    return next();
  } catch (err) {
    console.error("[authMiddleware] jwt.verify failed:", err?.message);
    req.user = null;
    return next(); // ✅ critical: don’t hang requests
  }
}

export function authRequired(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }
  next();
}

export default authRequired;
