// server/routes/lessons.js
import express from "express";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Rules:
 * - Lessons sorted by `order` (fallback by id if needed)
 * - Lesson #1 always unlocked for a user
 * - A lesson is unlocked if previous lesson (by order) is completed
 */

// GET /api/lessons
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const lessons = await prisma.lesson.findMany({
      orderBy: [{ order: "asc" }, { id: "asc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        difficulty: true,
        order: true,
        is_locked: true,
      },
    });

    if (!lessons.length) {
      return res.json({ lessons: [], unlocked: [] });
    }

    const progresses = await prisma.userLessonProgress.findMany({
      where: { user_id: userId },
      select: { lesson_id: true, completed: true },
    });

    const completedSet = new Set(
      progresses.filter((p) => p.completed).map((p) => p.lesson_id),
    );

    const unlocked = new Set();

    lessons.forEach((lesson, idx) => {
      if (idx === 0) {
        unlocked.add(lesson.id);
      } else {
        const prevLessonId = lessons[idx - 1].id;
        if (completedSet.has(prevLessonId)) {
          unlocked.add(lesson.id);
        }
      }
    });

    return res.json({
      lessons,
      unlocked: Array.from(unlocked),
    });
  } catch (err) {
    console.error("❌ /api/lessons error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to load lessons",
      error: String(err?.message || err),
    });
  }
});

// GET /api/lessons/:id
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const lessonId = Number(req.params.id);
    const userId = req.user.id;

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        content: true,
        difficulty: true,
        order: true,
      },
    });

    if (!lesson) {
      return res.status(404).json({ ok: false, message: "Lesson not found" });
    }

    const progress = await prisma.userLessonProgress.findFirst({
      where: { user_id: userId, lesson_id: lessonId },
      select: {
        completed: true,
        attempts: true,
        best_score: true,
        last_attempt_at: true,
      },
    });

    return res.json({
      ok: true,
      lesson,
      progress: progress || null,
    });
  } catch (err) {
    console.error("❌ /api/lessons/:id error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to load lesson details",
      error: String(err?.message || err),
    });
  }
});

export default router;
