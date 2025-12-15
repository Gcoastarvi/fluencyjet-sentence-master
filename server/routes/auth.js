import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";

const router = express.Router();

/* ---------------- TOKEN HELPER ---------------- */
function makeToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "30d" },
  );
}

/* ---------------- SIGNUP ---------------- */
router.post("/signup", async (req, res) => {
  try {
    let { name, email, password } = req.body || {};
    email = email.trim().toLowerCase();

    if (!name || !email || !password) {
      return res.status(400).json({
        ok: false,
        message: "Name, email and password are required",
      });
    }

    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return res.status(400).json({
        ok: false,
        message: "Email already registered",
      });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        plan: "FREE",
        tier_level: "free",
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
      message: "Signup failed, please try again",
    });
  }
});

/* ---------------- LOGIN ---------------- */
router.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body || {};
    email = email.trim().toLowerCase();

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        message: "Email and password are required",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "Invalid email or password",
      });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
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
      message: "Login failed, please try again",
    });
  }
});

/* ---------------- ME (VERIFY TOKEN) ---------------- */
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
  } catch (err) {
    return res.status(401).json({
      ok: false,
      message: "Invalid token",
    });
  }
});

/* ---------------- UPDATE PLAN ---------------- */
router.patch("/users/plan", authRequired, async (req, res) => {
  const { plan } = req.body;

  if (!["FREE", "PRO", "LIFETIME"].includes(plan)) {
    return res.status(400).json({ ok: false, message: "Invalid plan" });
  }

  const updated = await prisma.user.update({
    where: { id: req.user.userId },
    data: { plan },
  });

  return res.json({ ok: true, plan: updated.plan });
});

export default router;
