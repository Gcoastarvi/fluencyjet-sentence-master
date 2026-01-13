import jwt from "jsonwebtoken";

export function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;

    // cookie-parser is already enabled in your app
    const cookieToken = req.cookies?.token || null;

    const token = bearer || cookieToken;

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
