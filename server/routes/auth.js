// server/routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../db/client.js";
import { authRequired } from "../middleware/authMiddleware.js";
import crypto from "crypto";

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

function makeResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/* ───────────────────────────────
   SIGNUP
   POST /api/auth/signup
─────────────────────────────── */

router.post("/signup", async (req, res) => {
  try {
    let { name, email, password, track } = req.body;
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
        track: (track || "BEGINNER").toUpperCase(), // 🎯 THE SYNC FIX
        current_unit: 1,
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

    // 🎯 THE SYNC FIX: Send the track back to the frontend immediately
    res.status(201).json({
      ok: true,
      token,
      email: user.email,
      plan: user.plan,
      has_access: !!user.has_access,
      track: user.track,
      current_unit: user.current_unit,
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

router.post("/login", express.json({ limit: "1mb" }), async (req, res) => {
  try {
    // robust extraction
    let email = req.body?.email ?? "";
    let password = req.body?.password ?? "";

    email = normalizeEmail(String(email || ""));
    password = String(password || "");

    // TEMP DEBUG — keep until fixed
    console.log("[LOGIN] content-type:", req.headers["content-type"]);
    console.log("[LOGIN] body:", req.body);

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

    // ✅ KEEP cookie pathway (existing behavior)
    res.cookie("fj_token", token, {
      httpOnly: true,
      secure: true, // 🎯 Required for cross-site
      sameSite: "none", // 🎯 Required for different subdomains
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // ✅ KEEP returning token (works for localStorage/Bearer)
    // ✅ Updated to include Track and Unit data
    return res.json({
      ok: true,
      token,
      email: user.email,
      plan: user.plan,
      has_access: !!user.has_access,
      track: user.track || "BEGINNER",
      current_unit: user.current_unit || 1,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ ok: false, message: "Login failed" });
  }
});

/* ───────────────────────────────
   FORGET PASSWORD
─────────────────────────────── */

router.post(
  "/forgot-password",
  express.json({ limit: "1mb" }),
  async (req, res) => {
    try {
      let email = normalizeEmail(req.body?.email || "");

      // Always return a neutral success message
      const successMessage =
        "If an account exists for that email, reset instructions have been sent.";

      if (!email) {
        return res.json({ ok: true, message: successMessage });
      }

      const user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        return res.json({ ok: true, message: successMessage });
      }

      // Optional cleanup of old unused tokens
      await prisma.passwordResetToken.deleteMany({
        where: {
          userId: user.id,
          OR: [{ usedAt: { not: null } }, { expiresAt: { lt: new Date() } }],
        },
      });

      const rawToken = makeResetToken();
      const tokenHash = hashResetToken(rawToken);
      const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 mins

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      const resetUrl = `${process.env.APP_URL || "https://fluencyjet.com"}/reset-password?token=${rawToken}`;

      // TODO: replace with real email sending
      console.log("[FORGOT PASSWORD] Send reset link to:", user.email);
      console.log("[FORGOT PASSWORD] Reset URL:", resetUrl);

      return res.json({ ok: true, message: successMessage });
    } catch (err) {
      console.error("Forgot password error:", err);
      return res
        .status(500)
        .json({ ok: false, message: "Unable to process request right now." });
    }
  },
);

/* ───────────────────────────────
   RESET PASSWORD
─────────────────────────────── */

router.post(
  "/reset-password",
  express.json({ limit: "1mb" }),
  async (req, res) => {
    try {
      const rawToken = String(req.body?.token || "");
      const password = String(req.body?.password || "");

      if (!rawToken || !password) {
        return res.status(400).json({ ok: false, message: "Missing fields" });
      }

      if (password.length < 8) {
        return res
          .status(400)
          .json({
            ok: false,
            message: "Password must be at least 8 characters",
          });
      }

      const tokenHash = hashResetToken(rawToken);

      const resetRecord = await prisma.passwordResetToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (
        !resetRecord ||
        resetRecord.usedAt ||
        resetRecord.expiresAt < new Date()
      ) {
        return res
          .status(400)
          .json({ ok: false, message: "Reset link is invalid or expired" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await prisma.$transaction([
        prisma.user.update({
          where: { id: resetRecord.userId },
          data: { password: hashedPassword },
        }),
        prisma.passwordResetToken.update({
          where: { id: resetRecord.id },
          data: { usedAt: new Date() },
        }),
      ]);

      return res.json({
        ok: true,
        message: "Password updated successfully. Please log in.",
      });
    } catch (err) {
      console.error("Reset password error:", err);
      return res
        .status(500)
        .json({ ok: false, message: "Reset failed. Please try again." });
    }
  },
);

/* ───────────────────────────────
   SESSION CHECK
   GET /api/auth/me
─────────────────────────────── */

router.get("/me", authRequired, async (req, res) => {
  try {
    const u = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        email: true,
        plan: true,
        tier_level: true,
        has_access: true,
        track: true,
        current_unit: true,
        xpTotal: true,
        league: true,
      },
    });

    if (!u) return res.status(401).json({ ok: false, message: "Unauthorized" });

    return res.json({
      ok: true,
      email: u.email,
      plan: u.plan || "FREE",
      track: u.track || "BEGINNER",
      current_unit: u.current_unit || 1,
      tier_level: u.tier_level || null,
      has_access: !!u.has_access,
      user: u, // optional, but helpful
    });
  } catch (err) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }
});

// 🎯 Welcome Email Template
const welcomeEmail = (userName) => ({
  subject: "Welcome to Sentence Master 🚀",
  body: `
    Hello ${userName},

    Welcome to FluencyJet! You've taken the first step toward mastering English 
    through our Tamil-specialized sentence mastery system.

    🔥 Your first mission: Complete 5 sentences to start your streak!

    Master your sentences here: https://fluencyjet.com/dashboard

    Happy Learning,
    Aravind (Founder, FluencyJet)
  `,
});

// Inside your Signup Logic:
// await sendEmail(user.email, welcomeEmail(user.username));

export default router;
