import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../db/prisma.js";

const router = express.Router();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;

// -----------------------------
// POST /api/admin/login
// -----------------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return res.status(401).json({
        ok: false,
        message: "Invalid admin credentials",
      });
    }

    const token = jwt.sign({ role: "admin", email }, ADMIN_JWT_SECRET, {
      expiresIn: "2h",
    });

    return res.json({
      ok: true,
      message: "Admin authenticated",
      token,
    });
  } catch (err) {
    console.error("Admin Login Error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

// -----------------------------
// ADMIN PROTECTED MIDDLEWARE
// -----------------------------
export function adminAuthMiddleware(req, res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;

  if (!token) {
    return res.status(401).json({ ok: false, message: "Missing admin token" });
  }

  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: "Invalid token" });
  }
}

export default router;
