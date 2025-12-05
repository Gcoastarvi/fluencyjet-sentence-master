// server/routes/admin.js
import express from "express";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";
import requireAdmin from "../middleware/admin.js";

const router = express.Router();

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
        created_at: true,
        isAdmin: true,
        has_access: true,
        tier_level: true,
      },
    });

    res.json({ ok: true, users });
  } catch (err) {
    console.error("Admin users error:", err);
    res.status(500).json({ ok: false, message: "Failed to fetch users" });
  }
});

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

/* ─────────────────────────────────────────────
   FINAL OFFICIAL ADMIN ANALYTICS ROUTE
────────────────────────────────────────────── */
router.get("/analytics", authRequired, requireAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rangeDays = 30;
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() - (rangeDays - 1));

    const [totalUsers, totalLessons, totalQuizzes, newUsersToday] =
      await Promise.all([
        prisma.user.count(),
        prisma.lesson.count(),
        prisma.quiz.count(),
        prisma.user.count({
          where: { created_at: { gte: today } },
        }),
      ]);

    /* ────────────────────────────────
       XP EVENT METRICS
    ───────────────────────────────── */
    const xpEvents = await prisma.xpEvent.findMany({
      where: { created_at: { gte: fromDate } },
      orderBy: { created_at: "asc" },
      select: {
        xp_delta: true,
        created_at: true,
        user_id: true,
      },
    });

    /* Daily XP map */
    const dailyXp = {};
    const activeUserIds = new Set();

    xpEvents.forEach((e) => {
      const key = e.created_at.toISOString().slice(0, 10);
      dailyXp[key] = (dailyXp[key] || 0) + e.xp_delta;
      activeUserIds.add(e.user_id);
    });

    /* Daily signups */
    const usersRange = await prisma.user.findMany({
      where: { created_at: { gte: fromDate } },
      select: { created_at: true },
    });

    const dailySignups = {};
    usersRange.forEach((u) => {
      const key = u.created_at.toISOString().slice(0, 10);
      dailySignups[key] = (dailySignups[key] || 0) + 1;
    });

    /* XP distribution */
    const buckets = {
      "0–500": 0,
      "501–2000": 0,
      "2001–5000": 0,
      "5001–10000": 0,
      "10000+": 0,
    };

    const allUserProgress = await prisma.userProgress.findMany({
      select: { user_id: true, total_xp: true },
    });

    allUserProgress.forEach((u) => {
      const xp = u.total_xp;
      if (xp <= 500) buckets["0–500"]++;
      else if (xp <= 2000) buckets["501–2000"]++;
      else if (xp <= 5000) buckets["2001–5000"]++;
      else if (xp <= 10000) buckets["5001–10000"]++;
      else buckets["10000+"]++;
    });

    /* Lesson engagement */
    const lessonViews = await prisma.lessonProgress.groupBy({
      by: ["lesson_id"],
      _count: { lesson_id: true },
    });

    const lessonEngagement = lessonViews.map((l) => ({
      lessonId: l.lesson_id,
      views: l._count.lesson_id,
    }));

    res.json({
      ok: true,
      summary: {
        totals: {
          totalUsers,
          totalLessons,
          totalQuizzes,
          newUsersToday,
        },
        charts: {
          dailySignups,
          dailyXp,
        },
        xpDistribution: buckets,
        lessonEngagement,
        activeUsersLast30Days: activeUserIds.size,
        meta: {
          rangeDays,
          generatedAt: new Date().toISOString(),
        },
      },
    });
  } catch (err) {
    console.error("Admin analytics error:", err);
    res
      .status(500)
      .json({ ok: false, message: "Failed to load admin analytics" });
  }
});

/* ───────────────────────────────────────────── */

export default router;
