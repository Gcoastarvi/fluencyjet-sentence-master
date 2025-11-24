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

/* ───────────────────────────────
   ADMIN: PROMOTE USER TO ADMIN
──────────────────────────────── */
router.post("/promote", authRequired, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ ok: false, message: "userId required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    if (user.isAdmin) {
      return res.json({ ok: true, message: "User already admin" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isAdmin: true },
    });

    return res.json({ ok: true, message: "User promoted" });
  } catch (err) {
    console.error("Admin promote error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

/* ───────────────────────────────
   ADMIN: DEMOTE USER
──────────────────────────────── */
router.post("/demote", authRequired, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ ok: false, message: "userId required" });
    }

    // Prevent self-demotion
    if (userId === req.user.id) {
      return res.status(400).json({
        ok: false,
        message: "You cannot demote yourself",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    if (!user.isAdmin) {
      return res.json({ ok: true, message: "Already not admin" });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isAdmin: false },
    });

    return res.json({ ok: true, message: "User demoted" });
  } catch (err) {
    console.error("Admin demote error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

export default router;
