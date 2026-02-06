// server/middleware/maybeAuth.js
import jwt from "jsonwebtoken";

export function maybeAuth(req, _res, next) {
  try {
    const token =
      req.cookies?.token ||
      req.cookies?.fj_token ||
      (req.headers.authorization || "").replace("Bearer ", "");

    if (!token) return next();

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // or { id: payload.userId } depending on your token
  } catch {
    // silently ignore invalid/missing token
  }
  next();
}
