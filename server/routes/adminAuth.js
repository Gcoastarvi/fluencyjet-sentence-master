import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../db/client.js"; // 🎯 Connect to your DB
import bcrypt from "bcryptjs"; // 🎯 Use bcryptjs for better compatibility

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "fluencyjet_secret_2025";

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "Email and password required" });
    }

    // 🎯 1. Find user in the Database
    const user = await prisma.user.findUnique({ where: { email } });

    // 🎯 2. Security Check: Does user exist and are they an ADMIN?
    if (!user || !user.isAdmin) {
      return res
        .status(401)
        .json({ ok: false, message: "Access denied: Admins only" });
    }

    // 🎯 Smart Password Comparison
    let isMatch = false;
    if (user.password.startsWith("$2")) {
      // It's a hash, use bcrypt
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      // It's plain text (fallback for manual DB updates)
      isMatch = password === user.password;
    }

    if (!isMatch) {
      return res
        .status(401)
        .json({ ok: false, message: "Invalid credentials" });
    }

    // 🎯 4. Create proper Admin Token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        isAdmin: true,
        role: "admin",
      },
      JWT_SECRET,
      { expiresIn: "30d" },
    );

    return res.json({
      ok: true,
      token,
      admin: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
    });
  } catch (err) {
    console.error("Admin login error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Internal server error" });
  }
});

export default router;
