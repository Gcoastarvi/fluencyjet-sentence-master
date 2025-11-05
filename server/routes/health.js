// server/routes/health.js
import express from "express";
import { PrismaClient } from "@prisma/client";
const router = express.Router();
const prisma = new PrismaClient();

// ✅ Simple API health check
router.get("/health", (req, res) => {
  res.json({ ok: true, message: "API is healthy" });
});

// ✅ DB connection test
router.get("/health/db", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, message: "Database connected successfully" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
