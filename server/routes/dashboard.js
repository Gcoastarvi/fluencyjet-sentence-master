// server/routes/dashboard.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();
const prisma = new PrismaClient();

/* ----------------------------- TIME HELPERS ----------------------------- */

function dayStartUTC(d = new Date()) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

function weekStartUTC(d = new Date()) {
  const dt = dayStartUTC(d);
  const diff = (dt.getUTCDay() + 6) % 7; // Monday = 0
  dt.setUTCDate(dt.getUTCDate() - diff);
  return dt;
}

function monthStartUTC(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

/* ----------------------------- HELPERS --------------------------------- */

async function ensureProgress(tx, userId) {
  let p = await tx.userProgress.findUnique({ where: { user_id: userId } });
  if (!p) {
    p = await tx.userProgress.create({
      data: {
        user_id: userId,
        total_xp: 0,
        consecutive_days: 0,
        lessons_completed: 0,
        last_activity: new Date(),
      },
    });
  }
  return p;
}

/* ------------------------- DASHBOARD SUMMARY --------------------------- */
/**
 * GET /api/dashboard/summary
 *
 * Returns:
 *  - stats: today/yesterday, weekly vs last week, monthly, streak, level
 *  - rank: weekly rank + weekly XP
 *  - badges: owned + nextBadge suggestion
 */
router.get("/summary", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    const today = dayStartUTC();
    const yesterday = new Date(today);
    yesterday.setUTCDate(today.getUTCDate() - 1);

    const weekStart = weekStartUTC(today);
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setUTCDate(weekStart.getUTCDate() - 7);

    const monthStart = monthStartUTC(today);
    const prevMonthStart = new Date(monthStart);
    prevMonthStart.setUTCMonth(monthStart.getUTCMonth() - 1);

    const result = await prisma.$transaction(async (tx) => {
      // Ensure baseline progress row
      const progress = await ensureProgress(tx, userId);

      // Total XP (from progress, fallback from events)
      let totalXp = progress.total_xp;
      if (totalXp == null) {
        const agg = await tx.xpEvent.aggregate({
          _sum: { xp_delta: true },
          where: { user_id: userId },
        });
        totalXp = agg._sum.xp_delta || 0;
      }

      // Today vs yesterday XP
      const todayAgg = await tx.xpEvent.aggregate({
        _sum: { xp_delta: true },
        where: { user_id: userId, created_at: { gte: today } },
      });

      const yesterdayAgg = await tx.xpEvent.aggregate({
        _sum: { xp_delta: true },
        where: {
          user_id: userId,
          created_at: { gte: yesterday, lt: today },
        },
      });

      const todayXp = todayAgg._sum.xp_delta || 0;
      const yesterdayXp = yesterdayAgg._sum.xp_delta || 0;

      // Weekly vs last week XP
      const weekAgg = await tx.xpEvent.aggregate({
        _sum: { xp_delta: true },
        where: { user_id: userId, created_at: { gte: weekStart } },
      });

      const prevWeekAgg = await tx.xpEvent.aggregate({
        _sum: { xp_delta: true },
        where: {
          user_id: userId,
          created_at: { gte: prevWeekStart, lt: weekStart },
        },
      });

      const weekXp = weekAgg._sum.xp_delta || 0;
      const prevWeekXp = prevWeekAgg._sum.xp_delta || 0;

      // Monthly / last month XP (nice to have)
      const monthAgg = await tx.xpEvent.aggregate({
        _sum: { xp_delta: true },
        where: { user_id: userId, created_at: { gte: monthStart } },
      });

      const prevMonthAgg = await tx.xpEvent.aggregate({
        _sum: { xp_delta: true },
        where: {
          user_id: userId,
          created_at: { gte: prevMonthStart, lt: monthStart },
        },
      });

      const monthXp = monthAgg._sum.xp_delta || 0;
      const prevMonthXp = prevMonthAgg._sum.xp_delta || 0;

      // Weekly rank (rank among all users this week)
      const weeklyGroups = await tx.xpEvent.groupBy({
        by: ["user_id"],
        where: { created_at: { gte: weekStart } },
        _sum: { xp_delta: true },
        orderBy: { _sum: { xp_delta: "desc" } },
      });

      let weeklyRank = null;
      let weeklyXp = weekXp;

      for (let i = 0; i < weeklyGroups.length; i++) {
        if (weeklyGroups[i].user_id === userId) {
          weeklyRank = i + 1;
          weeklyXp = weeklyGroups[i]._sum.xp_delta || 0;
          break;
        }
      }

      // Badges
      const ownedBadges = await tx.userBadge.findMany({
        where: { user_id: userId },
        include: { badge: true },
        orderBy: { awarded_at: "asc" },
      });

      const badgeCatalog = await tx.badge.findMany({
        orderBy: { min_xp: "asc" },
      });

      const ownedCodes = new Set(ownedBadges.map((ub) => ub.badge.code));
      const nextBadge =
        badgeCatalog.find(
          (b) => !ownedCodes.has(b.code) && totalXp < b.min_xp,
        ) || null;

      // Level system (simple 1000 XP per level)
      const levelSize = 1000;
      const level = Math.floor(totalXp / levelSize) + 1;
      const xpIntoLevel = totalXp % levelSize;
      const xpToNextLevel = levelSize - xpIntoLevel;

      return {
        stats: {
          totalXP: totalXp,
          todayXP: todayXp,
          yesterdayXP: yesterdayXp,
          weekXP: weekXp,
          prevWeekXP,
          monthXP: monthXp,
          prevMonthXP,
          todayVsYesterday: todayXp - yesterdayXp,
          weekVsLastWeek: weekXp - prevWeekXp,
          streak: progress.consecutive_days || 0,
          lessonsCompleted: progress.lessons_completed || 0,
          level,
          xpIntoLevel,
          xpToNextLevel,
          levelSize,
        },
        rank: {
          weeklyRank,
          weeklyXP: weeklyXp,
        },
        badges: {
          owned: ownedBadges.map((ub) => ({
            code: ub.badge.code,
            label: ub.badge.label,
            description: ub.badge.description,
            min_xp: ub.badge.min_xp,
            awarded_at: ub.awarded_at,
          })),
          nextBadge: nextBadge
            ? {
                code: nextBadge.code,
                label: nextBadge.label,
                description: nextBadge.description,
                min_xp: nextBadge.min_xp,
              }
            : null,
        },
      };
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("❌ /api/dashboard/summary error:", err);
    res.status(500).json({
      ok: false,
      message: "Failed to load dashboard summary",
      error: String(err?.message || err),
    });
  }
});

export default router;
