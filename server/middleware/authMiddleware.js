// server/middleware/authMiddleware.js
import jwt from "jsonwebtoken";

/**
 * Token-based authentication middleware
 * Reads token from:
 *  - Authorization: Bearer <token>
 *  - cookies.token (fallback)
 */
export function authRequired(req, res, next) {
  try {
    let token = null;

    // 1. Read Authorization header
    const auth = req.headers.authorization;
    if (auth && auth.startsWith("Bearer ")) {
      token = auth.split(" ")[1];
    }

    // 2. Fallback: cookie
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        ok: false,
        message: "Missing token",
      });
    }

    // 3. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    return next();
  } catch (err) {
    console.error("❌ authMiddleware error:", err);
    return res.status(401).json({
      ok: false,
      message: "Invalid or expired token",
    });
  }
}
export default authRequired;
