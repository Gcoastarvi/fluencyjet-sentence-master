// server/middleware/authMiddleware.js
import jwt from "jsonwebtoken";

export default function authMiddleware(req, res, next) {
  try {
    let token = null;

    // 1) Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    // 2) Fallback: cookie token
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ ok: false, message: "Missing token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.id || decoded.userId,
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
export default function authRequired(req, res, next) {
  // ... your jwt verification logic ...
}
