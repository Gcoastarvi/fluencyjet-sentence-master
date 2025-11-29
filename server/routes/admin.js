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

export default router;
