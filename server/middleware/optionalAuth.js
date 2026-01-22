import { verifyToken } from "./verifyToken.js"; // adjust to your token logic

export function optionalAuth(req, _res, next) {
  try {
    const user = verifyToken(req); // should return {id,...} or throw
    req.user = user;
  } catch {
    req.user = null;
  }
  next();
}
