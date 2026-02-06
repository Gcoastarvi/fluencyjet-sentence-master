// server/routes/lessons.js
import express from "express";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";
import requireAdmin from "../middleware/admin.js";

import { authMiddleware } from "../middleware/authMiddleware.js";
import prisma from "../prisma.js"; // adjust import to your project

const router = express.Router();

/* -----------------------------------------------------------
   USER ENDPOINTS — SAFE, UNTOUCHED, SAME AS YOUR WORKING CODE
----------------------------------------------------------- */
/* GET /api/lessons  → list lessons + unlocked logic */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id ?? null;

    const lessons = await prisma.lesson.findMany({
      orderBy: [{ id: "asc" }], // ✅ order column doesn't exist; use id
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        difficulty: true,
        isLocked: true,
      },
    });

    if (!lessons.length) {
      return res.json({ ok: true, lessons: [], unlocked: [] });
    }

    // No per-lesson progress model exists in this project right now.
    // So: unlocked = all lessons not locked; completed defaults to false.
    const unlocked = new Set();
    lessons.forEach((l) => {
      if (!l.isLocked) unlocked.add(l.id);
    });

    const lessonsOut = lessons.map((l) => ({
      ...l,
      completed: false, // placeholder until per-lesson progress exists
      is_locked: l.isLocked, // alias for older UI code
    }));

    return res.json({
      ok: true,
      lessons: lessonsOut,
      unlocked: Array.from(unlocked),
    });
  } catch (err) {
    console.error("❌ /api/lessons error:", err);
    return res.status(500).json({ ok: false, error: "Failed to load lessons" });
  }
});

/* GET /api/lessons/:id → lesson details + progress */
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const lessonId = Number(req.params.id);
    const userId = req.user?.id ? Number(req.user.id) : null;

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        difficulty: true,
        isLocked: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!lesson) {
      return res.status(404).json({ ok: false, error: "Lesson not found" });
    }

    // normalize field for older UI code
    const lessonOut = { ...lesson, is_locked: lesson.isLocked };

    let userProgress = null;
    if (req.user?.id) {
      const userId = Number(req.user.id);
      userProgress = await prisma.userProgress.findFirst({
        where: { user_id: userId },
        select: { xp: true, streak: true, badges: true, updated_at: true },
      });
    }

    return res.json({
      ok: true,
      lesson: lessonOut,
      userProgress,
    });
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
      orderBy: [{ id: "asc" }],
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

/* POST /api/admin/lessons/upsert → upsert by slug (for CSV pipeline)
   Body: { slug: string, title?: string, level?: "basic"|"intermediate" }
*/
router.post("/admin/lessons/upsert", authRequired, async (req, res) => {
  try {
    const { slug, title, level } = req.body || {};

    const cleanSlug = String(slug || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    if (!cleanSlug) {
      return res.status(400).json({ ok: false, error: "slug is required" });
    }

    const cleanLevel = String(level || "")
      .trim()
      .toLowerCase();
    const difficulty = cleanLevel === "intermediate" ? "intermediate" : "basic";

    const cleanTitle =
      String(title || "").trim() || cleanSlug.replace(/-/g, " ");

    const lesson = await prisma.lesson.upsert({
      where: { slug: cleanSlug },
      update: {
        title: cleanTitle,
        difficulty,
        updated_at: new Date(),
      },
      create: {
        slug: cleanSlug,
        title: cleanTitle,
        difficulty,
      },
    });

    return res.json({ ok: true, lesson });
  } catch (err) {
    console.error("POST /api/admin/lessons/upsert error:", err);
    return res.status(500).json({
      ok: false,
      error: "Lesson upsert failed",
      debug: { name: err?.name, message: err?.message },
    });
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
