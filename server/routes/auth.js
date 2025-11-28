import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../db/client.js";

const router = express.Router();

// --------------------------
// Helpers
// --------------------------
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || "user",
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );
}

// --------------------------
// POST /signup
// --------------------------
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ ok: false, message: "Missing fields" });
    }

    // Check existing user
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      return res
        .status(400)
        .json({ ok: false, message: "User already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role: "user",
      },
    });

    const token = generateToken(user);

    return res.json({ ok: true, token, user });
  } catch (err) {
    console.error("Signup error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Signup failed", error: err.message });
  }
});

// --------------------------
// POST /login
// --------------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res
        .status(400)
        .json({ ok: false, message: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res
        .status(400)
        .json({ ok: false, message: "Invalid email or password" });
    }

    const token = generateToken(user);

    return res.json({ ok: true, token, user });
  } catch (err) {
    console.error("Login error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Login failed", error: err.message });
  }
});

export default router;
