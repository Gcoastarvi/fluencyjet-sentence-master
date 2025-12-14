// server/routes/auth.js

import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../db/client.js";
import { authRequired } from "../middleware/authMiddleware.js";

const router = express.Router();

function makeToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "30d" },
  );
}

// --------- SIGNUP ----------
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    console.log("SIGNUP hit with body:", {
      name,
      email,
      hasPassword: !!password,
    });

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "Name, email and password are required" });
    }

    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return res
        .status(400)
        .json({ ok: false, message: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed, // column in your Prisma model
      },
    });

    const token = makeToken(user);

    return res.status(201).json({
      ok: true,
      message: "Signup successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Signup failed, please try again" });
  }
});

// --------- LOGIN ----------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    console.log("LOGIN hit with body:", {
      email,
      hasPassword: !!password,
    });

    if (!email || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res
        .status(401)
        .json({ ok: false, message: "Invalid email or password" });
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res
        .status(401)
        .json({ ok: false, message: "Invalid email or password" });
    }

    const token = makeToken(user);

    return res.json({
      ok: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Login failed, please try again" });
  }
});
// --------- ME (verify token + return user) ----------
router.get("/me", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    if (!token) {
      return res.status(401).json({ ok: false, message: "No token" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return res.status(401).json({ ok: false, message: "User not found" });
    }

    return res.json({ ok: true, user });
  } catch (err) {
    return res.status(401).json({ ok: false, message: "Invalid token" });
  }
});
router.patch("/users/plan", authRequired, async (req, res) => {
  const { plan } = req.body;

  if (!["FREE", "PRO", "LIFETIME"].includes(plan)) {
    return res.status(400).json({ error: "Invalid plan" });
  }

  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: { plan },
  });

  res.json({ ok: true, plan: updated.plan });
});

export default router;
