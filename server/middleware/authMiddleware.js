import jwt from "jsonwebtoken";

export default function authRequired(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ ok: false, message: "No token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");

    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: "Invalid token" });
  }
}
