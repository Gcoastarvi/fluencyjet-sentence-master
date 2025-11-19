// server/routes/dashboard.js
import express from "express";
import { prisma } from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { startOfDay, subDays, addDays } from "date-fns";

const router = express.Router();

/**
 * Helper: sum xp between [from, to)
 */
function sumXP(events, from, to) {
  return events
    .filter((e) => e.created_at >= from && e.created_at < to)
    .reduce((acc, e) => acc + (e.xp_delta || 0), 0);
}

/**
 * GET /api/dashboard/summary
 * Returns:
 * {
 *   ok: true,
 *   data: {
 *     todayXP, yesterdayXP, weeklyXP, lastWeekXP,
 *     totalXP, level, xpToNextLevel,
 *     nextBadge, pendingLessons, recentActivity
 *   }
 * }
 */
router.get("/summary", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  // ---------- Default summary (safe fallbacks) ----------
  const defaultSummary = {
    todayXP: 0,
    yesterdayXP: 0,
    weeklyXP: 0,
    lastWeekXP: 0,
    totalXP: 0,
    level: 1,
    xpToNextLevel: 0,
    nextBadge: null, // { label, min_xp } or null
    pendingLessons: [], // [{ id, title, completed }]
    recentActivity: [], // [{ id, xp_delta, event_type, created_at, meta }]
  };

  try {
    const now = new Date();

    const startToday = startOfDay(now);
    const startTomorrow = addDays(startToday, 1);

    const startYesterday = startOfDay(subDays(now, 1));

    // week starts on Monday (adjust as you like)
    const dayOfWeek = (now.getDay() + 6) % 7; // 0 = Monday
    const startThisWeek = startOfDay(subDays(now, dayOfWeek));
    const startNextWeek = addDays(startThisWeek, 7);
    const startLastWeek = subDays(startThisWeek, 7);

    // ---------- Query DB in parallel (and keep it small/safe) ----------
    const [progress, xpEvents, badges, userBadges, lessons, lessonProgress] =
      await Promise.all([
        // Overall progress for this user
        prisma.userProgress.findUnique({
          where: { user_id: userId },
        }),

        // Recent XP events (limit to 200 for safety)
        prisma.xpEvent.findMany({
          where: { user_id: userId },
          orderBy: { created_at: "desc" },
          take: 200,
        }),

        // All possible badges
        prisma.badge.findMany({
          orderBy: { min_xp: "asc" },
        }),

        // Badges this user already has
        prisma.userBadge.findMany({
          where: { user_id: userId },
          include: { badge: true },
          orderBy: { badge: { min_xp: "asc" } },
        }),

        // Lessons
        prisma.lesson.findMany({
          orderBy: { id: "asc" },
        }),

        // Lesson progress (if table exists). If Prisma model
        // doesn't exist, this call will throw and we'll just
        // fall back to "all caught up".
        prisma.lessonProgress
          ? prisma.lessonProgress.findMany({
              where: { user_id: userId },
            })
          : Promise.resolve([]),
      ]);

    // ---------- Build summary from DB ----------

    const summary = { ...defaultSummary };

    // Total XP + level
    if (progress) {
      summary.totalXP = progress.total_xp ?? 0;
      summary.level = progress.level ?? 1;
    }

    // XP time windows
    summary.todayXP = sumXP(xpEvents, startToday, startTomorrow);
    summary.yesterdayXP = sumXP(xpEvents, startYesterday, startToday);
    summary.weeklyXP = sumXP(xpEvents, startThisWeek, startNextWeek);
    summary.lastWeekXP = sumXP(xpEvents, startLastWeek, startThisWeek);

    // Recent activity (last 10 events)
    summary.recentActivity = xpEvents.slice(0, 10).map((e) => ({
      id: e.id,
      xp_delta: e.xp_delta,
      event_type: e.event_type,
      created_at: e.created_at,
      meta: e.meta,
    }));

    // Next badge
    if (badges && badges.length > 0) {
      const ownedBadgeIds = new Set(
        (userBadges || []).map((ub) => ub.badge_id),
      );
      const next = badges.find(
        (b) => !ownedBadgeIds.has(b.id) && summary.totalXP < (b.min_xp ?? 0),
      );
      if (next) {
        summary.nextBadge = {
          label: next.label,
          min_xp: next.min_xp,
        };
        summary.xpToNextLevel = Math.max(
          0,
          (next.min_xp || 0) - summary.totalXP,
        );
      }
    }

    // Pending lessons (if lessonProgress table is available)
    if (lessons && lessons.length > 0 && lessonProgress) {
      const completedSet = new Set(
        lessonProgress.filter((lp) => lp.completed).map((lp) => lp.lesson_id),
      );

      summary.pendingLessons = lessons
        .filter((lesson) => !completedSet.has(lesson.id))
        .map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          completed: false,
        }));
    }

    // ✅ Always respond with ok: true + data
    return res.json({ ok: true, data: summary });
  } catch (err) {
    // Even if something fails, never break the dashboard.
    console.error("Dashboard summary error:", err);
    return res.json({ ok: true, data: defaultSummary });
  }
});

export default router;
