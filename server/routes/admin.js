import express from "express";
import prisma from "../db/client.js";
import { requireAdmin } from "../middleware/admin.js";

const router = express.Router();

// GET all users (READ ONLY)
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        xp: true,
        level: true,
        lastLogin: true,
      },
    });

    return res.json({ ok: true, users });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// GET leaderboard debug (full rows)
router.get("/leaderboard-debug", requireAdmin, async (req, res) => {
  const period = req.query.period || "weekly";

  try {
    // Reuse leaderboard logic
    const rows = await prisma.leaderboard.findMany({
      where: { period },
      orderBy: { xp: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return res.json({ ok: true, period, rows });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

export default router;
