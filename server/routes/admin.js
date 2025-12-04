// server/routes/admin.js
import express from "express";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";
import requireAdmin from "../middleware/admin.js";

const router = express.Router();

/* ───────────────────────────────
   SIMPLE HEALTH CHECK
   GET /api/admin/health
──────────────────────────────── */
router.get("/health", (req, res) => {
  res.json({
    ok: true,
    message: "Admin API is running",
    timestamp: new Date().toISOString(),
  });
});

/* ───────────────────────────────
   ADMIN OVERVIEW
   GET /api/admin/overview
──────────────────────────────── */
router.get("/overview", authRequired, requireAdmin, async (_req, res) => {
  try {
    const [totalUsers, totalQuizzes, totalXP] = await Promise.all([
      prisma.user.count(),
      prisma.quiz.count(),
      prisma.xpEvent.aggregate({ _sum: { amount: true } }),
    ]);

    return res.json({
      ok: true,
      data: {
        totalUsers,
        totalQuizzes,
        totalXP: totalXP._sum.amount || 0,
      },
    });
  } catch (err) {
    console.error("Admin /overview error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

/* ───────────────────────────────
   ADMIN: GET ALL USERS
   GET /api/admin/users
──────────────────────────────── */
router.get("/users", authRequired, requireAdmin, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        isAdmin: true,
        xpTotal: true,
        xpWeekly: true,
        xpMonthly: true,
        streak: true,
        lastActiveAt: true,
      },
    });

    return res.json({ ok: true, users });
  } catch (error) {
    console.error("Admin /users error:", error);
    return res.status(500).json({ ok: false, error: "Failed to load users" });
  }
});

/* ───────────────────────────────
   ADMIN: PROMOTE USER
   POST /api/admin/promote
──────────────────────────────── */
router.post("/promote", authRequired, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ ok: false, message: "userId required" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    if (user.isAdmin) {
      return res.json({ ok: true, message: "User already admin" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isAdmin: true },
    });

    return res.json({ ok: true, message: "User promoted" });
  } catch (err) {
    console.error("Admin promote error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

/* ───────────────────────────────
   ADMIN: DEMOTE USER
   POST /api/admin/demote
──────────────────────────────── */
router.post("/demote", authRequired, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ ok: false, message: "userId required" });
    }

    // prevent self-demotion
    if (userId === req.user.id) {
      return res
        .status(400)
        .json({ ok: false, message: "You cannot demote yourself" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    if (!user.isAdmin) {
      return res.json({ ok: true, message: "Already not admin" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isAdmin: false },
    });

    return res.json({ ok: true, message: "User demoted" });
  } catch (err) {
    console.error("Admin demote error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

/* ───────────────────────────────
   ADMIN: DELETE USER
   POST /api/admin/delete
──────────────────────────────── */
router.post("/delete", authRequired, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ ok: false, message: "userId required" });
    }

    // prevent deleting your own account
    if (userId === req.user.id) {
      return res
        .status(400)
        .json({ ok: false, message: "You cannot delete your own account." });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    await prisma.user.delete({ where: { id: userId } });

    return res.json({ ok: true, message: "User deleted successfully" });
  } catch (err) {
    console.error("Admin delete error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

/* ───────────────────────────────
   ADMIN: XP LOGS (ALL USERS)
   GET /api/admin/xp
──────────────────────────────── */
router.get("/xp", authRequired, requireAdmin, async (_req, res) => {
  try {
    const logs = await prisma.xpEvent.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return res.json({ ok: true, logs });
  } catch (err) {
    console.error("Admin /xp error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

/* ───────────────────────────────
   ADMIN: USER DETAIL + XP HISTORY
   GET /api/admin/user/:id
──────────────────────────────── */
router.get("/user/:id", authRequired, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        lastActiveAt: true,
        isAdmin: true,
        xpTotal: true,
        xpWeekly: true,
        xpMonthly: true,
        streak: true,
      },
    });

    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    const xpEvents = await prisma.xpEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100, // last 100 events
    });

    return res.json({ ok: true, user, xpEvents });
  } catch (err) {
    console.error("Admin /user/:id error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

/* ───────────────────────────────
   ADMIN: XP ADJUST
   POST /api/admin/xp-adjust
──────────────────────────────── */
router.post("/xp-adjust", authRequired, requireAdmin, async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;

    if (!userId || amount == null || !reason) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }

    const xp = parseInt(amount, 10);
    if (Number.isNaN(xp)) {
      return res.status(400).json({ ok: false, error: "Invalid XP" });
    }

    // Create XP event
    await prisma.xpEvent.create({
      data: {
        userId,
        amount: xp,
        reason: `[ADMIN]: ${reason}`,
      },
    });

    // Update totals
    await prisma.user.update({
      where: { id: userId },
      data: {
        xpTotal: { increment: xp },
      },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("XP adjust error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* ╔════════════════════════════════════════╗
   ║      ADMIN DIAGNOSTICS ENDPOINTS       ║
   ╚════════════════════════════════════════╝ */

/* ───────────────────────────────
   DIAG: LIST IMPORTANT ROUTES
   GET /api/admin/diagnostics/routes
──────────────────────────────── */
router.get(
  "/diagnostics/routes",
  authRequired,
  requireAdmin,
  async (_req, res) => {
    const routes = [
      "GET    /api/admin/health",
      "GET    /api/admin/overview",
      "GET    /api/admin/users",
      "POST   /api/admin/promote",
      "POST   /api/admin/demote",
      "POST   /api/admin/delete",
      "GET    /api/admin/xp",
      "GET    /api/admin/user/:id",
      "POST   /api/admin/xp-adjust",
      "GET    /api/admin/metrics/summary",
      "GET    /api/admin/metrics/xp-trend",
      "GET    /api/admin/metrics/top-users",
      "GET    /api/admin/metrics/retention",
      "GET    /api/admin/diagnostics/env",
      "GET    /api/admin/diagnostics/db",
      "GET    /api/admin/diagnostics/stats",
    ];

    return res.json({ ok: true, routes });
  },
);

/* ───────────────────────────────
   DIAG: ENV SNAPSHOT (SAFE)
   GET /api/admin/diagnostics/env
──────────────────────────────── */
router.get("/diagnostics/env", authRequired, requireAdmin, (req, res) => {
  return res.json({
    ok: true,
    data: {
      nodeEnv: process.env.NODE_ENV || "unknown",
      railwayEnv: process.env.RAILWAY_ENVIRONMENT || null,
      dbUrlSet: !!process.env.DATABASE_URL,
      jwtSecretSet: !!process.env.JWT_SECRET,
      requestIp:
        req.headers["x-forwarded-for"] || req.socket.remoteAddress || null,
      now: new Date().toISOString(),
    },
  });
});

/* ───────────────────────────────
   DIAG: DATABASE HEALTH
   GET /api/admin/diagnostics/db
──────────────────────────────── */
router.get("/diagnostics/db", authRequired, requireAdmin, async (_req, res) => {
  const startedAt = Date.now();
  try {
    const userCount = await prisma.user.count();
    const durationMs = Date.now() - startedAt;

    return res.json({
      ok: true,
      data: {
        userCount,
        durationMs,
      },
    });
  } catch (err) {
    console.error("Admin /diagnostics/db error:", err);
    return res.status(500).json({
      ok: false,
      message: "DB check failed",
      error: err.message,
    });
  }
});

/* ───────────────────────────────
   DIAG: QUICK STATS
   GET /api/admin/diagnostics/stats
──────────────────────────────── */
router.get(
  "/diagnostics/stats",
  authRequired,
  requireAdmin,
  async (_req, res) => {
    try {
      const [totalUsers, totalXpEvents] = await Promise.all([
        prisma.user.count(),
        prisma.xpEvent.count(),
      ]);

      return res.json({
        ok: true,
        data: {
          totalUsers,
          totalXpEvents,
        },
      });
    } catch (err) {
      console.error("Admin /diagnostics/stats error:", err);
      return res
        .status(500)
        .json({ ok: false, message: "Failed to load stats" });
    }
  },
);

/* ╔════════════════════════════════════════╗
   ║        ADVANCED ADMIN METRICS          ║
   ╚════════════════════════════════════════╝ */

// helper: format date as YYYY-MM-DD
function formatDay(date) {
  return date.toISOString().slice(0, 10);
}

/* ───────────────────────────────
   METRICS: SUMMARY
   GET /api/admin/metrics/summary
──────────────────────────────── */
router.get(
  "/metrics/summary",
  authRequired,
  requireAdmin,
  async (_req, res) => {
    try {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const sevenDaysAgo = new Date(now - 7 * dayMs);
      const thirtyDaysAgo = new Date(now - 30 * dayMs);

      const [users, xpAgg] = await Promise.all([
        prisma.user.findMany({
          select: {
            id: true,
            createdAt: true,
            lastActiveAt: true,
            streak: true,
            xpTotal: true,
          },
        }),
        prisma.xpEvent.aggregate({
          _sum: { amount: true },
        }),
      ]);

      const totalXP = xpAgg._sum.amount || 0;

      let weeklyActive = 0;
      let monthlyActive = 0;
      let newUsers7d = 0;
      let streak1Plus = 0;
      let streak7Plus = 0;

      for (const u of users) {
        if (u.createdAt >= sevenDaysAgo) newUsers7d += 1;
        if (u.lastActiveAt && u.lastActiveAt >= sevenDaysAgo) weeklyActive += 1;
        if (u.lastActiveAt && u.lastActiveAt >= thirtyDaysAgo)
          monthlyActive += 1;
        if (u.streak >= 1) streak1Plus += 1;
        if (u.streak >= 7) streak7Plus += 1;
      }

      const totalUsers = users.length;
      const avgXPPerUser = totalUsers ? Math.round(totalXP / totalUsers) : 0;

      return res.json({
        ok: true,
        data: {
          totalUsers,
          totalXP,
          avgXPPerUser,
          weeklyActive,
          monthlyActive,
          newUsers7d,
          streak1Plus,
          streak7Plus,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error("Admin /metrics/summary error:", err);
      return res
        .status(500)
        .json({ ok: false, message: "Failed to load metrics summary" });
    }
  },
);

/* ───────────────────────────────
   METRICS: XP TREND (last N days)
   GET /api/admin/metrics/xp-trend?days=14
──────────────────────────────── */
router.get(
  "/metrics/xp-trend",
  authRequired,
  requireAdmin,
  async (req, res) => {
    try {
      const daysParam = parseInt(req.query.days, 10);
      const days = Number.isNaN(daysParam)
        ? 14
        : Math.min(Math.max(daysParam, 1), 90);

      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const events = await prisma.xpEvent.findMany({
        where: { createdAt: { gte: cutoff } },
        select: { amount: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      });

      const buckets = {};
      for (const ev of events) {
        const d = formatDay(ev.createdAt);
        if (!buckets[d]) {
          buckets[d] = { date: d, totalXP: 0, events: 0 };
        }
        buckets[d].totalXP += ev.amount;
        buckets[d].events += 1;
      }

      const trend = Object.values(buckets).sort((a, b) =>
        a.date.localeCompare(b.date),
      );

      return res.json({
        ok: true,
        data: {
          days,
          trend,
        },
      });
    } catch (err) {
      console.error("Admin /metrics/xp-trend error:", err);
      return res
        .status(500)
        .json({ ok: false, message: "Failed to load XP trend" });
    }
  },
);

/* ───────────────────────────────
   METRICS: TOP USERS BY XP
   GET /api/admin/metrics/top-users?limit=20
──────────────────────────────── */
router.get(
  "/metrics/top-users",
  authRequired,
  requireAdmin,
  async (req, res) => {
    try {
      const limitParam = parseInt(req.query.limit, 10);
      const take = Number.isNaN(limitParam)
        ? 20
        : Math.min(Math.max(limitParam, 1), 100);

      const users = await prisma.user.findMany({
        orderBy: { xpTotal: "desc" },
        take,
        select: {
          id: true,
          name: true,
          email: true,
          xpTotal: true,
          xpWeekly: true,
          xpMonthly: true,
          streak: true,
          lastActiveAt: true,
          createdAt: true,
        },
      });

      return res.json({ ok: true, data: { take, users } });
    } catch (err) {
      console.error("Admin /metrics/top-users error:", err);
      return res
        .status(500)
        .json({ ok: false, message: "Failed to load top users" });
    }
  },
);

/* ───────────────────────────────
   METRICS: SIMPLE RETENTION
   GET /api/admin/metrics/retention
──────────────────────────────── */
router.get(
  "/metrics/retention",
  authRequired,
  requireAdmin,
  async (_req, res) => {
    try {
      const dayMs = 24 * 60 * 60 * 1000;

      const users = await prisma.user.findMany({
        select: {
          id: true,
          createdAt: true,
          lastActiveAt: true,
        },
      });

      let d1 = 0;
      let d7 = 0;
      let d30 = 0;

      for (const u of users) {
        if (!u.lastActiveAt) continue;
        const ageDays =
          (u.lastActiveAt.getTime() - u.createdAt.getTime()) / dayMs;
        if (ageDays >= 1) d1 += 1;
        if (ageDays >= 7) d7 += 1;
        if (ageDays >= 30) d30 += 1;
      }

      const totalUsers = users.length;
      const pct = (num) =>
        totalUsers === 0 ? 0 : Math.round((num / totalUsers) * 100);

      return res.json({
        ok: true,
        data: {
          totalUsers,
          d1Retained: d1,
          d7Retained: d7,
          d30Retained: d30,
          d1RetainedPct: pct(d1),
          d7RetainedPct: pct(d7),
          d30RetainedPct: pct(d30),
        },
      });
    } catch (err) {
      console.error("Admin /metrics/retention error:", err);
      return res
        .status(500)
        .json({ ok: false, message: "Failed to load retention metrics" });
    }
  },
);
// ---------------------------------------------
// Admin Analytics Summary
// ---------------------------------------------
router.get("/analytics/summary", async (req, res) => {
  try {
    // Basic counts
    const userCount = await prisma.user.count();
    const lessonCount = await prisma.lesson.count();

    // Quiz count (safe even if you temporarily don't use it)
    let quizCount = 0;
    try {
      // This works once the Quiz model + migration exist
      quizCount = await prisma.quiz.count();
    } catch (err) {
      console.warn("Quiz model not available yet, quizCount = 0");
      quizCount = 0;
    }

    // XP aggregation
    const totalXpAgg = await prisma.userProgress.aggregate({
      _sum: { xp: true },
    });

    const xpEventCount = await prisma.xpEvent.count();

    // Recent events
    const recentEvents = await prisma.xpEvent.findMany({
      orderBy: { created_at: "desc" },
      take: 10,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Top users (by xp)
    const topUsers = await prisma.userProgress.findMany({
      orderBy: { xp: "desc" },
      take: 5,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json({
      ok: true,
      metrics: {
        userCount,
        lessonCount,
        quizCount,
        totalXp: totalXpAgg._sum.xp ?? 0,
        xpEventCount,
      },
      topUsers: topUsers.map((row) => ({
        id: row.user.id,
        name: row.user.name || "(no name)",
        email: row.user.email,
        xp: row.xp,
      })),
      recentEvents: recentEvents.map((ev) => ({
        id: ev.id,
        xp: ev.xp_delta,
        type: ev.event_type,
        userEmail: ev.user?.email ?? null,
        created_at: ev.created_at,
      })),
    });
  } catch (err) {
    console.error("Admin analytics error", err);
    res.status(500).json({
      ok: false,
      message: "Failed to load analytics summary",
    });
  }
});
// 🔍 Admin Analytics Dashboard
router.get("/analytics", authRequired, requireAdmin, async (req, res) => {
  try {
    // --- Date helpers ---
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6); // last 7 days including today

    const formatDateKey = (d) => d.toISOString().slice(0, 10); // "YYYY-MM-DD"

    // --- SUMMARY TILE QUERIES ---
    const [totalUsers, totalLessons, totalQuizzes] = await Promise.all([
      prisma.user.count(),
      prisma.lesson.count(),
      prisma.quiz.count(),
    ]);

    const [newUsersToday, todayXpAgg, activeUsersTodayRows] = await Promise.all(
      [
        prisma.user.count({
          where: {
            createdAt: {
              gte: today,
              lt: tomorrow,
            },
          },
        }),
        prisma.xpEvent.aggregate({
          _sum: {
            amount: true,
          },
          where: {
            createdAt: {
              gte: today,
              lt: tomorrow,
            },
          },
        }),
        prisma.xpEvent.groupBy({
          by: ["userId"],
          where: {
            createdAt: {
              gte: today,
              lt: tomorrow,
            },
          },
          _sum: {
            amount: true,
          },
        }),
      ],
    );

    const todayXp = todayXpAgg._sum.amount || 0;
    const activeUsersToday = activeUsersTodayRows.length;

    // --- DAILY SIGNUPS (LAST 7 DAYS) ---
    const signupsRaw = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
      select: {
        createdAt: true,
      },
    });

    const dailySignupsMap = {};
    for (const u of signupsRaw) {
      const key = formatDateKey(u.createdAt);
      dailySignupsMap[key] = (dailySignupsMap[key] || 0) + 1;
    }

    const dailySignups = Object.entries(dailySignupsMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // --- DAILY XP (LAST 7 DAYS) ---
    const xpEventsLast7 = await prisma.xpEvent.findMany({
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
      select: {
        createdAt: true,
        amount: true,
      },
    });

    const dailyXpMap = {};
    for (const e of xpEventsLast7) {
      const key = formatDateKey(e.createdAt);
      dailyXpMap[key] = (dailyXpMap[key] || 0) + (e.amount || 0);
    }

    const dailyXp = Object.entries(dailyXpMap)
      .map(([date, xp]) => ({ date, xp }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // --- TOTAL XP LEADERBOARD (TOP 10) ---
    const leaderboardRaw = await prisma.xpEvent.groupBy({
      by: ["userId"],
      _sum: {
        amount: true,
      },
      orderBy: {
        _sum: {
          amount: "desc",
        },
      },
      take: 10,
    });

    const leaderboardUserIds = leaderboardRaw.map((row) => row.userId);
    const leaderboardUsers = leaderboardUserIds.length
      ? await prisma.user.findMany({
          where: {
            id: {
              in: leaderboardUserIds,
            },
          },
          select: {
            id: true,
            name: true,
            email: true,
          },
        })
      : [];

    const leaderboardUserById = Object.fromEntries(
      leaderboardUsers.map((u) => [u.id, u]),
    );

    const totalXpLeaderboard = leaderboardRaw.map((row) => ({
      userId: row.userId,
      name: leaderboardUserById[row.userId]?.name || null,
      email: leaderboardUserById[row.userId]?.email || null,
      totalXp: row._sum.amount || 0,
    }));

    // --- LESSON ENGAGEMENT (AGGREGATED XP PER LESSON) ---
    // Assumes XPEvent has optional lessonId and amount fields.
    // This gives admin a heatmap-style dataset (we’ll visualize on frontend).
    const lessonEngagementRaw = await prisma.xpEvent.groupBy({
      by: ["lessonId"],
      where: {
        lessonId: {
          not: null,
        },
      },
      _sum: {
        amount: true,
      },
      orderBy: {
        _sum: {
          amount: "desc",
        },
      },
      take: 20, // top 20 lessons by XP
    });

    const engagedLessonIds = lessonEngagementRaw
      .map((row) => row.lessonId)
      .filter(Boolean);

    const engagedLessons = engagedLessonIds.length
      ? await prisma.lesson.findMany({
          where: {
            id: {
              in: engagedLessonIds,
            },
          },
          select: {
            id: true,
            title: true,
          },
        })
      : [];

    const lessonById = Object.fromEntries(engagedLessons.map((l) => [l.id, l]));

    const lessonEngagement = lessonEngagementRaw.map((row) => ({
      lessonId: row.lessonId,
      lessonTitle: lessonById[row.lessonId]?.title || null,
      totalXp: row._sum.amount || 0,
    }));

    // --- XP DISTRIBUTION (BUCKETS) ---
    const totalXpPerUser = await prisma.xpEvent.groupBy({
      by: ["userId"],
      _sum: {
        amount: true,
      },
    });

    const xpBuckets = [
      { id: "0-999", min: 0, max: 999 },
      { id: "1k-4.9k", min: 1000, max: 4999 },
      { id: "5k-9.9k", min: 5000, max: 9999 },
      { id: "10k-49k", min: 10000, max: 49999 },
      { id: "50k+", min: 50000, max: Infinity },
    ];

    const bucketCounts = {};
    for (const row of totalXpPerUser) {
      const xp = row._sum.amount || 0;
      const bucket = xpBuckets.find((b) => xp >= b.min && xp <= b.max);
      if (!bucket) continue;
      bucketCounts[bucket.id] = (bucketCounts[bucket.id] || 0) + 1;
    }

    const xpDistribution = xpBuckets.map((b) => ({
      bucket: b.id,
      users: bucketCounts[b.id] || 0,
    }));

    // --- QUIZ PERFORMANCE PLACEHOLDER ---
    // We’ll wire real quiz performance stats when we enhance XP logging / quiz attempts.
    const quizPerformance = [];

    // --- FINAL RESPONSE (STABLE JSON SHAPE) ---
    return res.json({
      summary: {
        totalUsers,
        totalLessons,
        totalQuizzes,
        todayXp,
        newUsersToday,
        activeUsersToday,
      },
      dailySignups, // [{ date: "2025-11-24", count: 5 }, ...]
      dailyXp, // [{ date: "2025-11-24", xp: 1200 }, ...]
      totalXpLeaderboard, // [{ userId, name, email, totalXp }, ...]
      xpDistribution, // [{ bucket: "0-999", users: 10 }, ...]
      lessonEngagement, // [{ lessonId, lessonTitle, totalXp }, ...]
      quizPerformance, // [] for now, will fill later
    });
  } catch (err) {
    console.error("Error in /api/admin/analytics:", err);
    return res.status(500).json({ error: "Failed to load admin analytics" });
  }
});
// ─────────────────────────────────────────────
// Admin Analytics: /api/admin/analytics
// ─────────────────────────────────────────────

router.get("/analytics", authRequired, requireAdmin, async (req, res) => {
  try {
    const now = new Date();

    // Start of today (for "today XP", "active users today", "new users today")
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    // Last 30 days window (for charts)
    const rangeDays = 30;
    const fromDate = new Date(
      startOfToday.getFullYear(),
      startOfToday.getMonth(),
      startOfToday.getDate(),
    );
    fromDate.setDate(fromDate.getDate() - (rangeDays - 1));

    // 1) Basic counts
    const [totalUsers, newUsersToday, totalLessons, totalQuizzes] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({
          where: { createdAt: { gte: startOfToday } },
        }),
        prisma.lesson.count(),
        prisma.quiz.count(),
      ]);

    // 2) Data for charts (last 30 days)
    // NOTE: Replace `xpEvent` with your actual XP event client name.
    // If your Prisma model is `model XPEvent`, the client will likely be `prisma.xPEvent`.
    const [usersRange, xpEventsRange, xpEventsToday, topUsers] =
      await Promise.all([
        prisma.user.findMany({
          where: { createdAt: { gte: fromDate } },
          select: { id: true, createdAt: true },
        }),
        prisma.xpEvent.findMany({
          where: { createdAt: { gte: fromDate } },
          select: { amount: true, createdAt: true },
        }),
        prisma.xpEvent.findMany({
          where: { createdAt: { gte: startOfToday } },
          select: { userId: true, amount: true },
        }),
        prisma.user.findMany({
          orderBy: { xp: "desc" },
          take: 20,
          select: {
            id: true,
            name: true,
            email: true,
            xp: true,
            createdAt: true,
          },
        }),
      ]);

    // 3) Today: active users + today XP
    const activeUserIdsToday = new Set();
    let todayXp = 0;

    xpEventsToday.forEach((e) => {
      if (e.userId) activeUserIdsToday.add(e.userId);
      if (typeof e.amount === "number") todayXp += e.amount;
    });

    const activeUsersToday = activeUserIdsToday.size;

    // 4) Chart: daily signups (last 30 days)
    const dailySignupsMap = {};
    usersRange.forEach((u) => {
      const key = u.createdAt.toISOString().slice(0, 10); // YYYY-MM-DD
      dailySignupsMap[key] = (dailySignupsMap[key] || 0) + 1;
    });

    // 5) Chart: daily XP (last 30 days)
    const dailyXpMap = {};
    xpEventsRange.forEach((e) => {
      const key = e.createdAt.toISOString().slice(0, 10);
      const amount = typeof e.amount === "number" ? e.amount : 0;
      dailyXpMap[key] = (dailyXpMap[key] || 0) + amount;
    });

    const toSortedArray = (map, valueKey) =>
      Object.keys(map)
        .sort()
        .map((date) => ({
          date,
          [valueKey]: map[date],
        }));

    const dailySignups = toSortedArray(dailySignupsMap, "count");
    const dailyXp = toSortedArray(dailyXpMap, "xp");

    // 6) XP distribution across all users
    const usersForDistribution = await prisma.user.findMany({
      select: { xp: true },
    });

    const bucketDefs = [
      { label: "0–999", min: 0, max: 999 },
      { label: "1k–4.9k", min: 1000, max: 4999 },
      { label: "5k–9.9k", min: 5000, max: 9999 },
      { label: "10k–24.9k", min: 10000, max: 24999 },
      { label: "25k–49.9k", min: 25000, max: 49999 },
      { label: "50k+", min: 50000, max: Infinity },
    ];

    const xpDistribution = bucketDefs.map((b) => ({
      label: b.label,
      count: 0,
    }));

    usersForDistribution.forEach((user) => {
      const value = typeof user.xp === "number" ? user.xp : 0;
      const index = bucketDefs.findIndex(
        (b) => value >= b.min && value <= b.max,
      );
      if (index !== -1) {
        xpDistribution[index].count += 1;
      }
    });

    // 7) Response
    res.json({
      summary: {
        totalUsers,
        todayXp,
        activeUsersToday,
        newUsersToday,
        totalLessons,
        totalQuizzes,
      },
      charts: {
        dailySignups,
        dailyXp,
        xpDistribution,
        topUsersByXp: topUsers,
      },
      meta: {
        rangeDays,
        generatedAt: now.toISOString(),
      },
    });
  } catch (err) {
    console.error("Admin analytics error:", err);
    res.status(500).json({ error: "Failed to load admin analytics" });
  }
});

export default router;
