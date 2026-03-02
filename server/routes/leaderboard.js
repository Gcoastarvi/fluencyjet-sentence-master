// server/routes/leaderboard.js
import express from "express";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";

const router = express.Router();

function weekStartUTC(d = new Date()) {
  const dt = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const diff = (dt.getUTCDay() + 6) % 7; // Monday start
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

async function aggregateXP(period) {
  const now = new Date();
  let where = {};

  if (period === "today") {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const end = addDaysUTC(start, 1);
    where = { created_at: { gte: start, lt: end } };
  } else if (period === "weekly") {
    const start = weekStartUTC(now);
    const end = addDaysUTC(start, 7);
    where = { created_at: { gte: start, lt: end } };
  } else if (period === "monthly") {
    const start = monthStartUTC(now);
    const end = addMonthsUTC(start, 1);
    where = { created_at: { gte: start, lt: end } };
  } else {
    // "all"
    where = {};
  }

  const grouped = await prisma.xpEvent.groupBy({
    by: ["user_id"],
    where,
    _sum: { xp_delta: true },
  });

  // Sort by XP desc
  const rowsSorted = grouped
    .map((g) => ({ user_id: g.user_id, xp: Number(g._sum?.xp_delta || 0) }))
    .sort((a, b) => b.xp - a.xp);

  const userIds = rowsSorted.map((r) => r.user_id).filter((v) => v != null);

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  const ranked = rowsSorted.map((r, idx) => ({
    rank: idx + 1,
    user_id: r.user_id,
    name:
      userMap.get(r.user_id)?.name ||
      userMap.get(r.user_id)?.email ||
      "Learner",
    xp: r.xp,
  }));

  return ranked;
}

router.get("/this-week", authRequired, async (req, res) => {
  try {
    const weekStart = startOfWeekMonday(new Date());

    // 1. Fetch all XP events from this week
    const events = await prisma.xpEvent.findMany({
      where: { created_at: { gte: weekStart } },
      include: {
        user: { select: { name: true, email: true, avatar_url: true } },
      },
    });

    // 2. Group by User (Manually aggregate to handle the new Mastery types)
    const userMap = {};
    events.forEach((e) => {
      if (!userMap[e.user_id]) {
        userMap[e.user_id] = {
          id: e.user_id,
          name: e.user?.name || e.user?.email.split("@")[0],
          avatar: e.user?.avatar_url,
          xpThisPeriod: 0,
        };
      }
      userMap[e.user_id].xpThisPeriod += e.xp_delta;
    });

    // 3. Convert to array and sort by XP
    const leaders = Object.values(userMap)
      .sort((a, b) => b.xpThisPeriod - a.xpThisPeriod)
      .slice(0, 10);

    return res.json({ ok: true, leaders });
  } catch (err) {
    console.error("Leaderboard Error:", err);
    res.status(500).json({ ok: false });
  }
});

// GET /api/leaderboard?period=today|weekly|monthly|all
router.get("/", authRequired, async (req, res) => {
  try {
    const allowed = new Set(["today", "weekly", "monthly", "all"]);
    const period = allowed.has(req.query.period) ? req.query.period : "weekly";

    const rows = await aggregateXP(period);
    const totalLearners = rows.length;

    const top = rows.slice(0, 3);
    const meId = req.user.id;

    const meRow = rows.find((r) => r.user_id === meId);
    const you = meRow
      ? { rank: meRow.rank, xp: meRow.xp, name: meRow.name }
      : { rank: null, xp: 0, name: "You" };

    res.json({ ok: true, period, totalLearners, rows, top, you });
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ ok: false, message: "Failed to load leaderboard" });
  }
});

export default router;
