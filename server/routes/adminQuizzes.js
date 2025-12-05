// server/routes/adminQuizzes.js
import express from "express";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";
import requireAdmin from "../middleware/admin.js";

const router = express.Router();

/**
 * Simple health check for this router
 * GET /api/admin/quizzes/health
 */
router.get("/health", (_req, res) => {
  return res.json({
    ok: true,
    message: "Admin Quizzes API running",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Map a Quiz row into an admin-facing payload
 */
function mapQuiz(q) {
  return {
    id: q.id,
    lessonId: q.lessonId,
    question: q.question,
    type: q.type,
    prompt: q.prompt,
    data: q.data,
    xpReward: q.xpReward,
    created_at: q.created_at,
    updated_at: q.updated_at,
    lesson: q.lesson
      ? {
          id: q.lesson.id,
          slug: q.lesson.slug,
          title: q.lesson.title,
        }
      : undefined,
  };
}

/**
 * GET /api/admin/quizzes
 * List all quizzes with basic lesson info
 */
router.get("/", authRequired, requireAdmin, async (_req, res) => {
  try {
    const quizzes = await prisma.quiz.findMany({
      orderBy: { created_at: "desc" },
      include: {
        lesson: {
          select: { id: true, slug: true, title: true },
        },
      },
    });

    return res.json({
      ok: true,
      quizzes: quizzes.map(mapQuiz),
    });
  } catch (err) {
    console.error("GET /api/admin/quizzes error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to fetch quizzes" });
  }
});

/**
 * GET /api/admin/quizzes/lesson/:lessonId
 * List quizzes for a specific lesson
 */
router.get(
  "/lesson/:lessonId",
  authRequired,
  requireAdmin,
  async (req, res) => {
    try {
      const lessonId = Number(req.params.lessonId);
      if (Number.isNaN(lessonId)) {
        return res
          .status(400)
          .json({ ok: false, message: "Invalid lesson id" });
      }

      const quizzes = await prisma.quiz.findMany({
        where: { lessonId },
        orderBy: { created_at: "asc" },
        include: {
          lesson: {
            select: { id: true, slug: true, title: true },
          },
        },
      });

      return res.json({
        ok: true,
        quizzes: quizzes.map(mapQuiz),
      });
    } catch (err) {
      console.error("GET /api/admin/quizzes/lesson/:lessonId error:", err);
      return res
        .status(500)
        .json({ ok: false, message: "Failed to fetch quizzes for lesson" });
    }
  },
);

/**
 * POST /api/admin/quizzes/lesson/:lessonId
 * Create a new quiz question for a lesson
 */
router.post(
  "/lesson/:lessonId",
  authRequired,
  requireAdmin,
  async (req, res) => {
    try {
      const lessonId = Number(req.params.lessonId);
      if (Number.isNaN(lessonId)) {
        return res
          .status(400)
          .json({ ok: false, message: "Invalid lesson id" });
      }

      const { question, type, prompt, data, xpReward } = req.body;

      if (!question) {
        return res
          .status(400)
          .json({ ok: false, message: "Question text is required" });
      }

      const created = await prisma.quiz.create({
        data: {
          lessonId,
          question,
          type: type || "typing",
          prompt: prompt || null,
          data: data || null,
          xpReward: typeof xpReward === "number" ? xpReward : 50,
        },
        include: {
          lesson: {
            select: { id: true, slug: true, title: true },
          },
        },
      });

      return res.status(201).json({
        ok: true,
        quiz: mapQuiz(created),
      });
    } catch (err) {
      console.error("POST /api/admin/quizzes/lesson/:lessonId error:", err);
      return res
        .status(500)
        .json({ ok: false, message: "Failed to create quiz question" });
    }
  },
);

/**
 * PUT /api/admin/quizzes/:id
 * Update an existing quiz question
 */
router.put("/:id", authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, message: "Invalid quiz id" });
    }

    const { question, type, prompt, data, xpReward } = req.body;

    const updateData = {};
    if (typeof question === "string" && question.trim()) {
      updateData.question = question.trim();
    }
    if (typeof type === "string" && type.trim()) {
      updateData.type = type.trim();
    }
    if (typeof prompt === "string") {
      updateData.prompt = prompt;
    }
    if (data !== undefined) {
      updateData.data = data;
    }
    if (typeof xpReward === "number") {
      updateData.xpReward = xpReward;
    }

    if (Object.keys(updateData).length === 0) {
      return res
        .status(400)
        .json({ ok: false, message: "No valid fields provided to update" });
    }

    const updated = await prisma.quiz.update({
      where: { id },
      data: updateData,
      include: {
        lesson: {
          select: { id: true, slug: true, title: true },
        },
      },
    });

    return res.json({
      ok: true,
      quiz: mapQuiz(updated),
    });
  } catch (err) {
    console.error("PUT /api/admin/quizzes/:id error:", err);

    if (err.code === "P2025") {
      return res.status(404).json({ ok: false, message: "Quiz not found" });
    }

    return res
      .status(500)
      .json({ ok: false, message: "Failed to update quiz" });
  }
});

/**
 * DELETE /api/admin/quizzes/:id
 */
router.delete("/:id", authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, message: "Invalid quiz id" });
    }

    await prisma.quiz.delete({
      where: { id },
    });

    return res.json({ ok: true, message: "Question deleted" });
  } catch (err) {
    console.error("DELETE /api/admin/quizzes/:id error:", err);

    if (err.code === "P2025") {
      return res.status(404).json({ ok: false, message: "Quiz not found" });
    }

    return res
      .status(500)
      .json({ ok: false, message: "Failed to delete question" });
  }
});

export default router;
