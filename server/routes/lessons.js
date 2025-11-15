// server/routes/lessons.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware as authRequired } from "../middleware/authMiddleware.js";

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Lesson Rules:
 * - Lesson 1 always unlocked
 * - A lesson unlocks if previous lesson completed
 * - UserLessonProgress tracks completion
 */

/* ---------------- GET /lessons ---------------- */
router.get("/", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    const lessons = await prisma.lesson.findMany({
      orderBy: { order: "asc" },
      select: { id: true, title: true, description: true, order: true },
    });

    if (!lessons.length) {
      return res.json({ ok: true, lessons: [], unlocked: [] });
    }

    const completed = await prisma.userLessonProgress.findMany({
      where: { user_id: userId, completed: true },
      select: { lesson_id: true },
    });

    const completedSet = new Set(completed.map((x) => x.lesson_id));
    const unlocked = new Set();

    lessons.forEach((lesson, index) => {
      if (index === 0) unlocked.add(lesson.id);
      else {
        const prev = lessons[index - 1];
        if (completedSet.has(prev.id)) unlocked.add(lesson.id);
      }
    });

    res.json({ ok: true, lessons, unlocked: [...unlocked] });
  } catch (err) {
    console.error("❌ /api/lessons error:", err);
    res.status(500).json({
      ok: false,
      message: "Failed to load lessons",
      error: String(err?.message || err),
    });
  }
});

/* ---------------- GET /lessons/:id ---------------- */
router.get("/:id", authRequired, async (req, res) => {
  try {
    const lessonId = Number(req.params.id);
    const userId = req.user.id;

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, title: true, content: true, order: true },
    });

    if (!lesson) {
      return res.status(404).json({ ok: false, message: "Lesson not found" });
    }

    const progress = await prisma.userLessonProgress.findFirst({
      where: { user_id: userId, lesson_id: lessonId },
      select: { completed: true, attempts: true, best_score: true },
    });

    res.json({ ok: true, lesson, progress });
  } catch (err) {
    console.error("❌ /api/lessons/:id error:", err);
    res.status(500).json({
      ok: false,
      message: "Failed to load lesson details",
      error: String(err?.message || err),
    });
  }
});

export default router;
