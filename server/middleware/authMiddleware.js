// server/middleware/authMiddleware.js
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fluencyjet_secret_2025";

export function authMiddleware(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token) {
      return res
        .status(401)
        .json({ ok: false, message: "Missing Bearer token" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    // Ensure we pass only the essentials forward
    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({
      ok: false,
      message: "Invalid or expired token",
      error: process.env.NODE_ENV === "development" ? String(err) : undefined,
    });
  }
}
