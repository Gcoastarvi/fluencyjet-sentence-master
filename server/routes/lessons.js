// server/routes/lessons.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import authRequired from "../middleware/authRequired.js";

const prisma = new PrismaClient();
const router = express.Router();

/* --------------------------------------------------------------------
   GET /api/lessons
   Returns the list of lessons with lock/unlock info
-------------------------------------------------------------------- */
router.get("/", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    const progress = await prisma.userProgress.findUnique({
      where: { user_id: userId },
    });

    const lastUnlocked = progress?.last_unlocked_order ?? 1;

    const lessons = await prisma.lesson.findMany({
      orderBy: { order: "asc" },
      select: {
        id: true,
        title: true,
        slug: true,
        order: true,
        is_locked: true,
      },
    });

    const visible = lessons.map((l) => ({
      ...l,
      unlocked:
        user.has_access || l.order <= lastUnlocked ? true : !l.is_locked,
    }));

    res.json({ ok: true, lessons: visible });
  } catch (err) {
    console.error("Lessons error:", err);
    res.status(500).json({ ok: false, message: "Failed to fetch lessons" });
  }
});

/* --------------------------------------------------------------------
   GET /api/lessons/:id
   Returns one lesson + questions
-------------------------------------------------------------------- */
router.get("/:id", authRequired, async (req, res) => {
  try {
    const lessonId = Number(req.params.id);

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { questions: true },
    });

    if (!lesson)
      return res.status(404).json({ ok: false, message: "Lesson not found" });

    res.json({ ok: true, lesson });
  } catch (err) {
    console.error("Lesson detail error:", err);
    res.status(500).json({ ok: false, message: "Failed to fetch lesson" });
  }
});

export default router;
