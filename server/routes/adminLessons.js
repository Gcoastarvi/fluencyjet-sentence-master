import express from "express";
import { PrismaClient } from "@prisma/client";
import { requireAdmin } from "../middleware/admin.js";

const prisma = new PrismaClient();
const router = express.Router();

// Utility: map DB row to API-friendly object (optional but nice)
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

/**
 * GET /api/admin/lessons
 * List all lessons
 */
router.get("/", requireAdmin, async (req, res) => {
  try {
    const lessons = await prisma.lesson.findMany({
      orderBy: { id: "asc" },
    });

    res.json({ lessons: lessons.map(mapLesson) });
  } catch (err) {
    console.error("Error in GET /api/admin/lessons", err);
    res.status(500).json({ error: "Failed to fetch lessons" });
  }
});

/**
 * GET /api/admin/lessons/:id
 * Get single lesson
 */
router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid lesson ID" });
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id },
    });

    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    res.json({ lesson: mapLesson(lesson) });
  } catch (err) {
    console.error("Error in GET /api/admin/lessons/:id", err);
    res.status(500).json({ error: "Failed to fetch lesson" });
  }
});

/**
 * POST /api/admin/lessons
 * Body: { slug, title, difficulty, isLocked }
 */
router.post("/", requireAdmin, async (req, res) => {
  try {
    let { slug, title, difficulty = "beginner", isLocked = false } = req.body;

    if (!slug || typeof slug !== "string") {
      return res.status(400).json({ error: "Slug is required" });
    }
    if (!title || typeof title !== "string") {
      return res.status(400).json({ error: "Title is required" });
    }

    // Optional: basic difficulty validation
    const allowed = ["beginner", "intermediate", "advanced"];
    if (!allowed.includes(difficulty)) {
      return res
        .status(400)
        .json({
          error: "Invalid difficulty. Use beginner | intermediate | advanced",
        });
    }

    const created = await prisma.lesson.create({
      data: {
        slug,
        title,
        difficulty,
        is_locked: Boolean(isLocked),
      },
    });

    res.status(201).json({ lesson: mapLesson(created) });
  } catch (err) {
    console.error("Error in POST /api/admin/lessons", err);

    // Unique slug error (if you set it unique in Prisma)
    if (err.code === "P2002") {
      return res.status(400).json({ error: "Slug already exists" });
    }

    res.status(500).json({ error: "Failed to create lesson" });
  }
});

/**
 * PUT /api/admin/lessons/:id
 * Body: { slug?, title?, difficulty?, isLocked? }
 */
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid lesson ID" });
    }

    const { slug, title, difficulty, isLocked } = req.body;

    const data = {};
    if (slug !== undefined) data.slug = slug;
    if (title !== undefined) data.title = title;
    if (difficulty !== undefined) data.difficulty = difficulty;
    if (isLocked !== undefined) data.is_locked = Boolean(isLocked);

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No fields provided to update" });
    }

    const updated = await prisma.lesson.update({
      where: { id },
      data,
    });

    res.json({ lesson: mapLesson(updated) });
  } catch (err) {
    console.error("Error in PUT /api/admin/lessons/:id", err);

    if (err.code === "P2025") {
      // Record not found
      return res.status(404).json({ error: "Lesson not found" });
    }

    res.status(500).json({ error: "Failed to update lesson" });
  }
});

/**
 * DELETE /api/admin/lessons/:id
 */
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid lesson ID" });
    }

    await prisma.lesson.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Error in DELETE /api/admin/lessons/:id", err);

    if (err.code === "P2025") {
      return res.status(404).json({ error: "Lesson not found" });
    }

    res.status(500).json({ error: "Failed to delete lesson" });
  }
});

export default router;
