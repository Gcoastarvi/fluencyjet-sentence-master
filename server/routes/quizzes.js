// server/routes/quizzes.js
import express from "express";
import prisma from "../db/client.js";
import { authMiddleware, authRequired } from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ Parse JSON bodies (curl payload.json)
// ✅ Also allow text/plain (raw import)
router.use(express.json({ limit: "2mb" }));
router.use(express.text({ type: "text/plain", limit: "2mb" }));

// ✅ attach req.user if Bearer token exists
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
 *  - lessonId (optional): maps to PracticeDay.dayNumber
 *  - difficulty (optional): beginner | intermediate | advanced
 *  - limit (optional): default 10, max 50
 */
router.get("/random", authRequired, async (req, res) => {
  try {
    const lessonIdRaw = req.query.lessonId;
    const diff = String(req.query.difficulty || "beginner").toLowerCase();
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 10));

    // Map difficulty -> UserLevel enum
    const level =
      diff === "advanced"
        ? "ADVANCED"
        : diff === "intermediate"
          ? "INTERMEDIATE"
          : "BEGINNER";

    const whereDay = { level };
    if (lessonIdRaw) {
      const lessonId = Number(lessonIdRaw);
      if (Number.isNaN(lessonId)) {
        return res
          .status(400)
          .json({ ok: false, message: "lessonId must be a number" });
      }
      whereDay.dayNumber = lessonId;
    }

    // Pull a few days, then sample exercises in JS
    const days = await prisma.practiceDay.findMany({
      where: whereDay,
      take: 30,
      orderBy: { dayNumber: "desc" },
      include: { exercises: { orderBy: { orderIndex: "asc" } } },
    });

    const pool = [];
    for (const day of days) {
      for (const ex of day.exercises || []) {
        const expected = ex.expected || {};
        const mode = String(
          expected.mode || expected.practiceType || "",
        ).toLowerCase();
        const tokens =
          expected.correctOrder ||
          expected.tokens ||
          String(expected.sentence || expected.answer || "")
            .trim()
            .split(/\s+/)
            .filter(Boolean);

        pool.push({
          id: ex.id,
          lessonId: day.dayNumber,
          level,
          type: mode === "typing" ? "TYPING" : "REORDER",
          tamil: ex.promptTa,
          correctOrder: Array.isArray(tokens) ? tokens : [],
          answer: String(expected.sentence || expected.answer || "").trim(),
          orderIndex: ex.orderIndex,
          xp: ex.xp,
        });
      }
    }

    // shuffle pool
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const questions = pool.slice(0, limit);

    return res.json({ ok: true, count: questions.length, questions });
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
// GET /api/quizzes/by-lesson/:lessonId?mode=typing|reorder&difficulty=beginner|intermediate|advanced
router.get("/by-lesson/:lessonId", authRequired, async (req, res) => {
  try {
    const lessonId = Number(req.params.lessonId);
    if (!Number.isFinite(lessonId) || lessonId <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid lessonId" });
    }

    // requested mode from UI
    const requestedMode = String(req.query.mode || "reorder").toLowerCase(); // typing | reorder

    // Map difficulty -> expected enum values used in DB (BEGINNER/INTERMEDIATE/ADVANCED)
    const diff = String(req.query.difficulty || "beginner").toLowerCase();
    const level =
      diff === "advanced"
        ? "ADVANCED"
        : diff === "intermediate"
          ? "INTERMEDIATE"
          : "BEGINNER";

    // Your schema supports practiceDay -> exercises relation (this is the safe query)
    const day = await prisma.practiceDay.findFirst({
      where: { dayNumber: lessonId, level },
      include: { exercises: { orderBy: { orderIndex: "asc" } } },
    });

    if (!day) {
      return res.json({ ok: true, lessonId, level, questions: [] });
    }

    const questionsAll = (day.exercises || []).map((ex) => {
      const expected = ex.expected || {};

      const mode = String(
        expected.mode || expected.practiceType || "",
      ).toLowerCase();
      const computedType = mode === "typing" ? "TYPING" : "REORDER";

      const tokens =
        expected.correctOrder ||
        expected.tokens ||
        String(expected.sentence || expected.answer || "")
          .trim()
          .split(/\s+/)
          .filter(Boolean);

      const answer = String(expected.sentence || expected.answer || "").trim();

      return {
        id: ex.id,
        type: computedType,
        tamil: ex.promptTa || "",
        correctOrder: Array.isArray(tokens) ? tokens : [],
        answer,
        orderIndex: ex.orderIndex ?? 0,
        xp: ex.xp ?? 0,
      };
    });

    // ✅ Filter by requested mode so typing UI gets TYPING questions, reorder UI gets REORDER questions
    const wantType = requestedMode === "typing" ? "TYPING" : "REORDER";
    const questions = questionsAll.filter((q) => q.type === wantType);

    return res.json({ ok: true, lessonId, level, questions });
  } catch (err) {
    console.error("❌ GET /api/quizzes/by-lesson error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to load quizzes",
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
router.post("/import/txt", authRequired, async (req, res) => {
  try {
    // req.body can be:
    // - object (application/json)
    // - string (text/plain OR if some middleware parsed it as text)
    let lessonId = null;
    let defaultDifficulty = "beginner";
    let mode = "typing";
    let text = "";

    if (typeof req.body === "string") {
      const raw = req.body.trim();

      // If someone accidentally sent JSON but it got parsed as text, recover it
      if (raw.startsWith("{") && raw.endsWith("}")) {
        try {
          const parsed = JSON.parse(raw);
          lessonId = parsed.lessonId ?? lessonId;
          defaultDifficulty = parsed.defaultDifficulty ?? defaultDifficulty;
          mode = parsed.mode ?? mode;
          text = parsed.text ?? "";
        } catch {
          text = raw;
        }
      } else {
        text = raw;
      }

      // allow metadata via querystring for text/plain
      if (lessonId == null && req.query.lessonId) lessonId = req.query.lessonId;
      if (req.query.defaultDifficulty)
        defaultDifficulty = String(req.query.defaultDifficulty);
      if (req.query.mode) mode = String(req.query.mode);
    } else {
      const body = req.body || {};
      lessonId = body.lessonId;
      defaultDifficulty = body.defaultDifficulty ?? defaultDifficulty;
      mode = body.mode ?? mode;
      text = body.text ?? "";
    }

    if (!text || typeof text !== "string" || !text.trim()) {
      return res
        .status(400)
        .json({ ok: false, message: "text field (string) is required" });
    }

    const lessonIdNum = Number(lessonId);
    if (!Number.isFinite(lessonIdNum) || lessonIdNum <= 0) {
      return res
        .status(400)
        .json({ ok: false, message: "lessonId (number) is required" });
    }

    const diff = String(defaultDifficulty || "beginner").toLowerCase();
    const level =
      diff === "advanced"
        ? "ADVANCED"
        : diff === "intermediate"
          ? "INTERMEDIATE"
          : "BEGINNER";

    // We map lessonId => dayNumber (your current schema design)
    const dayNumber = lessonIdNum;

    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    // Expect: Tamil|||English
    const parsedRows = [];
    for (const line of lines) {
      const parts = line.split("|||");
      if (parts.length < 2) continue;
      const promptTa = parts[0].trim();
      const expectedEn = parts.slice(1).join("|||").trim();
      if (!promptTa || !expectedEn) continue;

      // Store expected sentence as JSON (PracticeExercise.expected is Json)
      parsedRows.push({
        promptTa,
        expectedEn,
      });
    }

    if (!parsedRows.length) {
      return res.status(400).json({
        ok: false,
        message: "No valid rows found. Use: Tamil|||English (one per line).",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // find-or-create PracticeDay
      let day = await tx.practiceDay.findFirst({
        where: { level, dayNumber },
      });

      if (!day) {
        day = await tx.practiceDay.create({
          data: {
            level,
            dayNumber,
            titleEn: `Lesson ${lessonIdNum}`,
            titleTa: `பாடம் ${lessonIdNum}`,
            isActive: true,
          },
        });
      }

      // append at the end
      const last = await tx.practiceExercise.findFirst({
        where: { practiceDayId: day.id },
        orderBy: { orderIndex: "desc" },
        select: { orderIndex: true },
      });

      let orderIndex = (last?.orderIndex ?? 0) + 1;

      const createData = parsedRows.map((r) => {
        const words = r.expectedEn
          .replace(/[.?!]+$/g, "")
          .trim()
          .split(/\s+/);

        return {
          practiceDayId: day.id,
          type: "MAKE_SENTENCE",
          promptTa: r.promptTa,
          hintTa: null,
          structureEn: null,
          expected: {
            answer: r.expectedEn,
            words,
            mode: String(mode || "typing").toLowerCase(),
          },
          xp: 150,
          orderIndex: orderIndex++,
        };
      });

      const created = await tx.practiceExercise.createMany({
        data: createData,
      });

      return { day, createdCount: created.count };
    });

    return res.json({
      ok: true,
      lessonId: lessonIdNum,
      level,
      inserted: result.createdCount,
    });
  } catch (err) {
    console.error("❌ POST /api/quizzes/import/txt error:", err);
    return res.status(500).json({
      ok: false,
      message: "Import failed",
      error: String(err?.message || err),
    });
  }
});

export default router;
