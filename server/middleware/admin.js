// server/middleware/admin.js

export function requireAdmin(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ ok: false, message: "Unauthorized" });
    }

    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ ok: false, message: "Forbidden: Admins only" });
    }

    next();
  } catch (err) {
    console.error("requireAdmin error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
}

export default requireAdmin;
