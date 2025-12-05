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

// ------------------------------------------------------------------------
// Admin Analytics (schema-correct version)
// GET /api/admin/analytics
// ------------------------------------------------------------------------
router.get("/analytics", authRequired, requireAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const rangeDays = 30;
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() - (rangeDays - 1));

    // -------------------------------------------------------
    // 1) BASIC COUNTS
    // -------------------------------------------------------
    const [totalUsers, newUsersToday, totalLessons, totalQuizzes] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({
          where: { created_at: { gte: today, lt: tomorrow } },
        }),
        prisma.lesson.count(),
        prisma.quiz.count(),
      ]);

    // -------------------------------------------------------
    // 2) XP EVENTS (schema: xp_delta, user_id, created_at)
    // -------------------------------------------------------
    const [xpEventsRange, xpEventsToday] = await Promise.all([
      prisma.xpEvent.findMany({
        where: { created_at: { gte: fromDate } },
        select: { xp_delta: true, created_at: true },
      }),
      prisma.xpEvent.findMany({
        where: { created_at: { gte: today } },
        select: { xp_delta: true, user_id: true },
      }),
    ]);

    // Today’s XP totals
    let todayXp = 0;
    const activeUserSet = new Set();

    xpEventsToday.forEach((e) => {
      if (e.user_id) activeUserSet.add(e.user_id);
      if (typeof e.xp_delta === "number") todayXp += e.xp_delta;
    });

    const activeUsersToday = activeUserSet.size;

    // -------------------------------------------------------
    // 3) CHARTS — Daily signups & daily XP for last 30 days
    // -------------------------------------------------------
    const usersRange = await prisma.user.findMany({
      where: { created_at: { gte: fromDate } },
      select: { created_at: true },
    });

    const dailySignups = {};
    usersRange.forEach((u) => {
      const key = u.created_at.toISOString().slice(0, 10);
      dailySignups[key] = (dailySignups[key] || 0) + 1;
    });

    const dailyXp = {};
    xpEventsRange.forEach((e) => {
      const key = e.created_at.toISOString().slice(0, 10);
      dailyXp[key] = (dailyXp[key] || 0) + e.xp_delta;
    });

    // -------------------------------------------------------
    // 4) TOP USERS BY XP (UserProgress.total_xp)
    // -------------------------------------------------------
    const topUsers = await prisma.userProgress.findMany({
      orderBy: { total_xp: "desc" },
      take: 20,
      include: {
        user: {
          select: { id: true, name: true, email: true, created_at: true },
        },
      },
    });

    // -------------------------------------------------------
    // FINAL RESPONSE
    // -------------------------------------------------------
    return res.json({
      ok: true,
      data: {
        summary: {
          totalUsers,
          newUsersToday,
          activeUsersToday,
          todayXp,
          totalLessons,
          totalQuizzes,
        },
        charts: {
          dailySignups,
          dailyXp,
        },
        topUsers,
      },
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
