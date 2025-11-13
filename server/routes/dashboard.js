import express from "express";
import { PrismaClient } from "@prisma/client";
import authRequired from "../middleware/authRequired.js";

const prisma = new PrismaClient();
const router = express.Router();

/* ----------------------------------------------
   GET /api/dashboard
   Returns XP, streak, unlocked lessons, stats
---------------------------------------------- */
router.get("/", authRequired, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        avatar_url: true,
        total_xp: true,
        has_access: true,
        tier_level: true,
        created_at: true,
      },
    });

    const streak = await prisma.userStreak.findUnique({
      where: { user_id: req.user.id },
    });

    const progress = await prisma.userProgress.findUnique({
      where: { user_id: req.user.id },
    });

    const lessons = await prisma.lesson.count();
    const unlocked = progress?.last_unlocked_order ?? 1;

    res.json({
      ok: true,
      user,
      dashboard: {
        totalXP: user.total_xp,
        streak: streak?.streak ?? 0,
        lastActive: streak?.last_active ?? null,
        unlockedLessons: unlocked,
        totalLessons: lessons,
      },
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ ok: false, message: "Failed to load dashboard" });
  }
});

export default router;
