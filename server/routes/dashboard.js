// server/routes/dashboard.js
import express from "express";
import prisma from "../db.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

// ----------------------
// GET /api/dashboard/summary
// ----------------------
router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // --- USER PROGRESS ---
    const progress = await prisma.userProgress.findUnique({
      where: { user_id: userId },
    });

    const totalXP = progress?.total_xp ?? 0;
    const level = progress?.level ?? 1;
    const streak = progress?.consecutive_days ?? 0;

    // --- XP EVENTS ---
    const recentEvents = await prisma.xpEvent.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: 10,
    });

    const recentActivity = recentEvents.map((e) => ({
      id: e.id,
      xp_delta: e.xp_delta,
      event_type: e.event_type,
      created_at: e.created_at,
      meta: e.meta,
    }));

    // --- XP COUNTS ---
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const todayXP =
      (
        await prisma.xpEvent.aggregate({
          where: { user_id: userId, created_at: { gte: todayStart } },
          _sum: { xp_delta: true },
        })
      )._sum.xp_delta ?? 0;

    const yesterdayXP =
      (
        await prisma.xpEvent.aggregate({
          where: {
            user_id: userId,
            created_at: { gte: yesterdayStart, lt: todayStart },
          },
          _sum: { xp_delta: true },
        })
      )._sum.xp_delta ?? 0;

    const weeklyXP =
      (
        await prisma.xpEvent.aggregate({
          where: { user_id: userId, created_at: { gte: weekStart } },
          _sum: { xp_delta: true },
        })
      )._sum.xp_delta ?? 0;

    // --- LESSON PROGRESS (TEMP DISABLED) ---
    const pendingLessons = [];

    // --- BADGES ---
    const nextBadge = null;

    return res.json({
      ok: true,
      todayXP,
      yesterdayXP,
      weeklyXP,
      totalXP,
      level,
      streak,
      nextBadge,
      pendingLessons,
      recentActivity,
    });
  } catch (err) {
    console.error("Dashboard summary error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

export default router;
