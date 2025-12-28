// server/routes/dashboard.js
import express from "express";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";

const router = express.Router();

/* ---------- Helpers ---------- */

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

// Convert BigInt values recursively
function toCleanJSON(obj) {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "bigint") {
    return Number(obj); // convert safely
  }

  if (Array.isArray(obj)) {
    return obj.map(toCleanJSON);
  }

  if (typeof obj === "object") {
    const clean = {};
    for (const [key, value] of Object.entries(obj)) {
      clean[key] = toCleanJSON(value);
    }
    return clean;
  }

  return obj;
}

/* ---------- MAIN ROUTE ---------- */

router.get("/summary", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    const todayStart = startOfDay();
    const yesterdayStart = daysAgo(1);
    const sevenDaysAgo = daysAgo(7);
    const fourteenDaysAgo = daysAgo(14);
    const thirtyDaysAgo = daysAgo(30);

    /* ---------------- Load user progress ---------------- */
    const progress = await prisma.userProgress.findUnique({
      where: { user_id: userId },
    });

    // Works whether your column is total_xp (new) or xp (old)
    let totalXP = Number(progress?.total_xp ?? progress?.xp ?? 0);

    if (!progress) {
      const agg = await prisma.xpEvent.aggregate({
        where: { user_id: userId },
        _sum: { xp_delta: true },
      });
      totalXP = Number(agg._sum.xp_delta || 0);
    }

    /* ---------------- Aggregations ---------------- */

    async function sumXP(where) {
      const agg = await prisma.xpEvent.aggregate({
        where,
        _sum: { xp_delta: true },
      });
      return Number(agg._sum.xp_delta || 0);
    }

    const todayXP = await sumXP({
      user_id: userId,
      created_at: { gte: todayStart },
    });
    const yesterdayXP = await sumXP({
      user_id: userId,
      created_at: { gte: yesterdayStart, lt: todayStart },
    });
    const weeklyXP = await sumXP({
      user_id: userId,
      created_at: { gte: sevenDaysAgo },
    });
    const lastWeekXP = await sumXP({
      user_id: userId,
      created_at: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
    });
    const monthlyXP = await sumXP({
      user_id: userId,
      created_at: { gte: thirtyDaysAgo },
    });

    /* ---------------- Levels ---------------- */
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

    const xpToNextLevel = Math.max(next.xp - totalXP, 0);

    /* ---------------- Badge System ---------------- */
    const badges = await prisma.badge.findMany({
      orderBy: { min_xp: "asc" },
    });

    let nextBadge = null;
    for (const b of badges) {
      if (totalXP < b.min_xp) {
        nextBadge = {
          code: b.code,
          label: b.label,
          minXP: Number(b.min_xp),
          remainingXP: Number(b.min_xp) - totalXP,
        };
        break;
      }
    }

    /* ---------------- Recent XP Events ---------------- */
    // Recent activity (last 10 events) — match client expected keys
    const recentRaw = await prisma.xpEvent.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: 10,
    });

    const recentActivity = recentRaw.map((e) => ({
      id: e.id,
      xp_delta: Number(e.xp_delta),
      event_type: e.event_type,
      created_at: e.created_at,
      meta: e.meta,
    }));

    const streak = Number(progress?.streak ?? 0);

    const response = {
      todayXP,
      yesterdayXP,
      weeklyXP,
      lastWeekXP,
      monthlyXP,
      streak,
      totalXP: Number(totalXP),
      level: current.level,
      xpToNextLevel,
      nextBadge,
      pendingLessons: [],
      recentActivity,
    };

    return res.json(toCleanJSON(response));
  } catch (err) {
    console.error("❌ /api/dashboard/summary error:", err);
    return res.status(500).json({ error: "Failed to load dashboard summary" });
  }
});

export default router;
