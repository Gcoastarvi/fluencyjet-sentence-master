// server/routes/leaderboard.js
import express from "express";
import prisma from "../db/client.js";
import { authMiddleware as authRequired } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Helper: build time filter for a given period.
 * period: "weekly" | "monthly" | "all"
 */
function getSinceForPeriod(period) {
  const now = new Date();

  if (period === "weekly") {
    const since = new Date(now);
    since.setDate(since.getDate() - 7);
    return since;
  }

  if (period === "monthly") {
    const since = new Date(now);
    since.setMonth(since.getMonth() - 1);
    return since;
  }

  // "all" → no time filter
  return null;
}

/**
 * GET /api/leaderboard/:period
 * period: "weekly" | "monthly" | "all"
 *
 * Response:
 * {
 *   ok: true,
 *   period: "weekly",
 *   top: [
 *     { rank: 1, name: "Aravind", xp: 1230, isYou: true/false },
 *     ...
 *   ],
 *   you: { rank: 3, name: "You", xp: 450 } | null
 * }
 */
router.get("/:period", authRequired, async (req, res) => {
  const periodParam = (req.params.period || "weekly").toLowerCase();
  const period = ["weekly", "monthly", "all"].includes(periodParam)
    ? periodParam
    : "weekly";

  const userId = req.user?.id;
  const since = getSinceForPeriod(period);

  try {
    // Build WHERE clause for xpEvent
    const whereClause = {
      event_type: "QUIZ_COMPLETED",
      ...(since ? { created_at: { gte: since } } : {}),
    };

    // Group XP by user
    const xpByUser = await prisma.xpEvent.groupBy({
      by: ["user_id"],
      where: whereClause,
      _sum: { xp_delta: true },
    });

    // Normalize + sort by XP desc
    const sorted = xpByUser
      .map((row) => ({
        user_id: row.user_id,
        xp: Number(row._sum.xp_delta) || 0,
      }))
      .sort((a, b) => b.xp - a.xp);

    // Fetch user info for all IDs we have XP for
    const userIds = sorted.map((row) => row.user_id);
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];

    const userById = new Map(users.map((u) => [u.id, u]));

    // Build "top" list (first 50)
    const top = sorted.slice(0, 50).map((row, index) => {
      const u = userById.get(row.user_id);
      const displayName =
        u?.name || (u?.email ? u.email.split("@")[0] : "Learner");

      return {
        rank: index + 1,
        name: displayName,
        xp: row.xp,
        isYou: userId ? row.user_id === userId : false,
      };
    });

    // Build "you" block if logged in user has XP
    let you = null;
    if (userId) {
      const idx = sorted.findIndex((row) => row.user_id === userId);
      if (idx !== -1) {
        const row = sorted[idx];
        const u = userById.get(row.user_id);
        const displayName =
          u?.name || (u?.email ? u.email.split("@")[0] : "You");

        you = {
          rank: idx + 1,
          name: displayName,
          xp: row.xp,
        };
      }
    }

    return res.json({
      ok: true,
      period,
      top,
      you,
    });
  } catch (err) {
    console.error("/api/leaderboard/:period error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to load leaderboard" });
  }
});

/**
 * GET /api/leaderboard/me
 * Quick lookup of current user's weekly rank.
 *
 * Response:
 * { ok: true, rank: number | null, xp: number }
 */
router.get("/me", authRequired, async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }

  const since = getSinceForPeriod("weekly");

  try {
    const xpByUser = await prisma.xpEvent.groupBy({
      by: ["user_id"],
      where: {
        event_type: "QUIZ_COMPLETED",
        created_at: { gte: since },
      },
      _sum: { xp_delta: true },
    });

    const sorted = xpByUser
      .map((row) => ({
        user_id: row.user_id,
        xp: Number(row._sum.xp_delta) || 0,
      }))
      .sort((a, b) => b.xp - a.xp);

    const idx = sorted.findIndex((row) => row.user_id === userId);

    if (idx === -1) {
      return res.json({ ok: true, rank: null, xp: 0 });
    }

    return res.json({
      ok: true,
      rank: idx + 1,
      xp: sorted[idx].xp,
    });
  } catch (err) {
    console.error("/api/leaderboard/me error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to load leaderboard rank" });
  }
});

export default router;
