// server/routes/leaderboard.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/authMiddleware.js";

const prisma = new PrismaClient();
const router = express.Router();

/* ----------------------------- time helpers ----------------------------- */
function weekKeyUTC(d = new Date()) {
  const dt = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const day = dt.getUTCDay();
  const diff = (day + 6) % 7; // Monday = 0
  dt.setUTCDate(dt.getUTCDate() - diff);
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
}
function monthKeyUTC(d = new Date()) {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
}
function daysAgoISO(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

/* ----------------------- core implementations ----------------------- */
async function leaderboardFromMaterialized(range = "week", limit = 50) {
  const orderField = range === "month" ? "month_xp" : "week_xp";
  const rows = await prisma.userWeeklyTotals.findMany({
    where:
      range === "month"
        ? { month_key: monthKeyUTC() }
        : { week_key: weekKeyUTC() },
    orderBy: { [orderField]: "desc" },
    take: limit,
    include: {
      user: { select: { username: true, email: true, avatar_url: true } },
    },
  });

  return rows.map((r, i) => ({
    rank: i + 1,
    user_id: r.user_id,
    username: r.user.username || r.user.email,
    avatar_url: r.user.avatar_url,
    xp: range === "month" ? r.month_xp : r.week_xp,
    updated_at: r.updated_at,
  }));
}

async function leaderboardDaily(limit = 50) {
  const sinceISO = daysAgoISO(1);
  const events = await prisma.xpEvent.groupBy({
    by: ["user_id"],
    where: { created_at: { gte: new Date(sinceISO) } },
    _sum: { xp_delta: true },
    orderBy: { _sum: { xp_delta: "desc" } },
    take: limit,
  });

  if (!events.length) return [];
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
      user_id: e.user_id,
      username: (u?.username || u?.email) ?? "User",
      avatar_url: u?.avatar_url ?? null,
      xp: e._sum.xp_delta ?? 0,
    };
  });
}

/* -------------------------------- routes ------------------------------- */
/**
 * GET /api/leaderboard?range=week|month|day&limit=50
 * (Auth optional; add authMiddleware if you want it private)
 */
router.get("/", async (req, res) => {
  try {
    const rangeRaw = String(req.query.range || "week").toLowerCase();
    const range = ["week", "month", "day"].includes(rangeRaw)
      ? rangeRaw
      : "week";
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "50", 10) || 50, 1),
      100,
    );

    const data =
      range === "day"
        ? await leaderboardDaily(limit)
        : await leaderboardFromMaterialized(range, limit);

    res.set("Cache-Control", "public, max-age=30"); // small cache
    return res.json({
      ok: true,
      meta: {
        range,
        limit,
        week_key: weekKeyUTC(),
        month_key: monthKeyUTC(),
        generated_at: new Date().toISOString(),
      },
      leaderboard: data,
    });
  } catch (e) {
    console.error("Leaderboard error:", e);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to load leaderboard" });
  }
});

// Convenience aliases (optional)
router.get("/top", (req, res, next) => {
  req.query.range = "week";
  return router.handle(req, res, next);
});
router.get("/weekly", (req, res, next) => {
  req.query.range = "week";
  return router.handle(req, res, next);
});
router.get("/monthly", (req, res, next) => {
  req.query.range = "month";
  return router.handle(req, res, next);
});
router.get("/daily", (req, res, next) => {
  req.query.range = "day";
  return router.handle(req, res, next);
});

export default router;
