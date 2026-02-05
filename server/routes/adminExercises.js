import express from "express";
import prisma from "../db/client.js";

const router = express.Router();

// Map UI modes -> Prisma enum ExerciseType
const EXERCISE_TYPE = {
  typing: "MAKE_SENTENCE",
  reorder: "DRAG_DROP",
  cloze: "FILL_BLANK",
  audio: "TRANSLATE",
};

function makeSourceKey({ lessonId, mode, orderIndex, tamil, english }) {
  const norm = (s) =>
    String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  return [
    `L${lessonId}`,
    `M${mode}`,
    `O${Number(orderIndex) || 0}`,
    `TA:${norm(tamil)}`,
    `EN:${norm(english)}`,
  ].join("|");
}

/**
 * POST /api/admin/exercises/bulk
 * Body: { lessonId: number, mode: "typing"|"reorder", text: string, xp?: number }
 *
 * text lines format:
 * Tamil | English
 */
router.post("/bulk", async (req, res) => {
  try {
    const body = req.body ?? {};

    // Optional: replace existing rows for this day+mode before inserting
    const replace =
      String(req.query.replace || req.query.replaceMode || "")
        .trim()
        .toLowerCase() === "1" ||
      String(req.query.replace || req.query.replaceMode || "")
        .trim()
        .toLowerCase() === "true";

    // Accept both legacy + new payload shapes
    const lessonIdNum = Number(
      body.lessonId ?? body.lesson_id ?? body.lessonIdNum ?? 0,
    );

    // NEW: allow dayNumber to be explicitly provided (preferred long-term)
    // fallback: dayNumber === lessonId (your current mapping)
    const dayNumberNum = Number(body.dayNumber ?? body.day_number ?? 0) || 0;

    const modeStr = String(body.mode ?? body.practiceType ?? body.type ?? "")
      .trim()
      .toLowerCase();

    const exerciseType = EXERCISE_TYPE[modeStr];
    const xpDefault = Number(body.xp ?? 150) || 150;

    const items = Array.isArray(body.items)
      ? body.items
      : Array.isArray(body.rows)
        ? body.rows
        : [];
    const text = typeof body.text === "string" ? body.text : "";

    if (!Number.isFinite(lessonIdNum) || lessonIdNum <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid lessonId" });
    }

    if (!exerciseType) {
      return res.status(400).json({ ok: false, error: "Invalid mode" });
    }

    const hasItems = Array.isArray(items) && items.length > 0;
    if (!hasItems && (!text || !text.trim())) {
      return res.status(400).json({
        ok: false,
        error: "Missing text (or provide items[] / rows[])",
      });
    }

    // Build rows from either `items[]` (preferred) OR `text` (legacy)
    let rows = [];

    if (Array.isArray(items) && items.length > 0) {
      rows = items
        .map((it) => ({
          tamil: String(it.promptTa || it.tamil || "").trim(),
          english: String(it.answer || it.english || it.question || "").trim(),
          orderIndex: Number(it.orderIndex ?? it.order_index ?? 0) || 0,
          xp: Number(it.xp ?? xpDefault) || xpDefault,
        }))
        .filter((r) => r.tamil && r.english);
    }

    if (!rows.length && typeof text === "string" && text.trim()) {
      rows = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => line.split("|").map((p) => p.trim()))
        .filter((parts) => parts.length >= 2)
        .map((parts, idx) => ({
          tamil: parts[0],
          english: parts.slice(1).join(" | "),
          orderIndex: idx + 1,
          xp: xpDefault,
        }))
        .filter((r) => r.tamil && r.english);
    }

    if (!rows.length) {
      return res.status(400).json({
        ok: false,
        error:
          "No valid rows found. Provide either items[] or text (Tamil | English per line).",
      });
    }

    if (rows.length > 5000) {
      return res.status(400).json({
        ok: false,
        error: "Too many rows in one bulk import (max 5000). Split the CSV.",
        debug: { rows: rows.length },
      });
    }

    // Resolve level + title from Lesson (best), fallback to BEGINNER
    let level = "BEGINNER";
    let titleEn = `Lesson ${lessonIdNum}`;

    // NEW: allow explicit level override from import script
    const levelOverride = String(body.level ?? body.difficulty ?? "")
      .trim()
      .toLowerCase();

    try {
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonIdNum },
        select: { title: true, difficulty: true },
      });

      if (lesson?.title) titleEn = lesson.title;

      const dRaw = levelOverride || String(lesson?.difficulty || "");
      const d = dRaw.trim().toLowerCase();

      if (d.includes("inter")) level = "INTERMEDIATE";
      else if (d.includes("adv")) level = "ADVANCED";
      else if (d.includes("beg") || d.includes("basic")) level = "BEGINNER";
    } catch {
      // safe fallback
    }

    // DayNumber: prefer explicit dayNumber; otherwise keep your current mapping
    const dayNumberFinal =
      Number.isFinite(dayNumberNum) && dayNumberNum > 0
        ? dayNumberNum
        : lessonIdNum;

    // Run the import atomically
    const result = await prisma.$transaction(async (tx) => {
      // Find-or-create PracticeDay (race-safe)
      let day = await tx.practiceDay.findFirst({
        where: { level, dayNumber: dayNumberFinal },
        select: { id: true },
      });

      if (!day) {
        try {
          day = await tx.practiceDay.create({
            data: {
              level,
              dayNumber: dayNumberFinal,
              titleEn,
              titleTa: "",
              isActive: true,
            },
            select: { id: true },
          });
        } catch (e) {
          // Only retry on unique constraint conflicts (P2002)
          if (e?.code !== "P2002") throw e;

          day = await tx.practiceDay.findFirst({
            where: { level, dayNumber: dayNumberFinal },
            select: { id: true },
          });
          if (!day) throw e;
        }
      }      

      // Optional replace: delete only this day+mode (IMPORTANT: use enum, not modeStr)
      let deleted = 0;
      if (replace === true) {
        const del = await tx.practiceExercise.deleteMany({
          where: { practiceDayId: day.id, type: exerciseType },
        });
        deleted = del.count;
      }

      // Prefetch existing by orderIndex for this day+type
      const existing = await tx.practiceExercise.findMany({
        where: { practiceDayId: day.id, type: exerciseType },
        select: { id: true, orderIndex: true },
      });

      const existingByOrder = new Map();
      for (const e of existing) existingByOrder.set(e.orderIndex, e.id);

      let inserted = 0;
      let updated = 0;
      let skipped = 0;

      // Prevent duplicates inside same payload
      const seenOrder = new Set();

      // Build create + update lists
      const toCreate = [];
      const toUpdate = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];

        const tamil = String(r.tamil || "").trim();
        const english = String(r.english || "").trim();
        const orderIndex = Number(r.orderIndex || i + 1) || i + 1;

        if (
          !tamil ||
          !english ||
          !Number.isFinite(orderIndex) ||
          orderIndex <= 0
        ) {
          skipped++;
          continue;
        }

        const keyInPayload = `${exerciseType}:${orderIndex}`;
        if (seenOrder.has(keyInPayload)) {
          skipped++;
          continue;
        }
        seenOrder.add(keyInPayload);

        const words = english.split(/\s+/).filter(Boolean);

        const sourceKey = makeSourceKey({
          lessonId: lessonIdNum,
          mode: modeStr,
          orderIndex,
          tamil,
          english,
        });

        const expected = {
          mode: modeStr, // UI mode (typing/reorder/audio/cloze)
          words,
          answer: english,
          sourceKey,
        };

        const xp = Number(r.xp ?? xpDefault) || xpDefault;

        const existingId = existingByOrder.get(orderIndex);
        if (existingId) {
          toUpdate.push({
            id: existingId,
            data: { promptTa: tamil, expected, xp, orderIndex },
          });
        } else {
          toCreate.push({
            practiceDayId: day.id,
            type: exerciseType,
            promptTa: tamil,
            expected,
            xp,
            orderIndex,
          });
        }
      }

      // createMany (fast); if DB has unique constraints, rerun stays safe
      if (toCreate.length) {
        // If your DB has UNIQUE(practiceDayId,type,orderIndex), skipDuplicates protects reruns.
        // If not, reruns are still safe because we pre-fetched existing before creation,
        // but a parallel import could still race; the try/catch is a second safety net.
        try {
          const created = await tx.practiceExercise.createMany({
            data: toCreate,
            skipDuplicates: true,
          });
          // created.count is "rows attempted inserted (after skipDuplicates)"
          inserted += created.count ?? 0;
        } catch {
          // Fallback: safest per-row create
          for (const row of toCreate) {
            try {
              await tx.practiceExercise.create({ data: row });
              inserted++;
            } catch {
              skipped++;
            }
          }
        }
      }

      // updates (per row)
      for (const u of toUpdate) {
        await tx.practiceExercise.update({
          where: { id: u.id },
          data: u.data,
        });
        updated++;
      }

      return {
        dayId: day.id,
        deleted,
        inserted,
        updated,
        skipped,
      };
    });

    return res.json({
      ok: true,
      lessonId: lessonIdNum,
      computed: {
        level,
        mode: modeStr, // "typing" | "reorder" | "audio" | "cloze"
        exerciseType, // Prisma enum: "MAKE_SENTENCE" | "DRAG_DROP" | ...
        dayNumber: dayNumberFinal,
        dayId: result.dayId,
      },
      deleted: result.deleted,
      inserted: result.inserted,
      updated: result.updated,
      skipped: result.skipped,
    });
  } catch (err) {
    console.error("[adminExercises] bulk import error:", err?.stack || err);
    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: String(err?.message || err),
    });
  }
});

export default router;
