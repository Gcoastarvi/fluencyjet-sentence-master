// server/routes/dashboard.js
import express from "express";
import prisma from "../db/client.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Helper: start of a day in UTC for a given date
 */
function startOfDayUTC(d = new Date()) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

/**
 * Helper: start of the day N days ago in UTC
 */
function daysAgoUTC(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return startOfDayUTC(d);
}

/**
 * GET /api/dashboard/summary
 * Protected route – returns XP stats, level, badges, streak, lessons, recent activity
 */
router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // ---- Time windows ----
    const todayStart = startOfDayUTC();
    const yesterdayStart = daysAgoUTC(1);
    const sevenDaysAgo = daysAgoUTC(7);
    const fourteenDaysAgo = daysAgoUTC(14);
    const thirtyDaysAgo = daysAgoUTC(30);

    // ---- User progress row (ensure it exists) ----
    let progress = await prisma.userProgress.findUnique({
      where: { user_id: userId },
    });

    if (!progress) {
      progress = await prisma.userProgress.create({
        data: {
          user_id: userId,
          total_xp: 0,
          level: 1,
          consecutive_days: 0,
        },
      });
    }

    // Total XP (from progress row)
    let totalXP = progress?.total_xp ?? 0;

    // Fallback: if somehow still 0 but user has events, aggregate them
    if (!totalXP) {
      const agg = await prisma.xpEvent.aggregate({
        where: { user_id: userId },
        _sum: { xp_delta: true },
      });
      totalXP = agg._sum.xp_delta || 0;
    }

    // ---- XP aggregates ----
    const [todayAgg, yesterdayAgg, weeklyAgg, lastWeekAgg, monthlyAgg] =
      await Promise.all([
        prisma.xpEvent.aggregate({
          where: { user_id: userId, created_at: { gte: todayStart } },
          _sum: { xp_delta: true },
        }),
        prisma.xpEvent.aggregate({
          where: {
            user_id: userId,
            created_at: { gte: yesterdayStart, lt: todayStart },
          },
          _sum: { xp_delta: true },
        }),
        prisma.xpEvent.aggregate({
          where: { user_id: userId, created_at: { gte: sevenDaysAgo } },
          _sum: { xp_delta: true },
        }),
        prisma.xpEvent.aggregate({
          where: {
            user_id: userId,
            created_at: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
          },
          _sum: { xp_delta: true },
        }),
        prisma.xpEvent.aggregate({
          where: { user_id: userId, created_at: { gte: thirtyDaysAgo } },
          _sum: { xp_delta: true },
        }),
      ]);

    const todayXP = todayAgg._sum.xp_delta || 0;
    const yesterdayXP = yesterdayAgg._sum.xp_delta || 0;
    const weeklyXP = weeklyAgg._sum.xp_delta || 0;
    const lastWeekXP = lastWeekAgg._sum.xp_delta || 0;
    const monthlyXP = monthlyAgg._sum.xp_delta || 0;

    // ---- Level calculation (simple XP thresholds) ----
    const LEVELS = [
      { level: 1, xp: 0 },
      { level: 2, xp: 1000 },
      { level: 3, xp: 5000 },
      { level: 4, xp: 10000 },
      { level: 5, xp: 50000 },
      { level: 6, xp: 100000 },
    ];

    let current = LEVELS[0];
    for (const l of LEVELS) {
      if (totalXP >= l.xp) current = l;
    }

    const next = LEVELS.find((l) => l.xp > current.xp) || current;
    const level = current.level;
    const xpToNextLevel = next.xp > totalXP ? next.xp - totalXP : 0;

    // ---- Badge system ----
    const badges = await prisma.badge.findMany({
      orderBy: { min_xp: "asc" },
    });

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

    // ---- Recent XP events ----
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

    // ---- Pending lessons (safe-guarded) ----
    let pendingLessons = [];
    try {
      const lessonProgress = await prisma.lessonProgress.findMany({
        where: { user_id: userId },
        include: { lesson: true },
      });

      pendingLessons = lessonProgress
        .filter((lp) => !lp.completed && lp.lesson)
        .map((lp) => ({
          id: lp.lesson_id,
          title: lp.lesson.title,
          completed: lp.completed,
        }));
    } catch (err) {
      // If this part fails, don't break the whole dashboard
      console.error("LessonProgress query failed (non-fatal):", err);
      pendingLessons = [];
    }

    // ---- Streak ----
    const streak = progress?.consecutive_days ?? 0;

    return res.json({
      todayXP,
      yesterdayXP,
      weeklyXP,
      lastWeekXP,
      monthlyXP,
      streak,
      totalXP,
      level,
      xpToNextLevel,
      nextBadge,
      pendingLessons,
      recentActivity,
    });
  } catch (err) {
    console.error("❌ /api/dashboard/summary error:", err);
    return res.status(500).json({ error: "Failed to load dashboard summary" });
  }
});

export default router;
