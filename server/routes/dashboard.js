// server/routes/dashboard.js
import express from "express";
import prisma from "../db/client.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

/** Helper: beginning of day UTC */
function startOfDayUTC(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/** Helper: n days ago */
function daysAgoUTC(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return startOfDayUTC(d);
}

router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log("📌 Dashboard summary requested for user:", userId);

    // --- Fetch all XP events for this user ---
    const events = await prisma.xpEvent.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
    });

    console.log("📌 XP events found:", events.length);

    const now = new Date();

    // Compute ranges
    const todayStart = startOfDayUTC(now);
    const yesterdayStart = daysAgoUTC(1);
    const weekStart = daysAgoUTC(7);
    const lastWeekStart = daysAgoUTC(14);
    const lastWeekEnd = daysAgoUTC(7);

    // XP calculations
    const todayXP = events
      .filter((e) => e.created_at >= todayStart)
      .reduce((sum, e) => sum + e.xp_delta, 0);

    const yesterdayXP = events
      .filter(
        (e) => e.created_at >= yesterdayStart && e.created_at < todayStart,
      )
      .reduce((sum, e) => sum + e.xp_delta, 0);

    const weeklyXP = events
      .filter((e) => e.created_at >= weekStart)
      .reduce((sum, e) => sum + e.xp_delta, 0);

    const lastWeekXP = events
      .filter(
        (e) => e.created_at >= lastWeekStart && e.created_at < lastWeekEnd,
      )
      .reduce((sum, e) => sum + e.xp_delta, 0);

    const totalXP = events.reduce((sum, e) => sum + e.xp_delta, 0);

    // Basic level formula (can adjust later)
    const level = Math.floor(totalXP / 100) + 1;
    const xpToNextLevel = level * 100 - totalXP;

    // No LessonProgress table → return empty safely
    const pendingLessons = [];

    // Recent events
    const recentActivity = events.slice(0, 10).map((e) => ({
      id: e.id,
      xp_delta: e.xp_delta,
      event_type: e.event_type,
      created_at: e.created_at,
      meta: e.meta,
    }));

    console.log("📌 Dashboard summary computed successfully");

    return res.json({
      todayXP,
      yesterdayXP,
      weeklyXP,
      lastWeekXP,
      totalXP,
      level,
      xpToNextLevel,
      nextBadge: null,
      pendingLessons,
      recentActivity,
    });
  } catch (err) {
    console.error("❌ Dashboard summary API error:", err);
    return res.status(500).json({ error: "Dashboard failed" });
  }
});

export default router;
