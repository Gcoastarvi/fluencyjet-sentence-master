// server/middleware/admin.js
export default function requireAdmin(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ ok: false, message: "Unauthorized" });
    }

    // Accept either role:"admin" on the token OR isAdmin:true
    if (req.user.role !== "admin" && req.user.isAdmin !== true) {
      return res.status(403).json({ ok: false, message: "Admins only" });
    }

    return next();
  } catch (err) {
    console.error("requireAdmin error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
}
