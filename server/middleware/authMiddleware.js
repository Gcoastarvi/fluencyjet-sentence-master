// server/middleware/authMiddleware.js
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fluencyjet_secret_2025";

export function authMiddleware(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;

    if (!token) {
      return res.status(401).json({ ok: false, message: "Missing token" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: "Invalid token" });
  }
}

export async function requireAdmin(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ ok: false, message: "Not authenticated" });
    }
    const { default: prisma } = await import("../db/client.js");
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true },
    });
    if (!user || user.role !== "ADMIN") {
      return res.status(403).json({ ok: false, message: "Admin only" });
    }
    req.user.role = user.role;
    next();
  } catch (err) {
    console.error("requireAdmin error:", err);
    return res.status(500).json({ ok: false, message: "Admin check failed" });
  }
}
