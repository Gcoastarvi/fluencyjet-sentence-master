import express from "express";
import { PrismaClient } from "@prisma/client";
// 🎯 Ensure this name matches what you use below
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();
const prisma = new PrismaClient();

// 🎯 Change 'authRequired' to 'authMiddleware' here:
// server/routes/shop.js
router.post("/purchase-freeze", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const FREEZE_COST = 200;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 🎯 CRITICAL: Check both 'xpTotal' on User and 'xp' on UserProgress
      const user = await tx.user.findUnique({ where: { id: userId } });

      // If your XP is stored in 'xpTotal', use that:
      const currentXP = user.xpTotal || 0;

      if (currentXP < FREEZE_COST) {
        throw new Error(
          `Insufficient XP (Have: ${currentXP}, Need: ${FREEZE_COST})`,
        );
      }

      // 1. Deduct from User
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { xpTotal: { decrement: FREEZE_COST } },
      });

      // 2. Increment in UserProgress
      const updatedProgress = await tx.userProgress.update({
        where: { user_id: userId },
        data: { streak_freezes: { increment: 1 } },
      });

      return {
        xpTotal: updatedUser.xpTotal,
        streakFreezes: updatedProgress.streak_freezes,
      };
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

router.post("/buy-shield", authRequired, async (req, res) => {
  const userId = req.user.id;
  const COST = 1000;

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (user.total_xp < COST) throw new Error("INSUFFICIENT_XP");

    return tx.user.update({
      where: { id: userId },
      data: {
        total_xp: { decrement: COST },
        shield_count: { increment: 1 },
      },
    });
  });
  res.json({ ok: true, newXp: result.total_xp, shields: result.shield_count });
});

export default router;
