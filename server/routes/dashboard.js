import express from "express";
import prisma from "../db/prisma.js"; // ✅ Correct path for your project
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

/*
  SAFE DASHBOARD SUMMARY API
  - Never crashes
  - Returns defaults if DB is missing data
  - Works with empty XP tables
*/

router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // ---------- USER PROGRESS ----------
    const userProg = await prisma.userProgress.findUnique({
      where: { user_id: userId },
    });

    const totalXP = userProg?.total_xp ?? 0;
    const level = userProg?.level ?? 1;
    const streak = userProg?.consecutive_days ?? 0;

    // ---------- XP EVENTS (SAFE) ----------
    const events = await prisma.xpEvent.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: 10,
    });

    const recentActivity = events.map((e) => ({
      id: e.id,
      amount: e.xp_delta,
      type: e.event_type,
      at: e.created_at,
    }));

    // ---------- AGGREGATES ----------
    const todayXP = await prisma.xpEvent.aggregate({
      where: {
        user_id: userId,
        created_at: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
      _sum: { xp_delta: true },
    });

    const yesterdayStart = new Date();
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    yesterdayStart.setHours(0, 0, 0, 0);

    const yesterdayEnd = new Date();
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const yesterdayXP = await prisma.xpEvent.aggregate({
      where: {
        user_id: userId,
        created_at: { gte: yesterdayStart, lte: yesterdayEnd },
      },
      _sum: { xp_delta: true },
    });

    // ---------- RESPONSE ----------
    return res.json({
      ok: true,
      todayXP: todayXP._sum.xp_delta ?? 0,
      yesterdayXP: yesterdayXP._sum.xp_delta ?? 0,
      weeklyXP: 0, // (Optional) Add later
      lastWeekXP: 0, // (Optional) Add later
      totalXP,
      level,
      nextLevelXP: 0,
      nextBadge: null,
      pendingLessons: [],
      recentActivity,
      streak,
    });
  } catch (err) {
    console.error("DASHBOARD ERROR:", err);

    return res.json({
      ok: false,
      message: "Using fallback",
      todayXP: 0,
      yesterdayXP: 0,
      weeklyXP: 0,
      lastWeekXP: 0,
      totalXP: 0,
      level: 1,
      nextLevelXP: 0,
      nextBadge: null,
      pendingLessons: [],
      recentActivity: [],
      streak: 0,
    });
  }
});

export default router;
