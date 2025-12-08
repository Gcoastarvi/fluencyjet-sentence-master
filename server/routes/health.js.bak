// server/routes/health.js
import express from "express";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/health
router.get("/", (_req, res) => {
  res.json({ ok: true, message: "API is healthy" });
});

// GET /api/health/db
router.get("/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, message: "DB is healthy" });
  } catch (e) {
    res.status(500).json({
      ok: false,
      message: "DB health check failed",
      error: String(e),
    });
  }
});

export default router;
