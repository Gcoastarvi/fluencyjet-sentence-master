// server/routes/admin.js
import express from "express";
import prisma from "../db/client.js";
import authRequired from "../middleware/authRequired.js";
import requireAdmin from "../middleware/admin.js";

const router = express.Router();

// Admin overview
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

export default router;
