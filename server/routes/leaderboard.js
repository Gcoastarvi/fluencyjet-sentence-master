import express from "express";
import prisma from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

/**
 * Leaderboard API
 * Returns:
 *  - top 50 users
 *  - your ranking
 *  - your XP
 *  - nextAbove
 *  - nextBelow
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1) Fetch top 50 leaderboard entries
    const topUsers = await prisma.user.findMany({
      orderBy: { total_xp: "desc" },
      take: 50,
      select: {
        id: true,
        name: true,
        total_xp: true,
      },
    });

    // 2) Get your XP
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        total_xp: true,
      },
    });

    if (!me) {
      return res.json({
        ok: false,
        message: "User not found",
      });
    }

    const yourXP = me.total_xp || 0;

    // 3) Find your rank globally
    const usersAbove = await prisma.user.count({
      where: {
        total_xp: { gt: yourXP },
      },
    });

    const yourRank = usersAbove + 1;

    // 4) Find next above you
    const nextAbove = await prisma.user.findFirst({
      where: {
        total_xp: { gt: yourXP },
      },
      orderBy: { total_xp: "asc" },
      select: {
        id: true,
        name: true,
        total_xp: true,
      },
    });

    // 5) Find next below you
    const nextBelow = await prisma.user.findFirst({
      where: {
        total_xp: { lt: yourXP },
      },
      orderBy: { total_xp: "desc" },
      select: {
        id: true,
        name: true,
        total_xp: true,
      },
    });

    return res.json({
      ok: true,
      leaderboard: topUsers,
      me: {
        rank: yourRank,
        yourXP,
        nextAbove: nextAbove
          ? { name: nextAbove.name, xp: nextAbove.total_xp }
          : null,
        nextBelow: nextBelow
          ? { name: nextBelow.name, xp: nextBelow.total_xp }
          : null,
      },
    });
  } catch (error) {
    console.error("Leaderboard error:", error);
    res.status(500).json({
      ok: false,
      message: "Failed to load leaderboard",
    });
  }
});

export default router;
