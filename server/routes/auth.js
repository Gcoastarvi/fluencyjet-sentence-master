// server/routes/auth.js

import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// Helper to generate a 7-day JWT
function generateToken(student) {
  return jwt.sign(
    {
      id: student.id,
      email: student.email,
      name: student.name,
      role: "student",
    },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
}

// ----------------------
// POST /api/auth/signup
// ----------------------
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "Name, email and password are required." });
    }

    // ✅ use the Student model, not User
    const existing = await prisma.student.findUnique({
      where: { email },
    });

    if (existing) {
      return res
        .status(400)
        .json({ ok: false, message: "Email is already registered." });
    }

    const hashed = await bcrypt.hash(password, 10);

    const student = await prisma.student.create({
      data: {
        name,
        email,
        password: hashed,
      },
    });

    const token = generateToken(student);

    // send token as cookie + JSON
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(201).json({
      ok: true,
      message: "Signup successful.",
      token,
      user: {
        id: student.id,
        name: student.name,
        email: student.email,
        role: "student",
      },
    });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Server error during signup." });
  }
});

// ---------------------
// POST /api/auth/login
// ---------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "Email and password are required." });
    }

    // ✅ use Student model here as well
    const student = await prisma.student.findUnique({
      where: { email },
    });

    if (!student) {
      return res
        .status(401)
        .json({ ok: false, message: "Invalid email or password." });
    }

    const match = await bcrypt.compare(password, student.password);
    if (!match) {
      return res
        .status(401)
        .json({ ok: false, message: "Invalid email or password." });
    }

    const token = generateToken(student);

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      ok: true,
      message: "Login successful.",
      token,
      user: {
        id: student.id,
        name: student.name,
        email: student.email,
        role: "student",
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Server error during login." });
  }
});

// ---------------------
// GET /api/auth/me
// ---------------------
router.get("/me", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    const [, token] = auth.split(" ");

    if (!token) {
      return res.status(401).json({ ok: false, message: "No token provided." });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const student = await prisma.student.findUnique({
      where: { id: decoded.id },
    });

    if (!student) {
      return res.status(404).json({ ok: false, message: "User not found." });
    }

    return res.json({
      ok: true,
      user: {
        id: student.id,
        name: student.name,
        email: student.email,
        role: "student",
      },
    });
  } catch (err) {
    console.error("ME ERROR:", err);
    return res
      .status(401)
      .json({ ok: false, message: "Invalid or expired token." });
  }
});

// ---------------------
// POST /api/auth/logout
// ---------------------
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  return res.json({ ok: true, message: "Logged out successfully." });
});

export default router;
