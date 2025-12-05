// server/routes/adminLessons.js
import express from "express";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";
import requireAdmin from "../middleware/admin.js";

const router = express.Router();

/**
 * Map a Lesson row into an admin-facing payload
 */
function mapLesson(lesson) {
  return {
    id: lesson.id,
    slug: lesson.slug,
    title: lesson.title,
    description: lesson.description,
    difficulty: lesson.difficulty,
    isLocked: lesson.isLocked,
    created_at: lesson.created_at,
    updated_at: lesson.updated_at,
  };
}

/**
 * GET /api/admin/lessons
 * List all lessons
 */
router.get("/", authRequired, requireAdmin, async (_req, res) => {
  try {
    const lessons = await prisma.lesson.findMany({
      orderBy: { created_at: "desc" },
    });

    return res.json({
      ok: true,
      lessons: lessons.map(mapLesson),
    });
  } catch (err) {
    console.error("GET /api/admin/lessons error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to fetch lessons" });
  }
});

/**
 * GET /api/admin/lessons/:id
 */
router.get("/:id", authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, message: "Invalid lesson id" });
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id },
    });

    if (!lesson) {
      return res.status(404).json({ ok: false, message: "Lesson not found" });
    }

    return res.json({ ok: true, lesson: mapLesson(lesson) });
  } catch (err) {
    console.error("GET /api/admin/lessons/:id error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to fetch lesson" });
  }
});

/**
 * POST /api/admin/lessons
 * Create a new lesson
 */
router.post("/", authRequired, requireAdmin, async (req, res) => {
  try {
    const { slug, title, description, difficulty, isLocked } = req.body;

    if (!slug || !title) {
      return res
        .status(400)
        .json({ ok: false, message: "Slug and title are required" });
    }

    const created = await prisma.lesson.create({
      data: {
        slug,
        title,
        description: description || "",
        difficulty: difficulty || "beginner",
        isLocked: Boolean(isLocked),
      },
    });

    return res.status(201).json({
      ok: true,
      lesson: mapLesson(created),
    });
  } catch (err) {
    console.error("POST /api/admin/lessons error:", err);

    if (err.code === "P2002") {
      // Unique constraint on slug
      return res
        .status(409)
        .json({ ok: false, message: "Lesson slug already exists" });
    }

    return res
      .status(500)
      .json({ ok: false, message: "Failed to create lesson" });
  }
});

/**
 * PUT /api/admin/lessons/:id
 * Update an existing lesson
 */
router.put("/:id", authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, message: "Invalid lesson id" });
    }

    const { slug, title, description, difficulty, isLocked } = req.body;

    const data = {};
    if (typeof slug === "string" && slug.trim()) data.slug = slug.trim();
    if (typeof title === "string" && title.trim()) data.title = title.trim();
    if (typeof description === "string") data.description = description;
    if (typeof difficulty === "string" && difficulty.trim()) {
      data.difficulty = difficulty.trim();
    }
    if (typeof isLocked === "boolean") data.isLocked = isLocked;

    if (Object.keys(data).length === 0) {
      return res
        .status(400)
        .json({ ok: false, message: "No valid fields provided to update" });
    }

    const updated = await prisma.lesson.update({
      where: { id },
      data,
    });

    return res.json({
      ok: true,
      lesson: mapLesson(updated),
    });
  } catch (err) {
    console.error("PUT /api/admin/lessons/:id error:", err);

    if (err.code === "P2025") {
      return res.status(404).json({ ok: false, message: "Lesson not found" });
    }

    return res
      .status(500)
      .json({ ok: false, message: "Failed to update lesson" });
  }
});

/**
 * DELETE /api/admin/lessons/:id
 */
router.delete("/:id", authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, message: "Invalid lesson id" });
    }

    await prisma.lesson.delete({
      where: { id },
    });

    return res.json({ ok: true, message: "Lesson deleted" });
  } catch (err) {
    console.error("DELETE /api/admin/lessons/:id error:", err);

    if (err.code === "P2025") {
      return res.status(404).json({ ok: false, message: "Lesson not found" });
    }

    return res
      .status(500)
      .json({ ok: false, message: "Failed to delete lesson" });
  }
});

export default router;
