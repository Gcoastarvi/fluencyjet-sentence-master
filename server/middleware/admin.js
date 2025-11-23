// server/middleware/admin.js
import jwt from "jsonwebtoken";

export function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;

  if (!auth) {
    return res.status(401).json({ ok: false, message: "Missing token" });
  }

  try {
    const token = auth.replace("Bearer ", "");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // The "role" field must be "admin"
    if (!decoded.role || decoded.role !== "admin") {
      return res.status(403).json({ ok: false, message: "Admins only" });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: "Invalid token" });
  }
}
