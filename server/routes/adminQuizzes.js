// server/routes/adminQuizzes.js
import express from "express";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";
import requireAdmin from "../middleware/admin.js";

const router = express.Router();

/* ------------------------ ADMIN QUIZ HEALTH ------------------------ */
router.get("/health", (_req, res) => {
  return res.json({
    ok: true,
    message: "Admin Quizzes API running",
    timestamp: new Date().toISOString(),
  });
});

/* ------------------------ GET QUIZZES FOR A LESSON ------------------------ */
router.get("/:lessonId", authRequired, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.lessonId, 10);

    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: { questions: true }, // keep your existing relation
    });

    if (!lesson) {
      return res.status(404).json({ ok: false, message: "Lesson not found" });
    }

    return res.json({ ok: true, lesson });
  } catch (err) {
    console.error("Admin quiz fetch error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

/* ------------------------ ADD NEW QUIZ QUESTION ------------------------ */
router.post("/:lessonId/add", authRequired, requireAdmin, async (req, res) => {
  try {
    const lessonId = parseInt(req.params.lessonId, 10);
    const { ta, en } = req.body;

    if (!ta || !en) {
      return res.json({
        ok: false,
        message: "TA and EN fields required",
      });
    }

    const created = await prisma.lessonQuestion.create({
      data: {
        ta,
        en,
        lessonId,
      },
    });

    return res.json({ ok: true, created });
  } catch (err) {
    console.error("Admin add quiz error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to add question" });
  }
});

/* ------------------------ DELETE QUESTION ------------------------ */
router.delete("/:id/delete", authRequired, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    await prisma.lessonQuestion.delete({
      where: { id },
    });

    return res.json({ ok: true, message: "Deleted successfully" });
  } catch (err) {
    console.error("Admin delete quiz error:", err);
    return res.status(500).json({ ok: false, message: "Delete failed" });
  }
});

export default router;
