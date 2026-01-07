// server/routes/lessons.js
import express from "express";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";
import requireAdmin from "../middleware/admin.js";

const router = express.Router();

/* -----------------------------------------------------------
   USER ENDPOINTS — SAFE, UNTOUCHED, SAME AS YOUR WORKING CODE
----------------------------------------------------------- */
/* GET /api/lessons  → list lessons + unlocked logic */
router.get("/", authRequired, async (req, res) => {
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
      return res.json({ ok: true, lessons: [], unlocked: [] });
    }

    // ✅ Use the progress model you actually have in your project
    // Your file already uses prisma.userProgress elsewhere.
    const progresses = await prisma.userProgress.findMany({
      where: { user_id: userId },
      select: { lesson_id: true, completed: true },
    });

    const completedSet = new Set(
      progresses.filter((p) => p.completed).map((p) => p.lesson_id),
    );

    // attach completed flag so Lessons page can show ✓
    const lessonsWithStatus = lessons.map((l) => ({
      ...l,
      completed: completedSet.has(l.id),
    }));

    // unlocked logic: first lesson unlocked; next unlocked if prev completed; respect manual lock
    const unlocked = new Set();
    lessons.forEach((lesson, idx) => {
      if (lesson.is_locked) return;
      if (idx === 0) unlocked.add(lesson.id);
      else {
        const prevId = lessons[idx - 1].id;
        if (completedSet.has(prevId)) unlocked.add(lesson.id);
      }
    });

    return res.json({
      ok: true,
      lessons: lessonsWithStatus,
      unlocked: Array.from(unlocked),
    });
  } catch (err) {
    console.error("❌ /api/lessons error:", err);
    return res.status(500).json({ ok: false, error: "Failed to load lessons" });
  }
});

/* GET /api/lessons/:id → lesson details + progress */
router.get("/:id", authRequired, async (req, res) => {
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

    const progress = await prisma.userProgress.findFirst({
      where: { user_id: userId, lesson_id: lessonId },
      select: {
        completed: true,
        attempts: true,
        best_score: true,
        last_attempt_at: true,
      },
    });

    return res.json({ ok: true, lesson, progress: progress || null });
  } catch (err) {
    console.error("❌ /api/lessons/:id error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to load lesson details" });
  }
});

/* -----------------------------------------------------------
   ADMIN ENDPOINTS — FULL CRUD + REORDER (OPTION B)
----------------------------------------------------------- */

/* AUTO SLUG GENERATOR */
function makeSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/* GET /api/admin/lessons → list all lessons */
router.get("/admin/all", requireAdmin, async (req, res) => {
  try {
    const lessons = await prisma.lesson.findMany({
      orderBy: [{ order: "asc" }],
    });
    return res.json({ ok: true, lessons });
  } catch (err) {
    console.error("❌ Admin GET lessons error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to load lessons" });
  }
});

/* POST /api/admin/lessons → create lesson */
router.post("/admin", requireAdmin, async (req, res) => {
  try {
    const { title, description, content, difficulty, order } = req.body;

    if (!title) return res.json({ ok: false, message: "Title is required" });

    const slug = makeSlug(title);

    const created = await prisma.lesson.create({
      data: {
        title,
        description: description || "",
        content: content || "",
        difficulty: difficulty || "easy",
        slug,
        order: order || 1,
      },
    });

    return res.json({ ok: true, lesson: created });
  } catch (err) {
    console.error("❌ Admin create lesson error:", err);
    return res.status(500).json({ ok: false, message: "Create failed" });
  }
});

/* PUT /api/admin/lessons/:id → update lesson */
router.put("/admin/:id", requireAdmin, async (req, res) => {
  try {
    const lessonId = Number(req.params.id);
    const { title, description, content, difficulty, order, is_locked } =
      req.body;

    const slug = title ? makeSlug(title) : undefined;

    const updated = await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        title,
        description,
        content,
        difficulty,
        order,
        is_locked,
        slug,
      },
    });

    return res.json({ ok: true, lesson: updated });
  } catch (err) {
    console.error("❌ Admin update lesson error:", err);
    return res.status(500).json({ ok: false, message: "Update failed" });
  }
});

/* DELETE /api/admin/lessons/:id → delete lesson */
router.delete("/admin/:id", requireAdmin, async (req, res) => {
  try {
    const lessonId = Number(req.params.id);

    await prisma.lesson.delete({ where: { id: lessonId } });

    return res.json({ ok: true, message: "Lesson deleted" });
  } catch (err) {
    console.error("❌ Admin delete lesson error:", err);
    return res.status(500).json({ ok: false, message: "Delete failed" });
  }
});

/* PATCH /api/admin/lessons/reorder → bulk reorder */
router.patch("/admin/reorder", requireAdmin, async (req, res) => {
  try {
    const { orderedIds } = req.body;

    if (!Array.isArray(orderedIds))
      return res.json({ ok: false, message: "orderedIds must be an array" });

    await Promise.all(
      orderedIds.map((id, index) =>
        prisma.lesson.update({
          where: { id },
          data: { order: index + 1 },
        }),
      ),
    );

    return res.json({ ok: true, message: "Reordered successfully" });
  } catch (err) {
    console.error("❌ Admin reorder error:", err);
    return res.status(500).json({ ok: false, message: "Reorder failed" });
  }
});

export default router;
