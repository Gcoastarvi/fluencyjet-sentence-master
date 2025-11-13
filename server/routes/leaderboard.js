// server/routes/leaderboard.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const router = express.Router();

/* ───────────────────────────────
   JWT Auth middleware
─────────────────────────────── */
const JWT_SECRET = process.env.JWT_SECRET || "fluencyjet_secret_2025";

function authRequired(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token)
      return res.status(401).json({ ok: false, message: "Missing token" });

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch {
    return res
      .status(401)
      .json({ ok: false, message: "Invalid or expired token" });
  }
}

/* ----------------------------- time helpers ----------------------------- */
function weekKeyUTC(d = new Date()) {
  const dt = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const day = dt.getUTCDay();
  const diff = (day + 6) % 7;
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

/* ----------------------- leaderboard builders ----------------------- */
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
router.get("/", authRequired, async (req, res) => {
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

/* 🧍‍♂️ Personal Rank */
router.get("/me", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const weekKey = weekKeyUTC();

    const all = await prisma.userWeeklyTotals.findMany({
      where: { week_key: weekKey },
      orderBy: { week_xp: "desc" },
      select: { user_id: true, week_xp: true },
    });

    if (!all.length)
      return res.json({ ok: true, message: "No leaderboard data yet" });

    const idx = all.findIndex((r) => r.user_id === userId);
    const rank = idx === -1 ? null : idx + 1;
    const neighbors = all.slice(Math.max(0, idx - 2), idx + 3);

    const ids = neighbors.map((n) => n.user_id);
    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, username: true, avatar_url: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    const context = neighbors.map((n) => ({
      rank: all.findIndex((r) => r.user_id === n.user_id) + 1,
      user_id: n.user_id,
      username: byId.get(n.user_id)?.username || `user_${n.user_id}`,
      avatar_url: byId.get(n.user_id)?.avatar_url || null,
      week_xp: n.week_xp,
    }));

    return res.json({ ok: true, rank, context });
  } catch (err) {
    console.error("❌ /api/leaderboard/me error:", err);
    res
      .status(500)
      .json({
        ok: false,
        message: "Could not load personal rank",
        error: err.message,
      });
  }
});

export default router;
