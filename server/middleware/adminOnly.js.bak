import jwt from "jsonwebtoken";

export function adminOnly(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, message: "Missing admin token" });
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);

    if (decoded.role !== "admin") {
      return res.status(403).json({ ok: false, message: "Not authorized" });
    }

    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: "Invalid admin token" });
  }
}
