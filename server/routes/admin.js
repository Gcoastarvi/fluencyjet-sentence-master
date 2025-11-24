import express from "express";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";
import requireAdmin from "../middleware/admin.js";

const router = express.Router();

/* ───────────────────────────────
   ADMIN OVERVIEW
──────────────────────────────── */
router.get("/overview", authRequired, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalQuizzes = await prisma.quiz.count();
    const totalXP = await prisma.xpEvent.aggregate({
      _sum: { amount: true },
    });

    return res.json({
      ok: true,
      data: {
        totalUsers,
        totalQuizzes,
        totalXP: totalXP._sum.amount || 0,
      },
    });
  } catch (err) {
    console.error("Admin /overview error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

/* ───────────────────────────────
   ADMIN: GET ALL USERS
──────────────────────────────── */
router.get("/users", authRequired, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        isAdmin: true,
        xpTotal: true,
        xpWeekly: true,
        xpMonthly: true,
        streak: true,
        lastActiveAt: true,
      },
    });

    return res.json({ ok: true, users });
  } catch (error) {
    console.error("Admin /users error:", error);
    return res.status(500).json({ ok: false, error: "Failed to load users" });
  }
});

export default router;
