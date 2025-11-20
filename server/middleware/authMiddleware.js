// server/middleware/authMiddleware.js
import jwt from "jsonwebtoken";

export function authMiddleware(req, res, next) {
  try {
    let token = null;

    // 1) Try Authorization header: "Bearer <token>"
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    // 2) Fallback to HTTP-only cookie
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ ok: false, message: "Missing token" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Normalise shape of req.user
    req.user = {
      id: decoded.userId || decoded.id,
      email: decoded.email,
    };

    return next();
  } catch (err) {
    console.error("❌ authMiddleware error:", err);
    return res
      .status(401)
      .json({ ok: false, message: "Invalid or expired token" });
  }
}
