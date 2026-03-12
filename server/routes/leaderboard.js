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
      // 🎯 Updated to use 'xpTotal' as found in your prisma.schema
      const users = await prisma.user.findMany({
        orderBy:
          sortBy === "streak" ? { daily_streak: "desc" } : { xpTotal: "desc" },
        take: 50,
        select: {
          id: true,
          name: true,
          xpTotal: true, // changed from xp
          daily_streak: true,
          league: true,
        },
      });

      rows = users.map((u, idx) => ({
        rank: idx + 1,
        user_id: u.id,
        name: u.name,
        xp: u.xpTotal, // map the db 'xpTotal' to the frontend 'xp'
        streak: u.daily_streak,
        league: u.league,
      }));
    } else {
      // Period-Specific Aggregation
      rows = await aggregateXP(period);
    }

    {/* 📊 Rank Progress Bar */}
    {you?.rank > 1 && (
      <div className="mb-8 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex justify-between items-end mb-3">
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Next Rank Progress</p>
            <p className="text-sm font-bold text-slate-900">Overtake #{you.rank - 1}</p>
          </div>
          <span className="text-xs font-black text-indigo-600">
            {Math.round(((you.xp) / (rows[you.rank - 2]?.xp || you.xp + 100)) * 100)}%
          </span>
        </div>
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-1000"
            style={{ width: `${Math.min(100, (you.xp / (rows[you.rank - 2]?.xp || you.xp + 100)) * 100)}%` }}
          />
        </div>
      </div>
    )}

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
