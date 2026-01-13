// server/routes/auth.js

import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../db/client.js";
import { authRequired } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ───────────────────────────────
   Helpers
─────────────────────────────── */

function normalizeEmail(email) {
  return email?.trim().toLowerCase();
}

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

/* ───────────────────────────────
   SIGNUP
   POST /api/auth/signup
─────────────────────────────── */

router.post("/signup", async (req, res) => {
  try {
    let { name, email, password } = req.body;
    email = normalizeEmail(email);

    if (!email || !password) {
      return res.status(400).json({ ok: false, message: "Missing fields" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res
        .status(409)
        .json({ ok: false, message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        plan: "FREE",
      },
    });

    const token = signToken(user);

    res.cookie("fj_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Railway = https
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      ok: true,
      token,
      email: user.email,
      plan: user.plan,
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ ok: false, message: "Signup failed" });
  }
});

/* ───────────────────────────────
   LOGIN
   POST /api/auth/login
─────────────────────────────── */

router.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body;
    email = normalizeEmail(email);

    if (!email || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "Missing credentials" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res
        .status(401)
        .json({ ok: false, message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ ok: false, message: "Invalid credentials" });
    }

    const token = signToken(user);

    res.cookie("fj_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      ok: true,
      token,
      email: user.email,
      plan: user.plan,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ ok: false, message: "Login failed" });
  }
});

/* ───────────────────────────────
   SESSION CHECK
   GET /api/auth/me
─────────────────────────────── */

router.get("/me", authRequired, async (req, res) => {
  try {
    const user = req.user;
    res.json({
      ok: true,
      email: user.email,
      plan: user.plan || "FREE",
    });
  } catch (err) {
    res.status(401).json({ ok: false });
  }
});

export default router;
