import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();
const prisma = new PrismaClient();

// --- 🛠️ Time Helpers (Preserved from your audit) ---
function weekStartUTC(d = new Date()) {
  const dt = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const diff = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - diff);
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
}

function monthStartUTC(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function addDaysUTC(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function addMonthsUTC(date, months) {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

// --- 📊 XP Aggregator (Preserved logic) ---
async function aggregateXP(period) {
  const now = new Date();
  let where = {};

  if (period === "today") {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    where = { created_at: { gte: start, lt: addDaysUTC(start, 1) } };
  } else if (period === "weekly") {
    const start = weekStartUTC(now);
    where = { created_at: { gte: start, lt: addDaysUTC(start, 7) } };
  } else if (period === "monthly") {
    const start = monthStartUTC(now);
    where = { created_at: { gte: start, lt: addMonthsUTC(start, 1) } };
  }

  const grouped = await prisma.xpEvent.groupBy({
    by: ["user_id"],
    where,
    _sum: { xp_delta: true },
  });

  const rowsSorted = grouped
    .map((g) => ({ user_id: g.user_id, xp: Number(g._sum?.xp_delta || 0) }))
    .sort((a, b) => b.xp - a.xp);

  const userIds = rowsSorted.map((r) => r.user_id).filter((v) => v != null);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      name: true,
      email: true,
      daily_streak: true,
      league: true,
    },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  return rowsSorted.map((r, idx) => ({
    rank: idx + 1,
    user_id: r.user_id,
    name:
      userMap.get(r.user_id)?.name ||
      userMap.get(r.user_id)?.email?.split("@")[0] ||
      "Learner",
    xp: r.xp,
    streak: userMap.get(r.user_id)?.daily_streak || 0,
    league: userMap.get(r.user_id)?.league || "BRONZE",
  }));
}

// --- 🏆 The Consolidated Route ---
// Handles: ?period=today|weekly|monthly|all & ?sortBy=xp|streak
router.get("/", authMiddleware, async (req, res) => {
  try {
    const allowed = new Set(["today", "weekly", "monthly", "all"]);
    const period = allowed.has(req.query.period) ? req.query.period : "all";
    const sortBy = req.query.sortBy === "streak" ? "streak" : "xp";

    let rows;
    if (period === "all") {
      // Lifetime Logic
      const users = await prisma.user.findMany({
        orderBy:
          sortBy === "streak" ? { daily_streak: "desc" } : { xp: "desc" },
        take: 50,
        select: {
          id: true,
          name: true,
          xp: true,
          daily_streak: true,
          league: true,
        },
      });
      rows = users.map((u, idx) => ({
        rank: idx + 1,
        user_id: u.id,
        name: u.name,
        xp: u.xp,
        streak: u.daily_streak,
        league: u.league,
      }));
    } else {
      // Period-Specific Aggregation
      rows = await aggregateXP(period);
    }

    const meId = req.user.id;
    const meRow = rows.find((r) => r.user_id === meId);

    res.json({
      ok: true,
      period,
      sortBy,
      totalLearners: rows.length,
      rows, // Full list for the main table
      top: rows.slice(0, 3), // Top 3 for the Hero cards
      you: meRow || { rank: null, xp: 0, name: "You" },
    });
  } catch (err) {
    console.error("❌ Leaderboard error:", err);
    res.status(500).json({ ok: false, message: "Failed to load leaderboard" });
  }
});

export default router;
