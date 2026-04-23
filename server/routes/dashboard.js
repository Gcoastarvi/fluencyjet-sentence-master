import express from "express";
import prisma from "../db/client.js";
import { authRequired } from "../middleware/authMiddleware.js";
import requireAdmin from "../middleware/admin.js"; // 🎯 THIS IS THE MISSING PIECE

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

// Logical pseudo-code for your streak calculation
async function calculateStreak(userId) {
  const progress = await prisma.userProgress.findUnique({
    where: { user_id: userId },
  });

  if (!progress) return 0;

  const lastActive = new Date(progress.updated_at);
  const today = new Date();

  // Difference in days
  const diffTime = Math.abs(today - lastActive);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 1) {
    // 🧊 CHECK FOR FREEZE
    if (progress.streak_freezes > 0) {
      await prisma.userProgress.update({
        where: { user_id: userId },
        data: {
          streak_freezes: { decrement: 1 },
          updated_at: new Date(), // Reset the "last active" clock to today
        },
      });
      console.log("Streak protected by Freeze! 🧊");
      return progress.streak;
    } else {
      // No freeze? Reset to 0
      return 0;
    }
  }
  return progress.streak;
}

// 🎯 Add this specifically for the Admin Dashboard
router.get("/", authRequired, requireAdmin, async (req, res) => {
  try {
    console.log("📊 Starting Admin Stats Fetch...");

    // 1. Count Users
    const userCount = await prisma.user.count();

    // 2. Count Lessons
    const lessonCount = await prisma.lesson.count();

    // 3. Get Total XP (Wrapped in a try/catch to prevent a total crash)
    let totalXp = 0;
    try {
      const xpResult = await prisma.user.aggregate({ _sum: { xp: true } });
      totalXp = xpResult._sum.xp || 0;
    } catch (xpErr) {
      console.warn("⚠️ XP column might be missing or empty:", xpErr.message);
    }

    res.json({
      ok: true,
      stats: {
        users: userCount,
        lessons: lessonCount,
        xp: totalXp,
      },
    });
  } catch (err) {
    console.error("❌ CRITICAL Admin Stats Error:", err);
    res
      .status(500)
      .json({ ok: false, message: `Server Error: ${err.message}` });
  }
});

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
      select: {
        id: true,
        name: true,
        email: true,
        xpTotal: true,
        daily_streak: true,
        lastActiveAt: true,
      },
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

    // --- Updated Weekly Goal Math (Mastery-Only) ---
    const weeklyMasteryEvents = await prisma.xpEvent.findMany({
      where: {
        user_id: userId,
        created_at: { gte: weekStart },
        xp_delta: 150, // 🎯 Only count Mastery sessions
      },
      select: { created_at: true },
    });

    // Inside router.get("/summary", ...)
    const dailyMissions = await prisma.xpEvent.findMany({
      where: {
        user_id: userId,
        created_at: { gte: todayStart },
        type: "INSTANT_ACCURACY", // Ensure this matches your session-end type
      },
    });

    const missionProgress = dailyMissions.length; // e.g., 2 out of 3
    const missionGoal = 3;
    const missionXpReward = 50;
    const missionCompleted = missionProgress >= missionGoal;

    // Inside your mission completion logic on the backend
    if (missionProgress === 3) {
      const currentMissionStreak = Number(progress?.mission_streak || 0); // 🚩 Add this line
      await prisma.userProgress.update({
        where: { user_id: userId },
        data: {
          mission_streak: { increment: 1 },
          // If they hit 5 days, add the 250 XP bonus
          xp: { increment: (currentMissionStreak + 1) % 5 === 0 ? 250 : 0 },
        },
      });
    }

    // Count unique days where Mastery was achieved
    const uniqueDays = new Set(
      weeklyMasteryEvents.map((e) => e.created_at.toDateString()),
    ).size;

    // Update your response object to include this new 'uniqueDays' count

    const levelSize = 1000;
    const level = Math.floor(totalXP / levelSize) + 1;
    const xpToNextLevel = levelSize - (totalXP % levelSize);
    const streak = Number(progress?.streak ?? user?.daily_streak ?? 0);
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

    /* ─────────────────────────────────────────────
        🌍 LIVE ACTIVITY FEED (real XP only, more stable)
    ────────────────────────────────────────────── */

    const liveWindowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days

    const rawEvents = await prisma.xpEvent.findMany({
      where: {
        created_at: { gte: liveWindowStart },
        xp_delta: { gt: 0 }, // ✅ hide technical 0-XP lock rows
      },
      take: 120, // ✅ broader pool so users don’t disappear too quickly
      orderBy: { created_at: "desc" },
      include: {
        user: {
          select: { id: true, name: true, username: true },
        },
      },
    });

    const seenUsers = new Set();
    const diverseFeed = [];

    for (const e of rawEvents) {
      const eventUserId = e.user_id;
      if (!seenUsers.has(eventUserId) && diverseFeed.length < 5) {
        seenUsers.add(eventUserId);
        diverseFeed.push({
          userName: e.user?.name || e.user?.username || "A Master",
          xp: Number(e.xp_delta || 0),
          type: "Lesson Mastery",
        });
      }
    }

    // Fallback: if fewer than 5 active users in the last 7 days,    
    // fill remaining slots from the most recent positive-XP events overall
    if (diverseFeed.length < 5) {
      const fallbackEvents = await prisma.xpEvent.findMany({
        where: {
          xp_delta: { gt: 0 },
        },
        take: 200,
        orderBy: { created_at: "desc" },
        include: {
          user: {
            select: { id: true, name: true, username: true },
          },
        },
      });

      for (const e of fallbackEvents) {
        const eventUserId = e.user_id;
        if (!seenUsers.has(eventUserId) && diverseFeed.length < 5) {
          seenUsers.add(eventUserId);
          diverseFeed.push({
            userName: e.user?.name || e.user?.username || "A Master",
            xp: Number(e.xp_delta || 0),
            type: "Lesson Mastery",
          });
        }
      }
    }

    const globalFeed = diverseFeed;

    // 🎯 THE PRESERVED HANDSHAKE
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
      globalFeed,
    });
  } catch (err) {
    console.error("❌ Dashboard Error:", err);
    res.status(500).json({ ok: false });
  }
});

export default router;
