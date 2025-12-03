// server/routes/adminLessons.js
import express from "express";
import prisma from "../db/client.js";
import { requireAdmin } from "../middleware/admin.js";

const router = express.Router();

/* Utility Mapper */
function mapLesson(lesson) {
  return {
    id: lesson.id,
    slug: lesson.slug,
    title: lesson.title,
    difficulty: lesson.difficulty,
    isLocked: lesson.is_locked,
    createdAt: lesson.created_at,
  };
}

/* --------------------------------------------------------------------------
   GET /api/admin/lessons
   List all lessons
---------------------------------------------------------------------------*/
router.get("/", requireAdmin, async (req, res) => {
  try {
    const lessons = await prisma.lesson.findMany({
      orderBy: { id: "asc" },
    });

    return res.json({ ok: true, lessons: lessons.map(mapLesson) });
  } catch (err) {
    console.error("GET /admin/lessons error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to fetch lessons" });
  }
});

/* --------------------------------------------------------------------------
   GET /api/admin/lessons/:id
---------------------------------------------------------------------------*/
router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id))
      return res.status(400).json({ ok: false, message: "Invalid lesson ID" });

    const lesson = await prisma.lesson.findUnique({ where: { id } });

    if (!lesson)
      return res.status(404).json({ ok: false, message: "Lesson not found" });

    return res.json({ ok: true, lesson: mapLesson(lesson) });
  } catch (err) {
    console.error("GET /admin/lessons/:id error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to fetch lesson" });
  }
});

/* --------------------------------------------------------------------------
   POST /api/admin/lessons
---------------------------------------------------------------------------*/
router.post("/", requireAdmin, async (req, res) => {
  try {
    let { slug, title, difficulty = "beginner", isLocked = false } = req.body;

    if (!slug)
      return res.status(400).json({ ok: false, message: "Slug required" });
    if (!title)
      return res.status(400).json({ ok: false, message: "Title required" });

    const allowedDifficulty = ["beginner", "intermediate", "advanced"];

    if (!allowedDifficulty.includes(difficulty))
      return res
        .status(400)
        .json({ ok: false, message: "Invalid difficulty value" });

    const lesson = await prisma.lesson.create({
      data: {
        slug,
        title,
        difficulty,
        is_locked: Boolean(isLocked),
      },
    });

    return res.status(201).json({ ok: true, lesson: mapLesson(lesson) });
  } catch (err) {
    console.error("POST /admin/lessons error:", err);

    if (err.code === "P2002")
      return res
        .status(400)
        .json({ ok: false, message: "Slug already exists" });

    return res
      .status(500)
      .json({ ok: false, message: "Failed to create lesson" });
  }
});

/* --------------------------------------------------------------------------
   PUT /api/admin/lessons/:id
---------------------------------------------------------------------------*/
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id))
      return res.status(400).json({ ok: false, message: "Invalid lesson ID" });

    const { slug, title, difficulty, isLocked } = req.body;

    const data = {};
    if (slug) data.slug = slug;
    if (title) data.title = title;
    if (difficulty) data.difficulty = difficulty;
    if (isLocked !== undefined) data.is_locked = Boolean(isLocked);

    const updated = await prisma.lesson.update({
      where: { id },
      data,
    });

    return res.json({ ok: true, lesson: mapLesson(updated) });
  } catch (err) {
    console.error("PUT /admin/lessons/:id error:", err);

    if (err.code === "P2025")
      return res.status(404).json({ ok: false, message: "Lesson not found" });

    return res
      .status(500)
      .json({ ok: false, message: "Failed to update lesson" });
  }
});

/* --------------------------------------------------------------------------
   DELETE /api/admin/lessons/:id
---------------------------------------------------------------------------*/
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id))
      return res.status(400).json({ ok: false, message: "Invalid lesson ID" });

    await prisma.lesson.delete({ where: { id } });

    return res.json({ ok: true, message: "Lesson deleted" });
  } catch (err) {
    console.error("DELETE /admin/lessons/:id error:", err);

    if (err.code === "P2025")
      return res.status(404).json({ ok: false, message: "Lesson not found" });

    return res
      .status(500)
      .json({ ok: false, message: "Failed to delete lesson" });
  }
});

export default router;
