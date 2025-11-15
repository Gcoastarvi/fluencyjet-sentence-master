// server/routes/leaderboard.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/authMiddleware.js";

const prisma = new PrismaClient();
const router = express.Router();

/* -------------------------------------------------------------------------- */
/*                          VALID PERIODS & HELPERS                           */
/* -------------------------------------------------------------------------- */
const VALID_PERIODS = new Set(["daily", "weekly", "monthly"]);

function todayUTC() {
  const d = new Date();
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function weekStartUTC() {
  const d = todayUTC();
  const diff = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

function monthStartUTC() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

async function getLatestBadgeForUser(userId) {
  const ub = await prisma.userBadge.findFirst({
    where: { user_id: userId },
    include: { badge: true },
    orderBy: { awarded_at: "desc" },
  });

  if (!ub) return null;
  return {
    code: ub.badge.code,
    label: ub.badge.label,
    description: ub.badge.description,
    awarded_at: ub.awarded_at,
  };
}

/* -------------------------------------------------------------------------- */
/*                           GET /api/leaderboard/:period                     */
/* -------------------------------------------------------------------------- */
router.get("/:period", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const period = req.params.period;

    if (!VALID_PERIODS.has(period)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid leaderboard period",
      });
    }

    // ---------------- DAILY (from xpEvent) ----------------
    if (period === "daily") {
      const since = todayUTC();

      const events = await prisma.xpEvent.groupBy({
        by: ["user_id"],
        where: { created_at: { gte: since } },
        _sum: { xp_delta: true },
        orderBy: {
          _sum: { xp_delta: "desc" },
        },
        take: 50,
      });

      const ids = events.map((e) => e.user_id);
      const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, email: true, username: true },
      });
      const map = new Map(users.map((u) => [u.id, u]));

      const top = events.map((e, i) => ({
        rank: i + 1,
        user_id: e.user_id,
        email: map.get(e.user_id)?.email,
        username: map.get(e.user_id)?.username || map.get(e.user_id)?.email,
        total_xp: e._sum.xp_delta || 0,
      }));

      const youIndex = events.findIndex((e) => e.user_id === userId);
      const youXP = youIndex === -1 ? 0 : events[youIndex]._sum.xp_delta || 0;
      const youRank = youIndex === -1 ? null : youIndex + 1;
      const badge = await getLatestBadgeForUser(userId);

      return res.json({
        ok: true,
        top,
        you: {
          rank: youRank,
          xp: youXP,
          badge,
        },
      });
    }

    // ---------------- WEEKLY / MONTHLY (materialized) ----------------
    let orderField = "week_xp";
    let whereKey = { week_key: weekStartUTC() };

    if (period === "monthly") {
      orderField = "month_xp";
      whereKey = { month_key: monthStartUTC() };
    }

    const rows = await prisma.userWeeklyTotals.findMany({
      where: whereKey,
      orderBy: { [orderField]: "desc" },
      take: 50,
      include: {
        user: { select: { email: true, username: true } },
      },
    });

    const top = rows.map((r, i) => ({
      rank: i + 1,
      user_id: r.user_id,
      email: r.user.email,
      username: r.user.username || r.user.email,
      total_xp: r[orderField] ?? 0,
    }));

    const youIndex = rows.findIndex((r) => r.user_id === userId);
    const youRow = youIndex === -1 ? null : rows[youIndex];
    const youXP = youRow ? (youRow[orderField] ?? 0) : 0;
    const youRank = youIndex === -1 ? null : youIndex + 1;
    const badge = await getLatestBadgeForUser(userId);

    return res.json({
      ok: true,
      top,
      you: {
        rank: youRank,
        xp: youXP,
        badge,
      },
    });
  } catch (err) {
    console.error("❌ /leaderboard/:period error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load leaderboard",
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                           GET /api/leaderboard/me                          */
/* -------------------------------------------------------------------------- */
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const weekKey = weekStartUTC();

    const rows = await prisma.userWeeklyTotals.findMany({
      where: { week_key: weekKey },
      orderBy: { week_xp: "desc" },
      select: { user_id: true, week_xp: true },
    });

    if (!rows.length) {
      return res.json({ ok: true, message: "No leaderboard data yet" });
    }

    const index = rows.findIndex((r) => r.user_id === userId);
    const rank = index === -1 ? null : index + 1;

    return res.json({
      ok: true,
      rank,
      week_xp: index === -1 ? 0 : rows[index].week_xp,
    });
  } catch (err) {
    console.error("❌ /leaderboard/me error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load personal rank",
    });
  }
});

export default router;
