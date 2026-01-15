// server/routes/adminLessonsUpsert.js
import express from "express";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * POST /api/admin/lessons/upsert
 * Body: { slug: string, title?: string, level?: "basic"|"intermediate" }
 */
router.post("/lessons/upsert", authRequired, async (req, res) => {
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
      update: { title: cleanTitle, difficulty, updated_at: new Date() },
      create: { slug: cleanSlug, title: cleanTitle, difficulty },
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

export default router;
