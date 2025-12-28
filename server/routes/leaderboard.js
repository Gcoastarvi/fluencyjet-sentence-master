// server/routes/leaderboard.js
import express from "express";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";

const router = express.Router();

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeekMonday(d = new Date()) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function rangeForPeriod(period) {
  const now = new Date();
  if (period === "today") {
    const start = startOfDay(now);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }
  if (period === "monthly") {
    const start = startOfMonth(now);
    const end = new Date(
      start.getFullYear(),
      start.getMonth() + 1,
      1,
      0,
      0,
      0,
      0,
    );
    return { start, end };
  }
  if (period === "weekly") {
    const start = startOfWeekMonday(now);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }
  return { start: null, end: null }; // all time
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
