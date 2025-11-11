// server/routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

/* ───────────────────────────────
   JWT & Security Config
─────────────────────────────── */
const JWT_SECRET = process.env.JWT_SECRET || "fluencyjet_secret_2025";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "1h"; // 1 hour expiry
const DEFAULT_AVATAR = "https://i.pravatar.cc/150";

/* ───────────────────────────────
   Helper Functions
─────────────────────────────── */
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
    created_at,
  } = u;
  return {
    id,
    email,
    username,
    avatar_url,
    has_access,
    tier_level,
    created_at,
  };
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function authRequired(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token)
      return res.status(401).json({ ok: false, message: "Missing token" });
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch {
    return res
      .status(401)
      .json({ ok: false, message: "Invalid or expired token" });
  }
}

/* ───────────────────────────────
   Routes
─────────────────────────────── */

/** 📝 SIGNUP — Create New User */
router.post("/signup", async (req, res) => {
  try {
    const { name, username, email, password, avatar_url } = req.body || {};
    if (!email || !password)
      return res
        .status(400)
        .json({ ok: false, message: "Email and password required" });

    const emailNorm = String(email).trim().toLowerCase();
    const usernameNorm =
      sanitizeUsername(username || name || emailNorm.split("@")[0]) || null;

    // ✅ Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: emailNorm },
    });
    if (existingUser)
      return res
        .status(400)
        .json({ ok: false, message: "User already exists" });

    // ✅ Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: name || usernameNorm,
        email: emailNorm,
        username: usernameNorm,
        password: hashedPassword,
        avatar_url: avatar_url || DEFAULT_AVATAR,
        has_access: false,
        tier_level: "free",
      },
    });

    // ✅ Generate token & expiry
    const token = signToken({ id: user.id, email: user.email });
    const expiresAt = Date.now() + 3600000; // 1 hour

    // ✅ Respond with all needed info
    res.status(201).json({
      ok: true,
      message: "Signup successful!",
      token,
      name: user.name,
      expiresAt,
      user: publicUser(user),
    });
  } catch (err) {
    if (err?.code === "P2002") {
      return res.status(409).json({
        ok: false,
        message: err?.meta?.target?.includes("username")
          ? "Username already taken"
          : "Email already exists",
      });
    }
    console.error("Signup error:", err);
    res
      .status(500)
      .json({ ok: false, message: "Signup failed", error: err.message });
  }
});

/** 🔑 LOGIN — Authenticate User */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res
        .status(400)
        .json({ ok: false, message: "Email and password required" });

    const emailNorm = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: emailNorm } });

    if (!user)
      return res
        .status(401)
        .json({ ok: false, message: "Invalid credentials" });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid)
      return res
        .status(401)
        .json({ ok: false, message: "Invalid credentials" });

    // ✅ Generate token & expiry
    const token = signToken({ id: user.id, email: user.email });
    const expiresAt = Date.now() + 3600000; // 1 hour

    // ✅ Respond with user info
    res.json({
      ok: true,
      message: "Login successful!",
      token,
      name: user.name,
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

/** 👤 PROFILE — Authenticated User Info */
router.get("/me", authRequired, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        avatar_url: true,
        has_access: true,
        tier_level: true,
        created_at: true,
      },
    });
    res.json({ ok: true, user });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ ok: false, message: "Failed to fetch profile" });
  }
});

/* ───────────────────────────────
   Diagnostics (Safe to Keep)
─────────────────────────────── */
console.log(
  "✅ auth.js loaded successfully with /signup, /login, and /me routes",
);

/* ───────────────────────────────
   Export Router
─────────────────────────────── */
export default router;
