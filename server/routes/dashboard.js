import express from "express";
import prisma from "../db/client.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// -------------------------------
// Utility: Start of Day (UTC)
// -------------------------------
function startOfDay(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return startOfDay(d);
}

// -------------------------------
// DASHBOARD SUMMARY
// -------------------------------
router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Time boundaries
    const todayStart = startOfDay();
    const yesterdayStart = daysAgo(1);
    const sevenDaysAgo = daysAgo(7);
    const fourteenDaysAgo = daysAgo(14);
    const thirtyDaysAgo = daysAgo(30);

    // --------------------------------------
    // USER PROGRESS (total XP + streak)
    // --------------------------------------
    const progress = await prisma.userProgress.findUnique({
      where: { user_id: userId },
    });

    let totalXP = progress?.total_xp ?? 0;
    const streak = progress?.consecutive_days ?? 0;

    // Fallback if user_progress row missing
    if (!progress) {
      const aggXP = await prisma.xpEvent.aggregate({
        where: { user_id: userId },
        _sum: { xp_delta: true },
      });

      totalXP = aggXP._sum.xp_delta || 0;
    }

    // --------------------------------------
    // XP RANGES
    // --------------------------------------
    const xpAgg = async (gte, lt = null) =>
      prisma.xpEvent.aggregate({
        where: {
          user_id: userId,
          created_at: lt ? { gte, lt } : { gte },
        },
        _sum: { xp_delta: true },
      });

    const todayXP = (await xpAgg(todayStart))._sum.xp_delta || 0;
    const yesterdayXP =
      (await xpAgg(yesterdayStart, todayStart))._sum.xp_delta || 0;
    const weeklyXP = (await xpAgg(sevenDaysAgo))._sum.xp_delta || 0;
    const lastWeekXP =
      (await xpAgg(fourteenDaysAgo, sevenDaysAgo))._sum.xp_delta || 0;
    const monthlyXP = (await xpAgg(thirtyDaysAgo))._sum.xp_delta || 0;

    // --------------------------------------
    // LEVEL SYSTEM
    // --------------------------------------
    const LEVELS = [
      { level: 1, xp: 0 },
      { level: 2, xp: 1000 },
      { level: 3, xp: 5000 },
      { level: 4, xp: 10000 },
      { level: 5, xp: 50000 },
      { level: 6, xp: 100000 },
    ];

    let current = LEVELS[0];
    LEVELS.forEach((lvl) => {
      if (totalXP >= lvl.xp) current = lvl;
    });

    const next = LEVELS.find((lvl) => lvl.xp > current.xp) || current;
    const xpToNextLevel = next.xp > totalXP ? next.xp - totalXP : 0;

    // --------------------------------------
    // BADGE SYSTEM
    // --------------------------------------
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

    // --------------------------------------
    // MOST RECENT XP EVENTS
    // --------------------------------------
    const recentEvents = await prisma.xpEvent.findMany({
      where: { user_id: userId },
      take: 10,
      orderBy: { created_at: "desc" },
    });

    const recentActivity = recentEvents.map((e) => ({
      id: e.id,
      xp_delta: e.xp_delta,
      event_type: e.event_type,
      created_at: e.created_at,
      meta: e.meta,
    }));

    // --------------------------------------
    // TEMPORARILY DISABLED
    // (LessonProgress table not implemented)
    // --------------------------------------
    const pendingLessons = [];

    // --------------------------------------
    // SEND RESPONSE
    // --------------------------------------
    return res.json({
      // XP
      todayXP,
      yesterdayXP,
      weeklyXP,
      lastWeekXP,
      monthlyXP,

      // Progress
      streak,
      totalXP,

      // Level
      level: current.level,
      xpToNextLevel,

      // Badges
      nextBadge,

      // Activity
      recentActivity,

      // Lessons
      pendingLessons,
    });
  } catch (err) {
    console.error("❌ Dashboard Error:", err);
    return res.status(500).json({ error: "Failed to load dashboard summary" });
  }
});

export default router;
