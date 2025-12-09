import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "fluencyjet@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "AQK#952pmbgt";

// Use the SAME secret as student auth so middleware can verify it
const JWT_SECRET = process.env.JWT_SECRET || "fluencyjet_secret_2025";

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        message: "Email and password are required",
      });
    }

    // Simple env-based admin auth (no DB)
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return res.status(401).json({
        ok: false,
        message: "Invalid admin credentials",
      });
    }

    // Create admin token
    const token = jwt.sign(
      {
        id: "admin",
        email,
        role: "admin",
        isAdmin: true,
      },
      JWT_SECRET,
      { expiresIn: "30d" },
    );

    return res.json({
      ok: true,
      token,
      admin: {
        email,
        role: "admin",
      },
    });
  } catch (err) {
    console.error("Admin login error:", err);
    return res.status(500).json({
      ok: false,
      message: "Internal server error",
    });
  }
});

export default router;
