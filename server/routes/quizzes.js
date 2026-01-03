// server/routes/quizzes.js
import express from "express";
import prisma from "../db/client.js";
import authRequired, { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(authMiddleware);

const VALID_DIFFICULTIES = new Set(["beginner", "intermediate", "advanced"]);

function normalizeDifficulty(value) {
  if (!value) return null;
  const v = String(value).toLowerCase();
  return VALID_DIFFICULTIES.has(v) ? v : null;
}

// Simple shuffle helper for random quizzes
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/* -------------------------------------------------------------------------- */
/*                    GET /api/quizzes/random                                 */
/* -------------------------------------------------------------------------- */
/**
 * Query params:
 *  - lessonId (optional): only from this lesson
 *  - difficulty (optional): beginner | intermediate | advanced
 *  - limit (optional): default 10, max 50
 *
 * Returns random questions for gameplay:
 *  [
 *    { id, ta, en, difficulty, lesson_id, audio_url }
 *  ]
 */
router.get("/random", authRequired, async (req, res) => {
  try {
    const lessonIdRaw = req.query.lessonId;
    const difficulty = normalizeDifficulty(req.query.difficulty);
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 10));

    const where = {};

    if (lessonIdRaw) {
      const lessonId = Number(lessonIdRaw);
      if (Number.isNaN(lessonId)) {
        return res.status(400).json({
          ok: false,
          message: "lessonId must be a number",
        });
      }
      where.lesson_id = lessonId;
    }

    if (difficulty) {
      where.difficulty = difficulty;
    }

    // Fetch up to 200 candidates then shuffle server-side
    const candidates = await prisma.quizQuestion.findMany({
      where,
      take: 200,
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        ta: true,
        en: true,
        difficulty: true,
        lesson_id: true,
        audio_url: true,
      },
    });

    const questions = shuffle(candidates).slice(0, limit);

    return res.json({
      ok: true,
      count: questions.length,
      questions,
    });
  } catch (err) {
    console.error("❌ GET /api/quizzes/random error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to load random quizzes",
      error: String(err?.message || err),
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                 GET /api/quizzes/by-lesson/:lessonId                       */
/* -------------------------------------------------------------------------- */
// GET /api/quizzes/by-lesson/:lessonId
router.get("/by-lesson/:lessonId", authRequired, async (req, res) => {
  try {
    const lessonId = Number(req.params.lessonId);
    if (!lessonId || Number.isNaN(lessonId)) {
      return res.status(400).json({ ok: false, message: "Invalid lessonId" });
    }

    // Map difficulty -> UserLevel enum
    const diff = String(req.query.difficulty || "beginner").toLowerCase();
    const level =
      diff === "advanced"
        ? "ADVANCED"
        : diff === "intermediate"
          ? "INTERMEDIATE"
          : "BEGINNER";

    const day = await prisma.practiceDay.findFirst({
      where: { dayNumber: lessonId, level },
      include: { exercises: { orderBy: { orderIndex: "asc" } } },
    });

    if (!day) {
      return res.json({ ok: true, lessonId, level, questions: [] });
    }

    const questions = (day.exercises || []).map((ex) => {
      const expected = ex.expected || {};
      const correctOrder =
        expected.correctOrder ||
        expected.tokens ||
        String(expected.sentence || "").split(/\s+/);

      return {
        id: ex.id,
        type: expected.mode === "typing" ? "TYPING" : "REORDER",
        tamil: ex.promptTa,
        correctOrder: Array.isArray(correctOrder) ? correctOrder : [],
        answer:
          expected.sentence ||
          (Array.isArray(correctOrder) ? correctOrder.join(" ") : ""),
        orderIndex: ex.orderIndex,
        xp: ex.xp,
      };
    });

    return res.json({ ok: true, lessonId, level, questions });
  } catch (err) {
    console.error("❌ GET /api/quizzes/by-lesson error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to load lesson quizzes",
      error: String(err?.message || err),
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                  POST /api/quizzes/import/json                             */
/* -------------------------------------------------------------------------- */
/**
 * Body: { lessonId?, defaultDifficulty?, questions: [ { ta, en, difficulty?, audio_url? } ] }
 *
 * Example:
 * {
 *   "lessonId": 1,
 *   "defaultDifficulty": "beginner",
 *   "questions": [
 *     { "ta": "நான் பள்ளிக்குச் செல்கிறேன்", "en": "I am going to school" },
 *     { "ta": "அவள் புத்தகம் படிக்கிறாள்", "en": "She is reading a book", "difficulty": "intermediate" }
 *   ]
 * }
 */
router.post("/import/json", authRequired, async (req, res) => {
  try {
    const { lessonId, defaultDifficulty, questions } = req.body || {};

    if (!Array.isArray(questions) || questions.length === 0) {
      return res
        .status(400)
        .json({ ok: false, message: "questions[] is required and non-empty" });
    }

    const lessonIdNum =
      typeof lessonId === "number" ? lessonId : Number(lessonId) || null;

    const defaultDiff = normalizeDifficulty(defaultDifficulty) || "beginner";

    const rows = [];

    for (const q of questions) {
      if (!q || !q.ta || !q.en) continue;

      const diff =
        normalizeDifficulty(q.difficulty) || defaultDiff || "beginner";

      rows.push({
        ta: String(q.ta).trim(),
        en: String(q.en).trim(),
        difficulty: diff,
        lesson_id:
          typeof q.lessonId === "number"
            ? q.lessonId
            : q.lessonId
              ? Number(q.lessonId)
              : lessonIdNum,
        audio_url: q.audio_url ? String(q.audio_url).trim() : null,
      });
    }

    if (!rows.length) {
      return res.status(400).json({
        ok: false,
        message: "No valid questions found in payload",
      });
    }

    const result = await prisma.quizQuestion.createMany({
      data: rows,
      skipDuplicates: false,
    });

    return res.json({
      ok: true,
      message: `Imported ${result.count} questions`,
      inserted: result.count,
    });
  } catch (err) {
    console.error("❌ POST /api/quizzes/import/json error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to import JSON quizzes",
      error: String(err?.message || err),
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                  POST /api/quizzes/import/csv                              */
/* -------------------------------------------------------------------------- */
/**
 * Very simple CSV importer — expects text/csv body like:
 *
 * ta,en,difficulty,lesson_id,audio_url
 * நான் பள்ளிக்குச் செல்கிறேன்,I am going to school,beginner,1,https://...
 * அவள் புத்தகம் படிக்கிறாள்,She is reading a book,beginner,1,
 *
 * NOTE: This is a basic parser (no quoted commas). Keep commas out of sentences,
 * or later we can switch to a proper CSV library.
 */
router.post("/import/csv", authRequired, async (req, res) => {
  try {
    const raw =
      req.body && typeof req.body === "string" ? req.body : req.body?.csv;

    if (!raw || typeof raw !== "string") {
      return res.status(400).json({
        ok: false,
        message: "Send CSV text as raw body or { csv: '...' }",
      });
    }

    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length <= 1) {
      return res.status(400).json({
        ok: false,
        message: "CSV must include header and at least one data row",
      });
    }

    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const idxTa = header.indexOf("ta");
    const idxEn = header.indexOf("en");
    const idxDiff = header.indexOf("difficulty");
    const idxLesson = header.indexOf("lesson_id");
    const idxAudio = header.indexOf("audio_url");

    if (idxTa === -1 || idxEn === -1) {
      return res.status(400).json({
        ok: false,
        message: "CSV must include at least 'ta' and 'en' columns",
      });
    }

    const rows = [];

    for (let i = 1; i < lines.length; i += 1) {
      const cols = lines[i].split(",");
      const ta = (cols[idxTa] || "").trim();
      const en = (cols[idxEn] || "").trim();
      if (!ta || !en) continue;

      const diffRaw = idxDiff !== -1 ? (cols[idxDiff] || "").trim() : "";
      const diff = normalizeDifficulty(diffRaw) || "beginner";

      const lessonRaw =
        idxLesson !== -1 ? (cols[idxLesson] || "").trim() : null;
      const lessonId = lessonRaw ? Number(lessonRaw) : null;

      const audioUrl =
        idxAudio !== -1 ? (cols[idxAudio] || "").trim() || null : null;

      rows.push({
        ta,
        en,
        difficulty: diff,
        lesson_id: Number.isNaN(lessonId) ? null : lessonId,
        audio_url: audioUrl,
      });
    }

    if (!rows.length) {
      return res.status(400).json({
        ok: false,
        message: "No valid rows found in CSV",
      });
    }

    const result = await prisma.quizQuestion.createMany({
      data: rows,
      skipDuplicates: false,
    });

    return res.json({
      ok: true,
      message: `Imported ${result.count} questions from CSV`,
      inserted: result.count,
    });
  } catch (err) {
    console.error("❌ POST /api/quizzes/import/csv error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to import CSV quizzes",
      error: String(err?.message || err),
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                  POST /api/quizzes/import/txt                              */
/* -------------------------------------------------------------------------- */
// POST /api/quizzes/import/txt
router.post("/import/txt", authRequired, async (req, res) => {
  try {
    const { text, defaultDifficulty, lessonId, mode } = req.body || {};

    if (!text || typeof text !== "string") {
      return res
        .status(400)
        .json({ ok: false, message: "text field (string) is required" });
    }

    const lessonNum = Number(lessonId);
    if (!lessonNum || Number.isNaN(lessonNum)) {
      return res
        .status(400)
        .json({ ok: false, message: "lessonId is required" });
    }

    // difficulty -> enum
    const diff = String(defaultDifficulty || "beginner").toLowerCase();
    const level =
      diff === "advanced"
        ? "ADVANCED"
        : diff === "intermediate"
          ? "INTERMEDIATE"
          : "BEGINNER";

    const practiceMode = String(mode || "typing").toLowerCase(); // typing | reorder

    // ensure practiceDay exists
    const day =
      (await prisma.practiceDay.findFirst({
        where: { dayNumber: lessonNum, level },
      })) ||
      (await prisma.practiceDay.create({
        data: {
          dayNumber: lessonNum,
          level,
          titleEn: `Lesson ${lessonNum}`,
          titleTa: `பாடம் ${lessonNum}`,
          isActive: true,
        },
      }));

    // next order index
    const existingCount = await prisma.practiceExercise.count({
      where: { practiceDayId: day.id },
    });

    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const rows = [];
    let idx = 0;

    for (const line of lines) {
      const parts = line.split("|||").map((p) => p.trim());
      if (parts.length < 2) continue;

      const [ta, en] = parts;
      if (!ta || !en) continue;

      const tokens = en.split(/\s+/).filter(Boolean);

      rows.push({
        practiceDayId: day.id,
        type: "MAKE_SENTENCE",
        promptTa: ta,
        hintTa: null,
        structureEn: null,
        expected: {
          mode: practiceMode, // "typing" | "reorder"
          correctOrder: tokens, // used for reorder + typing
          sentence: tokens.join(" "),
        },
        xp: 50,
        orderIndex: existingCount + idx,
      });

      idx += 1;
    }

    if (!rows.length) {
      return res.status(400).json({
        ok: false,
        message: "No valid lines found in text",
      });
    }

    const result = await prisma.practiceExercise.createMany({
      data: rows,
      skipDuplicates: false,
    });

    return res.json({
      ok: true,
      message: `Imported ${result.count} exercises`,
      inserted: result.count,
      practiceDayId: day.id,
      dayNumber: day.dayNumber,
      level: day.level,
    });
  } catch (err) {
    console.error("❌ POST /api/quizzes/import/txt error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to import TXT quizzes",
      error: String(err?.message || err),
    });
  }
});

export default router;
