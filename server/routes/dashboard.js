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
  const day = x.getDay();
  const diff = (day + 6) % 7;
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

    const progress = await prisma.userProgress.findUnique({
      where: { user_id: userId },
    });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, xpTotal: true },
    });

    const computedTotal = await sumXpForRange({ userId });
    const storedTotal = Number(user?.xpTotal ?? progress?.xp ?? 0);
    const totalXP = Math.max(
      computedTotal,
      Number.isFinite(storedTotal) ? storedTotal : 0,
    );

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

    const weeklyEvents = await prisma.xpEvent.findMany({
      where: { user_id: userId, created_at: { gte: weekStart } },
      select: { created_at: true },
    });
    const uniqueDays = new Set(
      weeklyEvents.map((e) => e.created_at.toDateString()),
    ).size;

    const levelSize = 1000;
    const level = Math.floor(totalXP / levelSize) + 1;
    const xpToNextLevel = levelSize - (totalXP % levelSize);
    const streak = Number(progress?.streak ?? 0);
    const streakFreezes = Number(progress?.streak_freezes ?? 0);

    const events = await prisma.xpEvent.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: 8,
    });
    const recentActivity = (events || []).map((e) => ({
      event_type: e.type ?? "XP",
      xp_delta: Number(e.xp_delta ?? 0),
      created_at: e.created_at ?? new Date(),
    }));

    const earnedBadges = await prisma.userBadge.findMany({
      where: { user_id: userId },
      orderBy: { earned_at: "desc" },
    });

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
      uniqueDays,
      streakFreezes,
      earnedBadges,
      recentActivity,
    });
  } catch (err) {
    console.error("❌ Dashboard Error:", err);
    res.status(500).json({ ok: false });
  }
});

export default router;
