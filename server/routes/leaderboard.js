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

// --- 📊 XP Aggregator (Aligned with your actual Schema) ---
async function aggregateXP(period) {
  try {
    const now = new Date();
    let queryWhere = {}; // 🎯 Fixed: Renamed to avoid reserved word conflicts

    if (period === "today") {
      const start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      queryWhere = { created_at: { gte: start, lt: addDaysUTC(start, 1) } };
    } else if (period === "weekly") {
      const start = weekStartUTC(now);
      queryWhere = { created_at: { gte: start, lt: addDaysUTC(start, 7) } };
    } else if (period === "monthly") {
      const start = monthStartUTC(now);
      queryWhere = { created_at: { gte: start, lt: addMonthsUTC(start, 1) } };
    }

    // 🎯 Use user_id (snake_case) to match your XpEvent model
    const grouped = await prisma.xpEvent.groupBy({
      by: ["user_id"],
      where: queryWhere,
      _sum: { xp_delta: true },
    });

    const rowsSorted = grouped
      .map((g) => ({
        user_id: g.user_id, // 🛡️ Fix: Ensure this matches the 'by' field above
        xp: Number(g._sum?.xp_delta || 0),
      }))
      .sort((a, b) => b.xp - a.xp);

    const userIds = rowsSorted.map((r) => r.user_id).filter((id) => id != null);
    if (userIds.length === 0) return [];

    // 🎯 SCHEMA FIX: Using 'username' and 'xpTotal' as seen in your logs
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        username: true, // Logs showed 'username' exists, 'name' does not
        league: true,
        xpTotal: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return rowsSorted.map((r, idx) => ({
      rank: idx + 1,
      user_id: r.user_id,
      name: userMap.get(r.user_id)?.username || "Learner", // Mapping username -> name
      xp: r.xp,
      streak: 0, // 🎯 Temporary: Setting to 0 since 'daily_streak' is missing from DB
      league: userMap.get(r.user_id)?.league || "BRONZE",
    }));
  } catch (error) {
    console.error("❌ aggregateXP failed:", error.message);
    throw error;
  }
}

// --- 🏆 The Consolidated Route ---
router.get("/", authMiddleware, async (req, res) => {
  try {
    const period = req.query.period || "all";
    let rows;

    if (period === "all") {
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          username: true,
          xpTotal: true,
          // 🛡️ These might fail if migration isn't done, so we'll be careful
          league: true,
          daily_streak: true,
        },
      });

      return rowsSorted.map((r, idx) => {
        const u = userMap.get(r.user_id);
        return {
          rank: idx + 1,
          user_id: r.user_id,
          name: u?.username || "Learner",
          xp: r.xp,
          // 🛡️ Fallback values if fields are null/undefined
          streak: u?.daily_streak || 0,
          league: u?.league || "BRONZE",
        };
      });
    } else {
      rows = await aggregateXP(period);
    }

    const meId = req.user.id;
    const meRow = rows.find((r) => r.user_id === meId);

    res.json({
      ok: true,
      period,
      rows,
      top: rows.slice(0, 3),
      you: meRow || { rank: null, xp: 0, name: "You" },
    });
  } catch (err) {
    console.error("❌ Leaderboard route error:", err.message);
    res.status(500).json({ ok: false, message: "Failed to load leaderboard" });
  }
});

// --- 🏆 The Consolidated Route ---
// Handles: ?period=today|weekly|monthly|all & ?sortBy=xp|streak
router.get("/", authMiddleware, async (req, res) => {
  try {
    const period = req.query.period || "all";
    // 🎯 ADD THIS LINE:
    const limit = parseInt(req.query.limit) || 50;

    let rows = [];
    if (period === "all") {
      const users = await prisma.user.findMany({
        orderBy: { xpTotal: "desc" },
        take: limit, // 🛡️ Use the limit here
        select: { id: true, username: true, xpTotal: true, league: true },
      });
      rows = users.map((u, idx) => ({
        rank: idx + 1,
        user_id: u.id,
        name: u.username || "Learner",
        xp: u.xpTotal,
        streak: 0,
        league: u.league || "BRONZE",
      }));
    } else {
      const allPeriodRows = await aggregateXP(period);
      // 🛡️ Slice the rows to respect the limit (fixes the 500 error for ?limit=3)
      rows = allPeriodRows.slice(0, limit);
    }

    const meId = req.user.id;
    const meRow = rows.find((r) => r.user_id === meId);

    res.json({
      ok: true,
      period,
      rows,
      top: rows.slice(0, 3), // Spotlight the top 3
      you: meRow || { rank: null, xp: 0, name: "You" },
    });
  } catch (err) {
    console.error("❌ Leaderboard route error:", err.message);
    res.status(500).json({ ok: false, message: "Failed to load leaderboard" });
  }
});

export default router;
