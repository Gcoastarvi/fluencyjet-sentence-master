// server/routes/auth.js

import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";

const router = express.Router();

/* ---------------- JWT HELPER ---------------- */
function makeToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "30d" },
  );
}

/* ---------------- SIGNUP ---------------- */
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    const emailNorm = String(email || "")
      .trim()
      .toLowerCase();
    const passwordNorm = String(password || "");

    if (!name || !emailNorm || !passwordNorm) {
      return res.status(400).json({
        ok: false,
        message: "Name, email and password are required",
      });
    }

    const existing = await prisma.user.findUnique({
      where: { email: emailNorm },
    });

    if (existing) {
      return res.status(400).json({
        ok: false,
        message: "Email already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(passwordNorm, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email: emailNorm,
        password: hashedPassword,
        plan: "FREE",
      },
    });

    const token = makeToken(user);

    return res.status(201).json({
      ok: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
      },
    });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Signup failed",
    });
  }
});

/* ---------------- LOGIN ---------------- */
router.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body || {};

    const emailNorm = String(email || "")
      .trim()
      .toLowerCase();
    const passwordNorm = String(password || "");

    if (!emailNorm || !passwordNorm) {
      return res.status(400).json({
        ok: false,
        message: "Email and password are required",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: emailNorm },
    });

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "Invalid email or password",
      });
    }

    const isValid = await bcrypt.compare(passwordNorm, user.password);

    if (!isValid) {
      return res.status(401).json({
        ok: false,
        message: "Invalid email or password",
      });
    }

    const token = makeToken(user);

    return res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Login failed",
    });
  }
});

/* ---------------- AUTH CHECK ---------------- */
router.get("/me", authRequired, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
      },
    });

    return res.json({ ok: true, user });
  } catch {
    return res.status(401).json({
      ok: false,
      message: "Invalid token",
    });
  }
});

/* ---------------- UPDATE PLAN (Razorpay Step-3) ---------------- */
router.patch("/users/plan", authRequired, async (req, res) => {
  const { plan } = req.body;

  if (!["FREE", "PRO", "LIFETIME"].includes(plan)) {
    return res.status(400).json({
      ok: false,
      message: "Invalid plan",
    });
  }

  const updated = await prisma.user.update({
    where: { id: req.user.userId },
    data: { plan },
  });

  return res.json({ ok: true, plan: updated.plan });
});

export default router;
