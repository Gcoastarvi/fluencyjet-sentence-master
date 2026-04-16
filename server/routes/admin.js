// server/routes/admin.js
import express from "express";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";
import requireAdmin from "../middleware/admin.js";

const router = express.Router();

// 🎯 THE DIAGNOSTIC PIPE
router.get("/test-connection", (req, res) => {
  res.json({ ok: true, message: "The Admin Pipe is OPEN! 🚀" });
});

/* ─────────────────────────────────────────────
   HEALTH CHECK
────────────────────────────────────────────── */
router.get("/health", (req, res) => {
  res.json({
    ok: true,
    message: "Admin API is running",
    timestamp: new Date().toISOString(),
  });
});

/* ─────────────────────────────────────────────
   ADMIN OVERVIEW
────────────────────────────────────────────── */
router.get("/overview", authRequired, requireAdmin, async (req, res) => {
  try {
    const [userCount, lessonCount, quizCount] = await Promise.all([
      prisma.user.count(),
      prisma.lesson.count(),
      prisma.quiz.count(),
    ]);

    res.json({
      ok: true,
      overview: {
        totalUsers: userCount,
        totalLessons: lessonCount,
        totalQuizzes: quizCount,
      },
    });
  } catch (err) {
    console.error("Admin overview error:", err);
    res
      .status(500)
      .json({ ok: false, message: "Failed to load admin overview" });
  }
});

/* ─────────────────────────────────────────────
   USER BULK DELETE
────────────────────────────────────────────── */

router.delete(
  "/users/bulk-cleanup",
  authRequired,
  requireAdmin,
  async (req, res) => {
    const { emails } = req.body;
    await prisma.user.deleteMany({
      where: { email: { in: emails } },
    });
    res.json({ ok: true });
  },
);

/* ─────────────────────────────────────────────
   ADMIN USER LIST
────────────────────────────────────────────── */
router.get("/users", authRequired, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        username: true, // 🎯 For the Avatar and Search
        track: true, // 🎯 For the Beginner/Intermediate dropdown
        has_access: true, // 🎯 For the Grant Access button
        total_xp: true, // 🎯 For the "Avg XP / Student" card
        daily_streak: true, // 🎯 For the student card subtitle
        created_at: true,
        isAdmin: true,
      },
    });

    res.json({ ok: true, users });
  } catch (err) {
    console.error("Admin users error:", err);
    res.status(500).json({ ok: false, message: "Failed to fetch users" });
  }
});
/* ─────────────────────────────────────────────
   ADMIN USER DETAIL + PLAN TOGGLE
────────────────────────────────────────────── */

// Get a single user + recent XP events
router.get("/users/:id", authRequired, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        created_at: true,
        isAdmin: true,
        has_access: true,
        tier_level: true,
      },
    });

    if (!user) return res.status(404).json({ ok: false, message: "Not found" });

    // Pull recent XP events for this user (adjust if your schema differs)
    const xpEvents = await prisma.xpEvent.findMany({
      where: { user_id: id },
      orderBy: { created_at: "desc" },
      take: 200,
      select: {
        id: true,
        xp_delta: true,
        event_type: true,
        created_at: true,
      },
    });

    // Shape the response to match your AdminUserDetail expectations
    return res.json({
      ok: true,
      user: {
        ...user,
        // Optional aggregates (safe defaults if you don’t compute them yet)
        xpTotal: 0,
        xpWeekly: 0,
        xpMonthly: 0,
        streak: user.streak || 0,
      },
      xpEvents: xpEvents.map((e) => ({
        id: e.id,
        amount: e.xp_delta,
        reason: e.event_type,
        createdAt: e.created_at,
      })),
    });
  } catch (err) {
    console.error("Admin user detail error:", err);
    return res.status(500).json({ ok: false, message: "Failed to load user" });
  }
});

/* ─────────────────────────────────────────────
   Who's Learning List
────────────────────────────────────────────── */

router.get("/activity", authRequired, requireAdmin, async (req, res) => {
  const users = await prisma.user.findMany({
    take: 10,
    orderBy: { updatedAt: "desc" },
    select: { email: true, xp: true, updatedAt: true },
  });
  res.json({ ok: true, users });
});

router.patch(
  "/users/:id/access",
  authRequired,
  requireAdmin,
  async (req, res) => {
    const { plan, track, hasAccess } = req.body; // 🎯 Added 'track' and 'hasAccess'

    try {
      const updated = await prisma.user.update({
        where: { id: req.params.id },
        data: {
          plan: plan || "PRO",
          track: track || "BEGINNER", // 🎯 Sets the level
          has_access: hasAccess ?? true,
        },
        select: { id: true, email: true, track: true, has_access: true },
      });

      return res.json({ ok: true, user: updated });
    } catch (err) {
      return res
        .status(500)
        .json({ ok: false, message: "ACCESS_UPDATE_FAILED" });
    }
  },
);

/* ─────────────────────────────────────────────
   STUDENT BULK ENROL / BULK ACCESS
────────────────────────────────────────────── */
router.post(
  "/users/bulk-access",
  authRequired,
  requireAdmin,
  async (req, res) => {
    const { emails, track, plan } = req.body;
    // 'emails' is an array: ["user1@gmail.com", "user2@gmail.com"]

    const results = await prisma.user.updateMany({
      where: {
        email: { in: emails.map((e) => e.toLowerCase().trim()) },
      },
      data: {
        has_access: true,
        plan: plan || "PRO",
        track: track || "BEGINNER",
      },
    });

    res.json({ ok: true, count: results.count });
  },
);

/* ─────────────────────────────────────────────
   ADMIN PROMOTE / DEMOTE
────────────────────────────────────────────── */
router.post("/promote", authRequired, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    await prisma.user.update({
      where: { id: userId },
      data: { isAdmin: true },
    });

    res.json({ ok: true, message: "User promoted to admin" });
  } catch (err) {
    console.error("Promote error:", err);
    res.status(500).json({ ok: false, message: "Failed to promote user" });
  }
});

router.post("/demote", authRequired, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    await prisma.user.update({
      where: { id: userId },
      data: { isAdmin: false },
    });

    res.json({ ok: true, message: "User demoted" });
  } catch (err) {
    console.error("Demote error:", err);
    res.status(500).json({ ok: false, message: "Failed to demote user" });
  }
});

/* ─────────────────────────────────────────────
   XP ADJUST FOR USERS
────────────────────────────────────────────── */
router.post("/xp-adjust", authRequired, requireAdmin, async (req, res) => {
  try {
    const { userId, delta } = req.body;

    // Log XP event
    await prisma.xpEvent.create({
      data: {
        user_id: userId,
        xp_delta: delta,
        event_type: "admin_adjust",
      },
    });

    // Update total XP
    await prisma.userProgress.updateMany({
      where: { user_id: userId },
      data: { total_xp: { increment: delta } },
    });

    res.json({ ok: true, message: "XP adjusted" });
  } catch (err) {
    console.error("XP adjust error:", err);
    res.status(500).json({ ok: false, message: "Failed to adjust XP" });
  }
});

/* ─────────────────────────────────────────────
   DIAGNOSTICS (ENV / DB)
────────────────────────────────────────────── */
router.get("/diagnostics/env", authRequired, requireAdmin, (req, res) => {
  res.json({
    ok: true,
    node: process.version,
    platform: process.platform,
    uptime: process.uptime(),
  });
});

router.get("/diagnostics/db", authRequired, requireAdmin, async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, message: "Database OK" });
  } catch (err) {
    res.status(500).json({ ok: false, message: "Database connection failed" });
  }
});

// 🎯 Reset Admin's own XP for testing
router.post("/reset-test-stats", authRequired, async (req, res) => {
  const userId = req.user.id; // Your test account

  // Wipe events and reset the user record
  await prisma.xpEvent.deleteMany({ where: { user_id: userId } });
  await prisma.user.update({
    where: { id: userId },
    data: { xpTotal: 0, daily_streak: 0, level: 1 },
  });

  res.json({ ok: true, message: "Stats reset to zero." });
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

    // 1) BASIC COUNTS + AGGREGATES
    const [
      totalUsers,
      newUsersToday,
      totalLessons,
      totalQuizzes,
      totalXpAgg,
      totalXpEvents,
      usersRange,
      xpEventsRange,
      xpEventsToday,
      topProgressRows,
    ] = await Promise.all([
      // total users
      prisma.user.count(),

      // new users created today
      prisma.user.count({
        where: { created_at: { gte: startOfToday } },
      }),

      // lessons + quizzes
      prisma.lesson.count(),
      prisma.quiz.count(),

      // sum of XP from UserProgress (xp field)
      prisma.userProgress.aggregate({
        _sum: { xp: true },
      }),

      // number of XP events logged
      prisma.xpEvent.count(),

      // users created in last 30 days (for signup chart)
      prisma.user.findMany({
        where: { created_at: { gte: fromDate } },
        select: { id: true, created_at: true },
      }),

      // XP events in last 30 days (for XP chart)
      prisma.xpEvent.findMany({
        where: { created_at: { gte: fromDate } },
        select: { user_id: true, xp_delta: true, created_at: true },
      }),

      // XP events today (for today XP + active users)
      prisma.xpEvent.findMany({
        where: { created_at: { gte: startOfToday } },
        select: { user_id: true, xp_delta: true },
      }),

      // Top users by current XP (UserProgress.xp)
      prisma.userProgress.findMany({
        orderBy: { xp: "desc" },
        take: 20,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              created_at: true,
            },
          },
        },
      }),
    ]);

    // 2) TODAY: ACTIVE USERS + TODAY XP
    const activeUserIdsToday = new Set();
    let todayXp = 0;

    xpEventsToday.forEach((e) => {
      if (e.user_id) activeUserIdsToday.add(e.user_id);
      if (typeof e.xp_delta === "number") todayXp += e.xp_delta;
    });

    const activeUsersToday = activeUserIdsToday.size;

    // 3) CHART: DAILY SIGNUPS (last 30 days)
    const dailySignupsMap = {};
    usersRange.forEach((u) => {
      const key = u.created_at.toISOString().slice(0, 10); // "YYYY-MM-DD"
      dailySignupsMap[key] = (dailySignupsMap[key] || 0) + 1;
    });

    const dailySignups = Object.keys(dailySignupsMap)
      .sort()
      .map((d) => ({ date: d, count: dailySignupsMap[d] }));

    // 4) CHART: DAILY XP (last 30 days)
    const dailyXpMap = {};
    xpEventsRange.forEach((e) => {
      const key = e.created_at.toISOString().slice(0, 10);
      dailyXpMap[key] = (dailyXpMap[key] || 0) + (e.xp_delta || 0);
    });

    const dailyXp = Object.keys(dailyXpMap)
      .sort()
      .map((d) => ({ date: d, xp: dailyXpMap[d] }));

    // 5) LEADERBOARD STYLE TOP USERS
    const topUsers = topProgressRows.map((row) => ({
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      joined_at: row.user.created_at,
      xp: row.xp,
    }));

    // FINAL RESPONSE
    return res.json({
      ok: true,
      summary: {
        totalUsers,
        newUsersToday,
        totalLessons,
        totalQuizzes,
        totalXp: totalXpAgg._sum.xp || 0,
        totalXpEvents,
        activeUsersToday,
        todayXp,
      },
      charts: {
        dailySignups,
        dailyXp,
      },
      topUsers,
    });
  } catch (err) {
    console.error("ADMIN ANALYTICS ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to load admin analytics",
    });
  }
});

/* ───────────────────────────────────────────── */

export default router;
