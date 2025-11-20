// server/routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../db/client.js"; // <- keep your existing prisma path
import authRequired from "../middleware/authMiddleware.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const TOKEN_TTL_DAYS = 7;
const TOKEN_MAX_AGE_MS = TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

// Helper: shape user object we send to client
function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name || null,
    username: user.username || null,
    avatar_url: user.avatar_url || null,
    has_access: user.has_access,
    tier_level: user.tier_level,
    created_at: user.created_at,
  };
}

// Helper: sign JWT
function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name || user.username || null,
    },
    JWT_SECRET,
    { expiresIn: `${TOKEN_TTL_DAYS}d` },
  );
}

// Helper: set httpOnly cookie + return JSON
function sendAuthResponse(res, user) {
  const token = signToken(user);
  const now = Date.now();
  const expiresAt = now + TOKEN_MAX_AGE_MS;

  // httpOnly cookie so browser sends it automatically on /api calls
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TOKEN_MAX_AGE_MS,
  });

  return res.json({
    ok: true,
    token, // kept for existing frontend (localStorage, tokenWatcher)
    expiresAt,
    user: sanitizeUser(user),
  });
}

/**
 * POST /api/auth/signup
 */
router.post("/signup", async (req, res) => {
  try {
    const { email, password, name } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "Email and password are required" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res
        .status(400)
        .json({ ok: false, message: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name: name || null,
        username: email.split("@")[0],
        avatar_url: `https://i.pravatar.cc/150?u=${encodeURIComponent(email)}`,
        // has_access and tier_level use DB defaults
      },
    });

    return sendAuthResponse(res, user);
  } catch (err) {
    console.error("Signup error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Signup failed. Please try again." });
  }
});

/**
 * POST /api/auth/login
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res
        .status(401)
        .json({ ok: false, message: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res
        .status(401)
        .json({ ok: false, message: "Invalid credentials" });
    }

    return sendAuthResponse(res, user);
  } catch (err) {
    console.error("Login error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Login failed. Please try again." });
  }
});

/**
 * GET /api/auth/me  (protected)
 * Uses authRequired → req.user.id populated from token
 */
router.get("/me", authRequired, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ ok: false, message: "Not authenticated" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    return res.json({ ok: true, user: sanitizeUser(user) });
  } catch (err) {
    console.error("Get /me error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to load profile" });
  }
});

/**
 * POST /api/auth/refresh  (protected)
 * Frontend calls this with Authorization: Bearer <token>
 * or via cookie; authRequired already handled it.
 */
router.post("/refresh", authRequired, async (req, res) => {
  try {
    const userId = req.user?.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    const token = signToken(user);
    const expiresAt = Date.now() + TOKEN_MAX_AGE_MS;

    // update cookie as well
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: TOKEN_MAX_AGE_MS,
    });

    return res.json({
      ok: true,
      token,
      expiresAt,
      name: user.name || user.username || null,
    });
  } catch (err) {
    console.error("Refresh error:", err);
    return res.status(500).json({ ok: false, message: "Token refresh failed" });
  }
});

/**
 * POST /api/auth/logout
 * Clears the cookie and lets frontend clear localStorage.
 */
router.post("/logout", (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    return res.json({ ok: true, message: "Logged out" });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ ok: false, message: "Logout failed" });
  }
});

export default router;
