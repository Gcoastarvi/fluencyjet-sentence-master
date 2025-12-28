// server/routes/leaderboard.js
import express from "express";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";

const router = express.Router();
const allowed = new Set(["today", "weekly", "monthly", "all"]);
const period = allowed.has(req.query.period) ? req.query.period : "weekly";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function whereForPeriod(period) {
  const now = new Date();

  if (period === "today") {
    return { created_at: { gte: startOfDay(now), lt: now } };
  }
  if (period === "weekly") {
    return { created_at: { gte: daysAgo(7), lt: now } };
  }
  if (period === "monthly") {
    return { created_at: { gte: daysAgo(30), lt: now } };
  }
  // "all"
  return {};
}

async function aggregateXP(period) {
  const where = whereForPeriod(period);

  const grouped = await prisma.xpEvent.groupBy({
    by: ["user_id"],
    where,
    _sum: { xp_delta: true },
    orderBy: { _sum: { xp_delta: "desc" } },
    take: 50,
  });

  const userIds = grouped
    .map((g) => g.user_id)
    .filter((v) => typeof v === "number");

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  return grouped.map((g, i) => {
    const u = userMap.get(g.user_id);
    return {
      rank: i + 1,
      user_id: g.user_id,
      name: u?.name || u?.email || `User ${g.user_id}`,
      xp: Number(g._sum.xp_delta || 0),
    };
  });
}

router.get("/", authRequired, async (req, res) => {
  try {
    const period = String(req.query.period || "weekly");
    const { start, end } = rangeForPeriod(period);

    const where = {};
    if (start && end) {
      where.created_at = { gte: start, lt: end };
    }

    const grouped = await prisma.xpEvent.groupBy({
      by: ["user_id"],
      where,
      _sum: { xp_delta: true },
      orderBy: { _sum: { xp_delta: "desc" } },
      take: 200,
    });

    const userIds = (grouped || [])
      .map((r) => r.user_id)
      .filter((v) => typeof v === "number");

    if (userIds.length === 0) {
      return res.json({
        ok: true,
        period,
        totalLearners: 0,
        rows: [],
        top: [],
        you: null,
      });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const rows = grouped
      .map((r, idx) => {
        const u = userMap.get(r.user_id);
        const xp = Number(r?._sum?.xp_delta ?? 0);
        return {
          rank: idx + 1,
          user_id: r.user_id,
          name: u?.name || "Learner",
          xp,
        };
      })
      .sort((a, b) => b.xp - a.xp);

    // Re-rank after sort
    rows.forEach((r, i) => (r.rank = i + 1));

    const top = rows.slice(0, 3);

    const meId = req.user.id;
    const youRow = rows.find((r) => r.user_id === meId) || null;

    return res.json({
      ok: true,
      period,
      totalLearners: rows.length,
      rows,
      top,
      you: youRow
        ? { rank: youRow.rank, xp: youRow.xp, name: youRow.name }
        : null,
    });
  } catch (err) {
    console.error("Leaderboard error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to load leaderboard" });
  }
});

export default router;
