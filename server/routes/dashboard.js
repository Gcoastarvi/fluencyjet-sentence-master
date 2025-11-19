// server/routes/dashboard.js
import express from "express";
import prisma from "../db/prisma.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

/**
 * Dashboard Summary API
 * This version is SAFE, SIMPLE, and cannot crash.
 * Even if some data is missing, it returns default values.
 */

router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ ok: false, message: "Missing user id" });
    }

    // 1. UserProgress
    let progress = await prisma.userProgress.findUnique({
      where: { user_id: userId },
    });

    if (!progress) {
      progress = { total_xp: 0, level: 1, consecutive_days: 0 };
    }

    // 2. XP Events (recent)
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

    // 3. XP Metrics (today, yesterday, week, last week)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - today.getDay());

    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const lastWeekEnd = new Date(weekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);

    async function getXPsum(start, end) {
      return await prisma.xpEvent.aggregate({
        where: {
          user_id: userId,
          created_at: { gte: start, lt: end },
        },
        _sum: { xp_delta: true },
      });
    }

    const todayXP = (await getXPsum(today, new Date()))._sum.xp_delta || 0;
    const yesterdayXP = (await getXPsum(yesterday, today))._sum.xp_delta || 0;

    const weeklyXP = (await getXPsum(weekStart, new Date()))._sum.xp_delta || 0;

    const lastWeekXP =
      (await getXPsum(lastWeekStart, lastWeekEnd))._sum.xp_delta || 0;

    // 4. Pending lessons
    const pendingLessons = []; // Disabled (not critical)

    // 5. Badges
    const badges = await prisma.badge.findMany({
      orderBy: { min_xp: "asc" },
    });

    const nextBadge = badges.find((b) => b.min_xp > progress.total_xp) || null;

    // 6. Final Response
    res.json({
      ok: true,
      todayXP,
      yesterdayXP,
      weeklyXP,
      lastWeekXP,
      totalXP: progress.total_xp,
      level: progress.level,
      nextBadge,
      recentActivity,
      pendingLessons,
      streak: progress.consecutive_days ?? 0,
    });
  } catch (err) {
    console.error("Dashboard Summary Error:", err);
    return res.status(500).json({
      ok: false,
      message: "Dashboard failed. Defaults applied.",
      todayXP: 0,
      yesterdayXP: 0,
      weeklyXP: 0,
      lastWeekXP: 0,
      totalXP: 0,
      level: 1,
      nextBadge: null,
      pendingLessons: [],
      recentActivity: [],
      streak: 0,
    });
  }
});

export default router;
