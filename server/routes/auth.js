// server/routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../db/client.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "fluencyjet_secret_2025";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "1h";
const DEFAULT_AVATAR = "https://i.pravatar.cc/150";

function sanitizeUsername(u = "") {
  return String(u)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
    .slice(0, 20);
}

function publicUser(u) {
  if (!u) return null;
  const {
    id,
    email,
    username,
    avatar_url,
    has_access,
    tier_level,
    role,
    created_at,
  } = u;

  return {
    id,
    email,
    username,
    avatar_url,
    has_access,
    tier_level,
    role,
    created_at,
  };
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

/* SIGNUP */
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password, avatar_url } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "Email and password required" });
    }

    const emailNorm = String(email).trim().toLowerCase();
    const usernameNorm =
      sanitizeUsername(username || emailNorm.split("@")[0]) || null;

    const existing = await prisma.user.findUnique({
      where: { email: emailNorm },
    });

    if (existing) {
      return res
        .status(409)
        .json({ ok: false, message: "User already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: emailNorm,
        username: usernameNorm,
        password: hashed,
        avatar_url: avatar_url || DEFAULT_AVATAR,
        has_access: false,
        tier_level: "free",
      },
    });

    const token = signToken({ id: user.id, email: user.email });
    const expiresAt = Date.now() + 3600000;

    res.status(201).json({
      ok: true,
      message: "Signup successful!",
      token,
      expiresAt,
      user: publicUser(user),
    });
  } catch (err) {
    console.error("Signup error:", err);
    res
      .status(500)
      .json({ ok: false, message: "Signup failed", error: err.message });
  }
});

/* LOGIN */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "Email and password required" });
    }

    const emailNorm = String(email).trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: emailNorm },
    });

    if (!user) {
      return res
        .status(401)
        .json({ ok: false, message: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res
        .status(401)
        .json({ ok: false, message: "Invalid credentials" });
    }

    const token = signToken({ id: user.id, email: user.email });
    const expiresAt = Date.now() + 3600000;

    res.json({
      ok: true,
      message: "Login successful!",
      token,
      expiresAt,
      user: publicUser(user),
    });
  } catch (err) {
    console.error("Login error:", err);
    res
      .status(500)
      .json({ ok: false, message: "Login failed", error: err.message });
  }
});

/* PROFILE */
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        avatar_url: true,
        has_access: true,
        tier_level: true,
        role: true,
        created_at: true,
      },
    });

    res.json({ ok: true, user });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ ok: false, message: "Failed to fetch profile" });
  }
});

/* REFRESH TOKEN */
router.post("/refresh", authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user)
      return res.status(404).json({ ok: false, message: "User not found" });

    const token = signToken({ id: user.id, email: user.email });
    const expiresAt = Date.now() + 3600000;

    res.json({
      ok: true,
      message: "Token refreshed successfully",
      token,
      expiresAt,
    });
  } catch (err) {
    console.error("Token refresh error:", err);
    res.status(500).json({ ok: false, message: "Failed to refresh token" });
  }
});

export default router;
