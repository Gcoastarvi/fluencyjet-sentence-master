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

router.get("/stats", adminAuth, async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({
      where: { daily_streak: { gt: 0 } },
    });

    // 🎯 Aggregate average feedback stars (assuming you save rating in user or a separate table)
    const feedback = await prisma.user.aggregate({
      _avg: { feedbackRating: true },
      _count: { feedbackRating: true },
    });

    res.json({
      ok: true,
      stats: {
        totalUsers,
        activeUsers,
        avgRating: feedback._avg.feedbackRating || 0,
        totalFeedbacks: feedback._count.feedbackRating,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

router.get("/search", adminAuth, async (req, res) => {
  const { q } = req.query; // This is the "Man" from the search bar

  try {
    const users = await prisma.user.findMany({
      where: {
        username: {
          contains: q,
          mode: "insensitive", // 🎯 "man" will match "Mango" or "MANGO"
        },
      },
      select: { id: true, username: true, league: true, daily_streak: true },
      take: 10, // Only return top 10 to keep it fast
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Search failed" });
  }
});

router.post("/bulk-message", adminAuth, async (req, res) => {
  const { message } = req.body;

  try {
    // 🎯 Logic: Update a 'system_announcement' field or create a notification for all
    await prisma.user.updateMany({
      data: {
        lastNotification: message,
        hasUnreadNotification: true,
      },
    });

    res.json({ ok: true, message: "Announcement sent to all users! 📢" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default function AdminDashboard() {
  return (
    <ProtectedAdminRoute>
      <AdminDashboardContent />
    </ProtectedAdminRoute>
  );
}
