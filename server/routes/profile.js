import express from "express";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const router = express.Router();

// ✅ /api/profile/update
router.post("/update", async (req, res) => {
  try {
    const { username, avatar_url } = req.body;
    const userId = req.user?.id || 1; // demo user

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { username, avatar_url },
      select: { id: true, username: true, avatar_url: true },
    });

    res.json({ ok: true, updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Profile update failed." });
  }
});

export default router;
