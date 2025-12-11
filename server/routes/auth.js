// routes/auth.js – signup & login

import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../db/client.js"; // this should be your existing Prisma client

const router = express.Router();

// Detect which Prisma model we should use for auth
// Supports either `User` or `Student` model names.
function getAuthModel() {
  if (prisma.user) return prisma.user;
  if (prisma.student) return prisma.student;
  throw new Error(
    "Auth model not found: neither prisma.user nor prisma.student is defined. " +
      "Check your Prisma schema.",
  );
}

// Helper to generate JWT
function makeToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
  };

  const secret = process.env.JWT_SECRET || "dev-secret";

  return jwt.sign(payload, secret, {
    expiresIn: "7d",
  });
}

// ─────────────────────────────────────────────
//  POST /api/auth/signup
// ─────────────────────────────────────────────
router.post("/signup", async (req, res) => {
  const Auth = getAuthModel();

  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({
          ok: false,
          message: "Name, email, and password are required.",
        });
    }

    const existing = await Auth.findUnique({
      where: { email },
    });

    if (existing) {
      return res
        .status(409)
        .json({
          ok: false,
          message: "Email already registered. Please log in.",
        });
    }

    const hashed = await bcrypt.hash(password, 10);

    // Try to create with basic fields; any extra fields in your model
    // should have defaults in Prisma (xp, streak, etc.)
    const user = await Auth.create({
      data: {
        name,
        email,
        password: hashed,
      },
    });

    const token = makeToken(user);

    // Optionally set an HTTP-only cookie (frontend is also using token in JSON body)
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(201).json({
      ok: true,
      message: "Signup successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      token,
    });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Internal server error during signup.",
      error: err.message,
      code: err.code || null,
    });
  }
});

// ─────────────────────────────────────────────
//  POST /api/auth/login
// ─────────────────────────────────────────────
router.post("/login", async (req, res) => {
  const Auth = getAuthModel();

  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "Email and password are required." });
    }

    const user = await Auth.findUnique({
      where: { email },
    });

    if (!user) {
      return res
        .status(401)
        .json({ ok: false, message: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ ok: false, message: "Invalid email or password." });
    }

    const token = makeToken(user);

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      ok: true,
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      token,
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Internal server error during login.",
      error: err.message,
      code: err.code || null,
    });
  }
});

// ─────────────────────────────────────────────
//  Simple test route (optional, for debugging)
// ─────────────────────────────────────────────
router.get("/test", (req, res) => {
  res.json({ ok: true, message: "Auth routes are wired correctly." });
});

export default router;
