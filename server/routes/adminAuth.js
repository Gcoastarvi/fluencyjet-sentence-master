import express from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../db/prisma.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Hardcode admin credentials for Phase-1
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      return res.status(500).json({
        ok: false,
        message: "Admin credentials not configured",
      });
    }

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ ok: false, message: "Invalid login" });
    }

    const token = jwt.sign({ role: "admin", email }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    return res.json({ ok: true, token });
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

export default router;
