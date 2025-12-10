// server/routes/auth.js

import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../prisma/client.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

// helper to send back a safe student object
function sanitizeStudent(student) {
  if (!student) return null;
  return {
    id: student.id,
    name: student.name,
    email: student.email,
    has_access: student.has_access,
    tier_level: student.tier_level,
    isAdmin: !!student.isAdmin,
    xpTotal: student.xpTotal ?? 0,
  };
}

// -------------------------
// STUDENT SIGNUP
// -------------------------
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({
        ok: false,
        message: "Name, email and password are required.",
      });
    }

    const existing = await prisma.student.findUnique({
      where: { email },
    });

    if (existing) {
      return res.status(409).json({
        ok: false,
        message: "Email is already registered.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const student = await prisma.student.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    const token = jwt.sign(
      { userId: student.id, isAdmin: !!student.isAdmin },
      JWT_SECRET,
      { expiresIn: "30d" },
    );

    return res.status(201).json({
      ok: true,
      message: "Signup successful.",
      user: sanitizeStudent(student),
      token,
      isAdmin: !!student.isAdmin,
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({
      ok: false,
      message: "Internal server error during signup.",
    });
  }
});

// -------------------------
// STUDENT LOGIN
// -------------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        message: "Email and password are required.",
      });
    }

    const student = await prisma.student.findUnique({
      where: { email },
    });

    if (!student) {
      // don't reveal whether email exists
      return res.status(401).json({
        ok: false,
        message: "Invalid email or password.",
      });
    }

    const isMatch = await bcrypt.compare(password, student.password);

    if (!isMatch) {
      return res.status(401).json({
        ok: false,
        message: "Invalid email or password.",
      });
    }

    const token = jwt.sign(
      { userId: student.id, isAdmin: !!student.isAdmin },
      JWT_SECRET,
      { expiresIn: "30d" },
    );

    return res.json({
      ok: true,
      message: "Login successful.",
      user: sanitizeStudent(student),
      token,
      isAdmin: !!student.isAdmin,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({
      ok: false,
      message: "Internal server error during login.",
    });
  }
});

// (optional) for future "who am I" checks – keep if you already use it
router.get("/me", async (req, res) => {
  try {
    // assuming auth middleware has set req.userId
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ ok: false, message: "Not authenticated." });
    }

    const student = await prisma.student.findUnique({
      where: { id: userId },
    });

    if (!student) {
      return res.status(404).json({ ok: false, message: "User not found." });
    }

    return res.json({
      ok: true,
      user: sanitizeStudent(student),
    });
  } catch (err) {
    console.error("GET /me error:", err);
    return res.status(500).json({
      ok: false,
      message: "Internal server error.",
    });
  }
});

export default router;
