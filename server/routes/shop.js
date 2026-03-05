// server/routes/shop.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();
const prisma = new PrismaClient();

router.post("/purchase-freeze", authMiddleware, async (req, res) => {
  // ... (paste the transaction logic here)
});

export default router; // 🎯 This is required for the import to work!

router.post("/purchase-freeze", authRequired, async (req, res) => {
  const userId = req.user.id;
  const FREEZE_COST = 200; // Set your price

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get current XP and Progress
      const user = await tx.user.findUnique({ where: { id: userId } });
      const progress = await tx.userProgress.findUnique({
        where: { user_id: userId },
      });

      if (user.xpTotal < FREEZE_COST) {
        throw new Error("Insufficient XP");
      }

      // 2. Deduct XP from User
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { xpTotal: { decrement: FREEZE_COST } },
      });

      // 3. Add a Freeze to UserProgress
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
