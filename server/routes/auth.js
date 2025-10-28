// server/routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || "fluencyjet_secret_2025";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";
const DEFAULT_AVATAR = "https://i.pravatar.cc/150";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function sanitizeUsername(u = "") {
  const s = String(u)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "");
  return s.slice(0, 20);
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
    return res.status(401).json({ ok: false, message: "Invalid token" });
  }
}

// ─────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────

// 📝 SIGNUP
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

    // ✅ Hash password and store in the correct field
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Create user (uses `password` field only; remove password_hash)
    const user = await prisma.user.create({
      data: {
        email: emailNorm,
        password: hashedPassword,
        username: usernameNorm,
        avatar_url: avatar_url || DEFAULT_AVATAR,
        has_access: false,
        tier_level: "free",
      },
    });

    const token = signToken({ id: user.id, email: user.email });
    return res.status(201).json({
      ok: true,
      message: "User created",
      token,
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
    return res
      .status(500)
      .json({ ok: false, message: "Signup failed", error: err.message });
  }
});

// 🔑 LOGIN
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

    // ✅ Compare hashed password correctly
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid)
      return res
        .status(401)
        .json({ ok: false, message: "Invalid credentials" });

    const token = signToken({ id: user.id, email: user.email });
    return res.json({
      ok: true,
      message: "Login success",
      token,
      user: publicUser(user),
    });
  } catch (err) {
    console.error("Login error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Login failed", error: err.message });
  }
});

// 👤 PROFILE ("Me")
router.get("/me", authRequired, async (req, res) => {
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
        created_at: true,
      },
    });
    return res.json({ ok: true, user });
  } catch (err) {
    console.error("Me error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to fetch profile" });
  }
});

export default router;
