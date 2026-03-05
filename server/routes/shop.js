import express from "express";
import { PrismaClient } from "@prisma/client";
// 🎯 Ensure this name matches what you use below
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();
const prisma = new PrismaClient();

// 🎯 Change 'authRequired' to 'authMiddleware' here:
router.post("/purchase-freeze", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const FREEZE_COST = 200;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });

      if (!user || user.xpTotal < FREEZE_COST) {
        throw new Error("Insufficient XP");
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { xpTotal: { decrement: FREEZE_COST } },
      });

      const updatedProgress = await tx.userProgress.upsert({
        where: { user_id: userId },
        update: { streak_freezes: { increment: 1 } },
        create: { user_id: userId, streak_freezes: 1, xp: 0, streak: 0 },
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

export default router;
