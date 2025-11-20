// server/routes/dashboard.js
import express from "express";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";

const router = express.Router();

/* TIME HELPERS */
function startOfDay(d = new Date()) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return startOfDay(d);
}

/* MAIN SUMMARY ENDPOINT */
router.get("/summary", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    const todayStart = startOfDay();
    const yesterdayStart = daysAgo(1);
    const sevenDaysAgo = daysAgo(7);
    const fourteenDaysAgo = daysAgo(14);
    const thirtyDaysAgo = daysAgo(30);

    /* Load user progress */
    const progress = await prisma.userProgress.findUnique({
      where: { user_id: userId },
    });

    let totalXP = progress?.total_xp ?? 0;

    if (!progress) {
      const agg = await prisma.xpEvent.aggregate({
        where: { user_id: userId },
        _sum: { xp_delta: true },
      });
      totalXP = agg._sum.xp_delta || 0;
    }

    /* Aggregate XP */
    const todayXP =
      (
        await prisma.xpEvent.aggregate({
          where: { user_id: userId, created_at: { gte: todayStart } },
          _sum: { xp_delta: true },
        })
      )._sum.xp_delta || 0;

    const yesterdayXP =
      (
        await prisma.xpEvent.aggregate({
          where: {
            user_id: userId,
            created_at: { gte: yesterdayStart, lt: todayStart },
          },
          _sum: { xp_delta: true },
        })
      )._sum.xp_delta || 0;

    const weeklyXP =
      (
        await prisma.xpEvent.aggregate({
          where: { user_id: userId, created_at: { gte: sevenDaysAgo } },
          _sum: { xp_delta: true },
        })
      )._sum.xp_delta || 0;

    const lastWeekXP =
      (
        await prisma.xpEvent.aggregate({
          where: {
            user_id: userId,
            created_at: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
          },
          _sum: { xp_delta: true },
        })
      )._sum.xp_delta || 0;

    const monthlyXP =
      (
        await prisma.xpEvent.aggregate({
          where: { user_id: userId, created_at: { gte: thirtyDaysAgo } },
          _sum: { xp_delta: true },
        })
      )._sum.xp_delta || 0;

    /* Levels */
    const LEVELS = [
      { level: 1, xp: 0 },
      { level: 2, xp: 1000 },
      { level: 3, xp: 5000 },
      { level: 4, xp: 10000 },
      { level: 5, xp: 50000 },
      { level: 6, xp: 100000 },
    ];

    let current = LEVELS[0];
    for (const l of LEVELS) if (totalXP >= l.xp) current = l;

    const next = LEVELS.find((l) => l.xp > current.xp) || current;
    const xpToNextLevel = next.xp > totalXP ? next.xp - totalXP : 0;

    /* Badges */
    const badges = await prisma.badge.findMany({ orderBy: { min_xp: "asc" } });
    let nextBadge = null;

    for (const b of badges) {
      if (totalXP < b.min_xp) {
        nextBadge = {
          code: b.code,
          label: b.label,
          minXP: b.min_xp,
          remainingXP: b.min_xp - totalXP,
        };
        break;
      }
    }

    /* Recent XP Events */
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

    const streak = progress?.consecutive_days ?? 0;

    return res.json({
      todayXP,
      yesterdayXP,
      weeklyXP,
      lastWeekXP,
      monthlyXP,
      streak,
      totalXP,
      level: current.level,
      xpToNextLevel,
      nextBadge,
      pendingLessons: [],
      recentActivity,
    });
  } catch (err) {
    console.error("❌ /api/dashboard/summary error:", err);
    return res.status(500).json({ error: "Failed to load dashboard summary" });
  }
});

export default router;
