// server/middleware/authMiddleware.js
import jwt from "jsonwebtoken";

const INSECURE_JWT_SECRETS = new Set([
  "dev-secret",
  "secret",
  "changeme",
]);

function getConfiguredJwtSecret() {
  const secret = String(process.env.JWT_SECRET || "").trim();
  if (!secret || INSECURE_JWT_SECRETS.has(secret.toLowerCase())) {
    return null;
  }
  return secret;
}

export function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    const cookieToken = req.cookies?.fj_token || null;

    const token = bearerToken || cookieToken;

    if (!token) {
      // 🎯 LOUD LOG: See this in Railway
      console.log(`[AUTH-DEBUG] No token found for path: ${req.path}`);
      req.user = null;
      return next();
    }

    const jwtSecret = getConfiguredJwtSecret();
    if (!jwtSecret) {
      console.error("[AUTH] JWT_SECRET is not securely configured.");
      req.user = null;
      return next();
    }

    const payload = jwt.verify(token, jwtSecret);
    req.user = payload;

    // 🎯 LOUD LOG: Confirming identity
    console.log(
      `[AUTH-DEBUG] User Identified: ${req.user.email} on ${req.path}`,
    );
    return next();
  } catch (err) {
    console.error("[AUTH-DEBUG] Token Verification Failed:", err.message);
    req.user = null;
    return next();
  }
}

export function authRequired(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }
  return next();
}

export default authRequired;
