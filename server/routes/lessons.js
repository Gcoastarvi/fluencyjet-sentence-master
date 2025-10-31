import express from "express";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const router = express.Router();

// ✅ /api/lessons
router.get("/", async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    const lessons = await prisma.lesson.findMany({
      orderBy: { id: "asc" },
    });

    const visible = lessons.map((l) => ({
      ...l,
      is_locked: !user?.has_access && l.is_locked,
    }));

    res.json({ ok: true, lessons: visible });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to fetch lessons." });
  }
});

export default router;
