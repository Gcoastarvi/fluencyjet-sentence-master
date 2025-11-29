import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "fluencyjet_secret_2025";

// ----------------------------------------
// SIGNUP
// ----------------------------------------
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ ok: false, message: "Missing fields" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return res
        .status(400)
        .json({ ok: false, message: "Email already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
      },
    });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "30d" });

    res.json({ ok: true, token, user: { id: user.id, name, email } });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    res.status(500).json({ ok: false, message: "Server error during signup" });
  }
});

// ----------------------------------------
// LOGIN
// ----------------------------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res
        .status(400)
        .json({ ok: false, message: "Invalid email or password" });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res
        .status(400)
        .json({ ok: false, message: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "30d" });

    res.json({
      ok: true,
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ ok: false, message: "Login failed" });
  }
});

export default router;
