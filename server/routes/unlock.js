import express from "express";
import { PrismaClient } from "@prisma/client";
import authRequired from "../middleware/authRequired.js";

const prisma = new PrismaClient();
const router = express.Router();

/* ----------------------------------------------
   POST /api/lessons/unlock
   Body: { lessonId }
---------------------------------------------- */
router.post("/", authRequired, async (req, res) => {
  try {
    const { lessonId } = req.body;

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson)
      return res.status(404).json({ ok: false, message: "Lesson not found" });

    await prisma.userProgress.upsert({
      where: { user_id: req.user.id },
      update: { last_unlocked_order: lesson.order },
      create: {
        user_id: req.user.id,
        last_unlocked_order: lesson.order,
      },
    });

    res.json({ ok: true, message: "Lesson unlocked" });
  } catch (err) {
    console.error("Unlock error:", err);
    res.status(500).json({ ok: false, message: "Failed to unlock lesson" });
  }
});

export default router;
