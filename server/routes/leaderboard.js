import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();
const prisma = new PrismaClient();

// --- 🛠️ Time Helpers ---
const weekStartUTC = (d = new Date()) => {
  const dt = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const diff = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - diff);
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
};

// --- 📊 XP Aggregator ---
async function aggregateXP(period, limit = 50) {
  const now = new Date();
  let queryWhere = {};

  if (period === "today") {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    queryWhere = { created_at: { gte: start } };
  } else if (period === "weekly") {
    queryWhere = { created_at: { gte: weekStartUTC(now) } };
  }

  const grouped = await prisma.xpEvent.groupBy({
    by: ["user_id"],
    where: queryWhere,
    _sum: { xp_delta: true },
    orderBy: { _sum: { xp_delta: "desc" } },
    take: limit,
  });

  const userIds = grouped.map((g) => g.user_id);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true, league: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  return grouped.map((g, idx) => ({
    rank: idx + 1,
    user_id: g.user_id,
    name: userMap.get(g.user_id)?.username || "Learner",
    xp: Number(g._sum.xp_delta || 0),
    league: userMap.get(g.user_id)?.league || "BRONZE",
  }));
}

// --- 🏆 The SINGLE Consolidated Route ---
router.get("/", authMiddleware, async (req, res) => {
  try {
    const period = req.query.period || "all";
    const limit = parseInt(req.query.limit) || 50;
    let rows = [];

    if (period === "all") {
      const users = await prisma.user.findMany({
        orderBy: { xpTotal: "desc" },
        take: limit,
        select: { id: true, username: true, xpTotal: true, league: true },
      });
      rows = users.map((u, idx) => ({
        rank: idx + 1,
        user_id: u.id,
        name: u.username || "Learner",
        xp: u.xpTotal,
        league: u.league || "BRONZE",
      }));
    } else {
      rows = await aggregateXP(period, limit);
    }

    res.json({
      ok: true,
      period,
      rows,
      top: rows.slice(0, 3),
      you: rows.find((r) => r.user_id === req.user.id) || {
        rank: null,
        xp: 0,
        name: "You",
      },
    });
  } catch (err) {
    console.error("❌ Leaderboard error:", err.message);
    res.status(500).json({ ok: false, message: "Failed to load leaderboard" });
  }
});

export default router;
