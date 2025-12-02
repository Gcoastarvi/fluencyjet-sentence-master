import { Router } from "express";
import prisma from "../db/client.js";

const router = Router();

// Basic health check
router.get("/", (req, res) => {
  res.json({ ok: true, message: "API is healthy" });
});

// Database health check
router.get("/db", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ ok: true, message: "Database connection OK" });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: "DB health check failed",
      error: err.message,
    });
  }
});

export default router;
