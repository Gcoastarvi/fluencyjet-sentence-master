// server/routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../db/client.js"; // << SQL client

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
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    avatar_url: u.avatar_url,
    has_access: Boolean(u.has_access),
    tier_level: u.tier_level,
    role: u.role,
    created_at: u.created_at,
  };
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

/* ------------------------------------------
   SIGNUP
--------------------------------------------- */
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password, avatar_url } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "Email and password required" });
    }

    const emailNorm = String(email).trim().toLowerCase();
    const usernameNorm = sanitizeUsername(username || emailNorm.split("@")[0]);

    // check existing
    const existing = await db.get("SELECT * FROM users WHERE email = ?", [
      emailNorm,
    ]);

    if (existing) {
      return res
        .status(409)
        .json({ ok: false, message: "User already exists" });
    }

    // hash password
    const hashed = await bcrypt.hash(password, 10);

    const result = await db.run(
      `INSERT INTO users (email, username, password, avatar_url, has_access, tier_level, role)
       VALUES (?, ?, ?, ?, 0, 'free', 'user')`,
      [emailNorm, usernameNorm, hashed, avatar_url || DEFAULT_AVATAR],
    );

    const user = await db.get("SELECT * FROM users WHERE id = ?", [
      result.lastID,
    ]);

    const token = signToken({ id: user.id, email: user.email });
    const expiresAt = Date.now() + 3600000;

    res.json({
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

/* ------------------------------------------
   LOGIN
--------------------------------------------- */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "Email and password required" });
    }

    const emailNorm = String(email).trim().toLowerCase();

    const user = await db.get("SELECT * FROM users WHERE email = ?", [
      emailNorm,
    ]);

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

export default router;
