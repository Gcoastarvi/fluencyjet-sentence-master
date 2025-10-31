// server/routes/leaderboard.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/authMiddleware.js"; // must attach req.user.id

const prisma = new PrismaClient();
const router = express.Router();

/* ----------------------------- time helpers ----------------------------- */
// Monday 00:00 UTC of current week
function weekKeyUTC(d = new Date()) {
  const dt = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const day = dt.getUTCDay(); // 0..6 (Sun..Sat)
  const diff = (day + 6) % 7; // Make Monday=0
  dt.setUTCDate(dt.getUTCDate() - diff);
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
}
// 1st day of month 00:00 UTC
function monthKeyUTC(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
// ISO string for "now - n days"
function daysAgoISO(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

/* ----------------------- core query implementations ---------------------- */

/** Fast weekly/monthly leaderboard via user_weekly_totals */
async function leaderboardFromMaterialized(range = "week", limit = 50) {
  const orderField = range === "month" ? "month_xp" : "week_xp";
  const rows = await prisma.userWeeklyTotals.findMany({
    orderBy: { [orderField]: "desc" },
    take: limit,
    include: {
      user: { select: { username: true, email: true, avatar_url: true } },
    },
  });

  return rows.map((r, i) => ({
    rank: i + 1,
    username: r.user.username || r.user.email,
    avatar_url: r.user.avatar_url,
    xp: range === "month" ? r.month_xp : r.week_xp,
  }));
}

/** Daily leaderboard (last 24h) aggregated from xp_events */
async function leaderboardDaily(limit = 50) {
  const sinceISO = daysAgoISO(1);
  // Aggregate in SQL via Prisma: group by user_id
  const events = await prisma.xpEvent.groupBy({
    by: ["user_id"],
    where: { created_at: { gte: new Date(sinceISO) } },
    _sum: { xp_delta: true },
    orderBy: { _sum: { xp_delta: "desc" } },
    take: limit,
  });

  if (events.length === 0) return [];

  const ids = events.map((e) => e.user_id);
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, username: true, email: true, avatar_url: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  return events.map((e, i) => {
    const u = byId.get(e.user_id);
    return {
      rank: i + 1,
      username: (u?.username || u?.email) ?? "User",
      avatar_url: u?.avatar_url ?? null,
      xp: e._sum.xp_delta ?? 0,
    };
  });
}

/* ------------------------------- routes ---------------------------------- */

/**
 * GET /api/leaderboard
 * Query: range=week|month|day (default: week), limit=number (default: 50)
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const rangeRaw = String(req.query.range || "week").toLowerCase();
    const range = ["week", "month", "day"].includes(rangeRaw)
      ? rangeRaw
      : "week";
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "50", 10) || 50, 1),
      100,
    );

    let data = [];
    if (range === "day") {
      data = await leaderboardDaily(limit);
    } else {
      data = await leaderboardFromMaterialized(range, limit);
    }

    // Helpful response metadata
    const meta = {
      range,
      limit,
      week_key: weekKeyUTC(),
      month_key: monthKeyUTC(),
      generated_at: new Date().toISOString(),
    };

    // Short cache (30s) – fine for public leaderboards
    res.set("Cache-Control", "public, max-age=30");
    return res.json({ ok: true, meta, leaderboard: data });
  } catch (e) {
    console.error("Leaderboard error:", e);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to load leaderboard" });
  }
});

/* --------- Back-compat routes mapping to unified handler above ---------- */

router.get("/weekly", authMiddleware, async (req, res, next) => {
  req.query.range = "week";
  return router.handle(req, res, next);
});

router.get("/monthly", authMiddleware, async (req, res, next) => {
  req.query.range = "month";
  return router.handle(req, res, next);
});

router.get("/daily", authMiddleware, async (req, res, next) => {
  req.query.range = "day";
  return router.handle(req, res, next);
});

export default router;
