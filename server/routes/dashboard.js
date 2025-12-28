// server/routes/dashboard.js
import express from "express";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";

const router = express.Router();

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeekMonday(d = new Date()) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0=Sun
  const diff = (day + 6) % 7; // Mon=0 ... Sun=6
  x.setDate(x.getDate() - diff);
  return x;
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

async function sumXpForRange({ userId, gte, lt }) {
  const where = { user_id: userId };
  if (gte || lt) {
    where.created_at = {};
    if (gte) where.created_at.gte = gte;
    if (lt) where.created_at.lt = lt;
  }

  const agg = await prisma.xpEvent.aggregate({
    where,
    _sum: { xp_delta: true },
  });

  return Number(agg?._sum?.xp_delta ?? 0);
}

router.get("/summary", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    const todayStart = startOfDay();
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const weekStart = startOfWeekMonday();
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const monthStart = startOfMonth();

    // --- progress (safe) ---
    let progress = null;
    try {
      progress = await prisma.userProgress.findUnique({
        where: { user_id: userId },
      });
    } catch {
      // ignore if table/field differs
    }

    // --- user (safe) ---
    let user = null;
    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, xpTotal: true },
      });
    } catch {
      // ignore
    }

    // --- XP totals ---
    let totalXP = Number(user?.xpTotal ?? progress?.xp ?? 0);
    if (!Number.isFinite(totalXP) || totalXP <= 0) {
      totalXP = await sumXpForRange({ userId });
    }

    const todayXP = await sumXpForRange({ userId, gte: todayStart });
    const yesterdayXP = await sumXpForRange({
      userId,
      gte: yesterdayStart,
      lt: todayStart,
    });

    const weeklyXP = await sumXpForRange({ userId, gte: weekStart });
    const lastWeekXP = await sumXpForRange({
      userId,
      gte: lastWeekStart,
      lt: weekStart,
    });

    const monthlyXP = await sumXpForRange({ userId, gte: monthStart });

    // --- Level math (1000 XP per level) ---
    const levelSize = 1000;
    const level = Math.floor(totalXP / levelSize) + 1;
    const xpIntoLevel = totalXP % levelSize;
    const xpToNextLevel = levelSize - xpIntoLevel;

    const streak = Number(progress?.streak ?? 0);

    // --- Recent activity (match Dashboard.jsx expects snake_case keys) ---
    const events = await prisma.xpEvent.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: 8,
    });

    const recentActivity = (events || []).map((e) => ({
      event_type: e.type_key ?? e.event_type ?? e.type ?? "XP",
      xp_delta: Number(e.xp_delta ?? 0),
      created_at: e.created_at ?? new Date(),
    }));

    // IMPORTANT: Do NOT call prisma.badge.* here (it crashes if model doesn't exist)

    return res.json({
      ok: true,
      todayXP,
      yesterdayXP,
      weeklyXP,
      lastWeekXP,
      monthlyXP,
      totalXP,
      level,
      xpToNextLevel,
      streak,
      nextBadge: null,
      pendingLessons: [],
      recentActivity,
    });
  } catch (err) {
    console.error("❌ /api/dashboard/summary error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to load dashboard summary" });
  }
});

export default router;
