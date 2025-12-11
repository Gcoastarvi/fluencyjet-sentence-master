// server/routes/leaderboard.js
import express from "express";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";

const router = express.Router();

// Map period → which XP field to use in UserProgress
function getXpField(periodRaw) {
  const period = (periodRaw || "").toString().toLowerCase();

  switch (period) {
    case "today":
      // For now, we approximate "today" with this week's XP.
      // If needed later, we can switch to XpEvent date-based aggregation.
      return { period: "today", field: "week_xp" };
    case "weekly":
      return { period: "weekly", field: "week_xp" };
    case "monthly":
      return { period: "monthly", field: "month_xp" };
    case "all":
      return { period: "all", field: "lifetime_xp" };
    default:
      return { period: "today", field: "week_xp" };
  }
}

// Helper → build a friendly display name
function getDisplayNameFromProgress(progress) {
  if (!progress) return "Learner";

  const p = progress;
  const u = progress.user || {};

  return (
    p.display_name ||
    u.display_name ||
    u.name ||
    (u.email ? u.email.split("@")[0] : null) ||
    "Learner"
  );
}

// Get "you" info: XP + rank + badge
async function getUserRankAndXp(userId, xpField) {
  const progress = await prisma.userProgress.findUnique({
    where: { user_id: userId },
    include: { user: true },
  });

  if (!progress) {
    return {
      xp: 0,
      rank: null,
      level: 1,
      badge: null,
      name: null,
    };
  }

  const xp = progress[xpField] || 0;

  if (xp <= 0) {
    return {
      xp: 0,
      rank: null,
      level: progress.lifetime_level || 1,
      badge: progress.current_badge || null,
      name: getDisplayNameFromProgress(progress),
    };
  }

  // Count how many users have strictly more XP than you
  const betterCount = await prisma.userProgress.count({
    where: {
      [xpField]: { gt: xp },
    },
  });

  return {
    xp,
    rank: betterCount + 1,
    level: progress.lifetime_level || 1,
    badge: progress.current_badge || null,
    name: getDisplayNameFromProgress(progress),
  };
}

// All leaderboard APIs require auth
router.use(authRequired);

/**
 * GET /api/leaderboard?period=today|weekly|monthly|all
 *
 * Returns:
 * {
 *   ok: true,
 *   period: "today",
 *   totalLearners: number,
 *   rows: [
 *     {
 *       rank,
 *       userId,
 *       name,
 *       xp,
 *       level,
 *       badge,
 *       avatarUrl
 *     },
 *     ...
 *   ],
 *   you: {
 *     id,
 *     name,
 *     xp,
 *     rank,
 *     level,
 *     badge
 *   },
 *   top: [ same shape as rows, top 5 ]
 * }
 */
router.get("/", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: "Missing user in request",
      });
    }

    const { period: normalizedPeriod, field: xpField } = getXpField(
      req.query.period,
    );

    const limit = Number.parseInt(req.query.limit, 10) || 100;

    // Get top learners for this period
    const progressRows = await prisma.userProgress.findMany({
      include: { user: true },
      orderBy: {
        [xpField]: "desc",
      },
      take: limit,
    });

    const rows = progressRows.map((p, idx) => {
      const xp = p[xpField] || 0;
      return {
        rank: idx + 1,
        userId: p.user_id,
        name: getDisplayNameFromProgress(p),
        xp,
        level: p.lifetime_level || 1,
        badge: p.current_badge || null,
        avatarUrl: p.avatar_url || null,
      };
    });

    const totalLearners = await prisma.userProgress.count();

    const you = await getUserRankAndXp(userId, xpField);

    const top = rows.slice(0, 5);

    return res.json({
      ok: true,
      period: normalizedPeriod,
      totalLearners,
      rows,
      you: {
        id: userId,
        name: you.name,
        xp: you.xp,
        rank: you.rank,
        level: you.level,
        badge: you.badge,
      },
      top,
    });
  } catch (err) {
    console.error("❌ /api/leaderboard error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to load leaderboard",
    });
  }
});

export default router;
