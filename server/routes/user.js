import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();
const prisma = new PrismaClient();

// 🎯 POST /api/user/award-bonus
router.post("/award-bonus", authMiddleware, async (req, res) => {
  try {
    const { xpAmount } = req.body;
    const userId = req.user.id;

    // Update the user's XP in the database
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        xp: { increment: xpAmount || 100 },
      },
    });

    return res.json({
      ok: true,
      message: "XP Awarded!",
      currentXp: updatedUser.xp,
    });
  } catch (err) {
    console.error("❌ Bonus XP Error:", err);
    return res.status(500).json({ ok: false, error: "Failed to update XP" });
  }
});

export default router;
