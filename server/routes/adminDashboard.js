// server/routes/adminDashboard.js
import express from "express";
import prisma from "../db/client.js";
import { adminOnly } from "../middleware/adminOnly.js";

const router = express.Router();

/**
 * Day start in UTC (aligns with progress.js logic)
 */
function dayStartUTC(d = new Date()) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

router.get("/", adminOnly, async (req, res) => {
  try {
    const today = dayStartUTC(new Date());
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

    const [
      totalUsers,
      totalLessons,
      totalQuizzes,
      totalXpAgg,
      dailyActiveUsers,
      activeUsers,
    ] = await prisma.$transaction([
      prisma.user.count(),
      prisma.lesson.count(),
      prisma.quiz.count(),
      prisma.userProgress.aggregate({
        _sum: { total_xp: true },
      }),
      prisma.userProgress.count({
        where: {
          last_activity: {
            gte: today,
          },
        },
      }),
      prisma.userProgress.count({
        where: {
          last_activity: {
            gte: sevenDaysAgo,
          },
        },
      }),
    ]);

    const totalXP = totalXpAgg._sum.total_xp || 0;
    const avgXPPerUser = totalUsers > 0 ? Math.round(totalXP / totalUsers) : 0;

    return res.json({
      ok: true,
      totalUsers,
      totalLessons,
      totalQuizzes,
      totalXP,
      avgXPPerUser,
      activeUsers,
      dailyActiveUsers,
    });
  } catch (err) {
    console.error("Admin Dashboard Error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

export default router;
