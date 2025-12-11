// server/middleware/adminOnly.js
import jwt from "jsonwebtoken";

export function adminOnly(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, message: "Missing admin token" });
  }

  const token = header.split(" ")[1];

  try {
    // IMPORTANT: use the same secret that adminAuth.js uses to sign tokens
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Accept either role:"admin" or isAdmin:true on the payload
    if (decoded.role !== "admin" && decoded.isAdmin !== true) {
      return res.status(403).json({ ok: false, message: "Not authorized" });
    }

    // Attach to request for downstream use
    req.admin = decoded;
    next();
  } catch (err) {
    console.error("adminOnly error:", err);
    return res.status(401).json({ ok: false, message: "Invalid admin token" });
  }
}
