// server/routes/test.js
import express from "express";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

/**
 * GET /api/test/check-db
 * Confirms DB + Prisma connectivity + shows enum values
 */
router.get("/check-db", async (_, res) => {
  try {
    const badges = await prisma.badge.findMany({ take: 5 });
    const lessons = await prisma.lesson.findMany({ take: 5 });

    // Get enum values dynamically from Prisma runtime
    const eventTypeValues = Object.values(Prisma.EventType || {});

    res.json({
      ok: true,
      message: "Database + Prisma working correctly",
      sample_badges: badges.length,
      sample_lessons: lessons.length,
      eventTypeValues,
    });
  } catch (err) {
    console.error("❌ /api/test/check-db error:", err);
    res.status(500).json({
      ok: false,
      message: "Error checking DB connection or enum values",
      error: err.message,
    });
  }
});

export default router;
