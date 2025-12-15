// server/routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";

const router = express.Router();

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan || "FREE",
    },
    process.env.JWT_SECRET,
    { expiresIn: "30d" },
  );
}

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!name || !email || !password) {
      return res.status(400).json({ ok: false, message: "Missing fields" });
    }
    if (password.length < 6) {
      return res.status(400).json({ ok: false, message: "Password too short" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res
        .status(409)
        .json({ ok: false, message: "Email already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed, // IMPORTANT: must match your Prisma field name
        plan: "FREE",
      },
      select: { id: true, name: true, email: true, plan: true },
    });

    const token = signToken(user);

    return res.status(201).json({
      ok: true,
      token,
      email: user.email,
      plan: user.plan || "FREE",
    });
  } catch (err) {
    console.error("❌ signup error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ ok: false, message: "Missing fields" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res
        .status(401)
        .json({ ok: false, message: "Invalid email or password" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res
        .status(401)
        .json({ ok: false, message: "Invalid email or password" });
    }

    const token = signToken(user);

    return res.json({
      ok: true,
      token,
      email: user.email,
      plan: user.plan || "FREE",
    });
  } catch (err) {
    console.error("❌ login error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

// GET /api/auth/me  (requires token)
router.get("/me", authRequired, async (req, res) => {
  try {
    const id = req.user?.id;
    if (!id)
      return res.status(401).json({ ok: false, message: "No user in token" });

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, plan: true },
    });

    if (!user)
      return res.status(404).json({ ok: false, message: "User not found" });

    return res.json({ ok: true, user });
  } catch (err) {
    console.error("❌ me error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

export default router;
