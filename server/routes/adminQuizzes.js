// server/routes/adminQuizzes.js
import express from "express";
import prisma from "../db/client.js";
import { requireAdmin } from "../middleware/admin.js";
import authRequired from "../middleware/authMiddleware.js";

const router = express.Router();

/* --------------------------------------------------------------------------
   HEALTH CHECK
---------------------------------------------------------------------------*/
router.get("/health", (req, res) => {
  return res.json({
    ok: true,
    message: "Admin Quizzes API running",
    timestamp: new Date().toISOString(),
  });
});

/* --------------------------------------------------------------------------
   GET ALL QUIZZES FOR A LESSON
   GET /api/admin/quizzes/:lessonId
---------------------------------------------------------------------------*/
router.get("/:lessonId", authRequired, requireAdmin, async (req, res) => {
  try {
    const lessonId = parseInt(req.params.lessonId, 10);

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        questions: {
          orderBy: { id: "asc" },
        },
      },
    });

    if (!lesson)
      return res.status(404).json({ ok: false, message: "Lesson not found" });

    return res.json({ ok: true, lesson });
  } catch (err) {
    console.error("Admin GET quizzes error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Server error fetching quizzes" });
  }
});

/* --------------------------------------------------------------------------
   ADD QUIZ QUESTION
   POST /api/admin/quizzes/:lessonId/add
---------------------------------------------------------------------------*/
router.post("/:lessonId/add", authRequired, requireAdmin, async (req, res) => {
  try {
    const lessonId = parseInt(req.params.lessonId, 10);
    const { ta, en } = req.body;

    if (!ta || !en)
      return res.status(400).json({ ok: false, message: "TA + EN required" });

    const created = await prisma.lessonQuestion.create({
      data: { ta, en, lessonId },
    });

    return res.json({ ok: true, created });
  } catch (err) {
    console.error("Admin add quiz error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to add quiz question" });
  }
});

/* --------------------------------------------------------------------------
   DELETE QUIZ QUESTION
   DELETE /api/admin/quizzes/:id/delete
---------------------------------------------------------------------------*/
router.delete("/:id/delete", authRequired, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    await prisma.lessonQuestion.delete({ where: { id } });

    return res.json({ ok: true, message: "Question deleted" });
  } catch (err) {
    console.error("Admin delete quiz error:", err);

    if (err.code === "P2025")
      return res.status(404).json({ ok: false, message: "Question not found" });

    return res
      .status(500)
      .json({ ok: false, message: "Failed to delete question" });
  }
});

export default router;
