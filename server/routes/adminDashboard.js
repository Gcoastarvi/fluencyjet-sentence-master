import express from "express";
import prisma from "../db/client.js";
import { adminOnly } from "../middleware/adminOnly.js";

const router = express.Router();

router.get("/", adminOnly, async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalLessons = await prisma.lesson.count();
    const totalQuizzes = await prisma.quiz.count();

    return res.json({
      ok: true,
      totalUsers,
      totalLessons,
      totalQuizzes,
    });
  } catch (err) {
    console.error("Admin Dashboard Error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

export default router;
