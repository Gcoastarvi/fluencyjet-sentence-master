// server/routes/leaderboard.js
import express from "express";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";

const router = express.Router();

/* Utility: Get time window */
function getSinceForPeriod(period) {
  const now = new Date();

  if (period === "daily") {
    const t = new Date(now);
    t.setDate(t.getDate() - 1);
    return t;
  }

  if (period === "weekly") {
    const t = new Date(now);
    t.setDate(t.getDate() - 7);
    return t;
  }

  if (period === "monthly") {
    const t = new Date(now);
    t.setMonth(t.getMonth() - 1);
    return t;
  }

  // "all" → no time filter
  return null;
}

// NEW: Support query version /api/leaderboard?period=weekly
router.get("/", authRequired, async (req, res) => {
  const period = (req.query.period || "weekly").toLowerCase();
  return res.redirect(`/api/leaderboard/${period}`);
});

/* -------- GET /api/leaderboard/:period -------- */
router.get("/:period", authRequired, async (req, res) => {
  const userId = req.user?.id;
  const raw = (req.params.period || "").toLowerCase();
  const period = ["daily", "weekly", "monthly", "all"].includes(raw)
    ? raw
    : "weekly";

  const since = getSinceForPeriod(period);

  try {
    const where = {
      event_type: "QUIZ_COMPLETED",
      ...(since ? { created_at: { gte: since } } : {}),
    };

    // Sum XP per user in the chosen window
    const grouped = await prisma.xpEvent.groupBy({
      by: ["user_id"],
      where,
      _sum: { xp_delta: true },
    });

    const sorted = grouped
      .map((g) => ({ user_id: g.user_id, xp: Number(g._sum.xp_delta) }))
      .sort((a, b) => b.xp - a.xp);

    const ids = sorted.map((s) => s.user_id);

    const users = ids.length
      ? await prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, email: true, name: true },
        })
      : [];

    const userMap = new Map(users.map((u) => [u.id, u]));

    // Leaders list for grid + top performers
    const leaders = sorted.slice(0, 50).map((row, index) => {
      const u = userMap.get(row.user_id);
      return {
        user_id: row.user_id,
        rank: index + 1,
        email: u?.email || null,
        name: u?.name || null,
        xp: row.xp,
      };
    });

    // "You" box
    let you = null;
    if (userId) {
      const pos = sorted.findIndex((r) => r.user_id === userId);
      if (pos !== -1) {
        const u = userMap.get(userId);
        you = {
          user_id: userId,
          rank: pos + 1,
          email: u?.email || null,
          name: u?.name || null,
          xp: sorted[pos].xp,
          // placeholders so UI renders nicely
          level: null,
          streak: 0,
          badgeName: "Bronze",
        };
      }
    }

    return res.json({ ok: true, period, leaders, you });
  } catch (err) {
    console.error("Leaderboard error:", err);
    return res.status(500).json({ ok: false, message: "Leaderboard error" });
  }
});

/* -------- Quick Rank Endpoint (weekly) -------- */
router.get("/me", authRequired, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ ok: false });

  const since = getSinceForPeriod("weekly");

  try {
    const grouped = await prisma.xpEvent.groupBy({
      by: ["user_id"],
      where: {
        event_type: "QUIZ_COMPLETED",
        created_at: { gte: since },
      },
      _sum: { xp_delta: true },
    });

    const sorted = grouped
      .map((g) => ({ user_id: g.user_id, xp: Number(g._sum.xp_delta) }))
      .sort((a, b) => b.xp - a.xp);

    const pos = sorted.findIndex((g) => g.user_id === userId);

    if (pos === -1) return res.json({ ok: true, rank: null, xp: 0 });

    return res.json({
      ok: true,
      rank: pos + 1,
      xp: sorted[pos].xp,
    });
  } catch (err) {
    console.error("Leaderboard /me error:", err);
    return res.status(500).json({ ok: false });
  }
});

export default router;
