import express from "express";
import prisma from "../db/client.js";

const router = express.Router();

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

    // Optional: replace existing rows for this lesson+mode before inserting
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
    const modeStr = String(body.mode ?? body.practiceType ?? body.type ?? "")
      .trim()
      .toLowerCase();
    const xpNum = Number(body.xp ?? 150) || 150;

    const items = Array.isArray(body.items)
      ? body.items
      : Array.isArray(body.rows)
        ? body.rows
        : [];
    const text = typeof body.text === "string" ? body.text : "";

    if (!Number.isFinite(lessonIdNum) || lessonIdNum <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid lessonId" });
    }

    // ✅ Future-proof: allow upcoming modes too
    if (!["typing", "reorder", "audio", "cloze"].includes(modeStr)) {
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

    // Preferred: items[]
    if (Array.isArray(items) && items.length > 0) {
      rows = items
        .map((it) => ({
          tamil: String(it.promptTa || it.tamil || "").trim(),
          english: String(it.answer || it.english || it.question || "").trim(),
          orderIndex: Number(it.orderIndex ?? it.order_index ?? 0) || 0,
          xp: Number(it.xp ?? xpNum) || xpNum,
        }))
        .filter((r) => r.tamil && r.english);
    }

    // Legacy: text "Tamil | English"
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
          xp: xpNum,
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

    // ✅ NEW: Write into PracticeDay + PracticeExercise (NOT Quiz)
    // Optional: wipe existing PracticeExercises for this lessonId(dayNumber)+mode
    // Idempotent behavior without replace: upsert by (practiceDayId + type + orderIndex)

    const now = new Date();

    // 1) Resolve level + title from Lesson (best), fallback to BEGINNER
    let level = "BEGINNER";
    let titleEn = `Lesson ${lessonIdNum}`;

    try {
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonIdNum },
        select: { title: true, difficulty: true },
      });

      if (lesson?.title) titleEn = lesson.title;

      const d = String(lesson?.difficulty || "")
        .trim()
        .toLowerCase();
      if (d.includes("inter")) level = "INTERMEDIATE";
      else if (d.includes("adv")) level = "ADVANCED";
      else if (d.includes("beg") || d.includes("basic")) level = "BEGINNER";
    } catch (e) {
      // safe fallback
    }

    // 2) Find-or-create PracticeDay (maps lessonId => dayNumber forever)
    let day = await prisma.practiceDay.findFirst({
      where: { level, dayNumber: lessonIdNum },
      select: { id: true },
    });

    if (!day) {
      day = await prisma.practiceDay.create({
        data: {
          level,
          dayNumber: lessonIdNum,
          titleEn,
          titleTa: "",
          isActive: true,
        },
        select: { id: true },
      });
    }

    // 3) Safety: avoid timeouts
    if (rows.length > 5000) {
      return res.status(400).json({
        ok: false,
        error: "Too many rows in one bulk import (max 5000). Split the CSV.",
        debug: { rows: rows.length },
      });
    }

    // 4) Optional replace: delete only this day+mode
    if (replace === true) {
      const del = await prisma.practiceExercise.deleteMany({
        where: { practiceDayId: day.id, type: modeStr },
      });
      console.log(
        `[adminExercises] replace=1 deleted ${del.count} practice rows for dayNumber=${lessonIdNum} level=${level} mode=${modeStr}`,
      );
    }

    // 5) Upsert rows by (practiceDayId + type + orderIndex)
    // We do loop-upsert (safe and truly idempotent even without unique constraints)
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    const seenOrder = new Set();

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

      // Prevent duplicates inside the same payload
      const keyInPayload = `${modeStr}:${orderIndex}`;
      if (seenOrder.has(keyInPayload)) {
        skipped++;
        continue;
      }
      seenOrder.add(keyInPayload);

      const words = english.split(/\s+/).filter(Boolean);

      // Stable idempotency key (stored inside expected for future-proofing)
      const sourceKey = makeSourceKey({
        lessonId: lessonIdNum,
        mode: modeStr,
        orderIndex,
        tamil,
        english,
      });

      const expected = {
        mode: modeStr,
        words,
        answer: english,
        sourceKey,
      };

      const existing = await prisma.practiceExercise.findFirst({
        where: {
          practiceDayId: day.id,
          type: modeStr,
          orderIndex,
        },
        select: { id: true },
      });

      if (existing) {
        await prisma.practiceExercise.update({
          where: { id: existing.id },
          data: {
            promptTa: tamil,
            expected,
            xp: Number(r.xp ?? xpNum) || xpNum,
          },
        });
        updated++;
      } else {
        await prisma.practiceExercise.create({
          data: {
            practiceDayId: day.id,
            type: modeStr,
            promptTa: tamil,
            expected,
            xp: Number(r.xp ?? xpNum) || xpNum,
            orderIndex,
          },
        });
        inserted++;
      }
    }

    return res.json({
      ok: true,
      lessonId: lessonIdNum,
      dayNumber: lessonIdNum,
      level,
      mode: modeStr,
      inserted,
      updated,
      skipped,
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
