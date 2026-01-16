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
    // Optional: replace existing rows for this lesson+mode before inserting
    const replace =
      String(req.query.replace || req.query.replaceMode || "")
        .trim()
        .toLowerCase() === "1" ||
      String(req.query.replace || req.query.replaceMode || "")
        .trim()
        .toLowerCase() === "true";

    const lessonIdNum = Number(lessonId);
    const modeStr = String(mode || "").toLowerCase();
    const xpNum = Number(xp || 150);

    if (!Number.isFinite(lessonIdNum) || lessonIdNum <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid lessonId" });
    }
    if (!["typing", "reorder"].includes(modeStr)) {
      return res.status(400).json({ ok: false, error: "Invalid mode" });
    }
    const hasItems = Array.isArray(items) && items.length > 0;

    if (!hasItems && (typeof text !== "string" || !text.trim())) {
      return res.status(400).json({
        ok: false,
        error: "Missing text (or provide items[])",
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

    // Optional: wipe existing quizzes for this lesson+mode (clean re-import)
    if (replace === true) {
      await prisma.quiz.deleteMany({
        where: { lessonId: lessonIdNum, type: modeStr },
      });
    }

    if (replace) {
      const del = await prisma.quiz.deleteMany({
        where: { lessonId: lessonIdNum, type: modeStr },
      });

      // Clear duplicates set because we just wiped the lesson+mode
      console.log(
        `[adminExercises] replace=1 deleted ${del.count} rows for lessonId=${lessonIdNum} mode=${modeStr}`,
      );
    }

    // Fetch existing sourceKeys to prevent duplicates (idempotent import)
    const existing = await prisma.quiz.findMany({
      where: { lessonId: lessonIdNum, type: modeStr },
      select: { data: true },
    });

    const existingKeys = new Set(
      existing
        .map((q) => q?.data?.sourceKey)
        .filter((k) => typeof k === "string" && k.length > 0),
    );

    // Insert into Quiz table (this exists in your schema)
    const rowsToInsert = [];
    let skipped = 0;

    rows.forEach((r, i) => {
      const english = String(r.english || "").trim();
      const words = english.split(/\s+/).filter(Boolean);

      const orderIndex = Number(r.orderIndex || i + 1) || i + 1;

      const sourceKey = makeSourceKey({
        lessonId: lessonIdNum,
        mode: modeStr,
        orderIndex,
        tamil: r.tamil,
        english,
      });

      if (existingKeys.has(sourceKey)) {
        skipped++;
        return;
      }

      rowsToInsert.push({
        lessonId: lessonIdNum,
        type: modeStr,
        prompt: r.tamil,
        question: english,
        xpReward: Number(r.xp || xpNum) || xpNum,
        data:
          modeStr === "reorder"
            ? { correctOrder: words, orderIndex, sourceKey }
            : { orderIndex, sourceKey },
      });
    });

    if (rowsToInsert.length === 0) {
      return res.json({
        ok: true,
        inserted: 0,
        skipped,
        message: "All exercises already exist (skipped duplicates).",
      });
    }

    // ✅ Safety: prevent accidental huge imports (helps avoid Railway timeouts)
    if (rowsToInsert.length > 5000) {
      return res.status(400).json({
        ok: false,
        error: "Too many rows in one bulk import (max 5000). Split the CSV.",
        debug: { rowsToInsert: rowsToInsert.length, skipped },
      });
    }

    const created = await prisma.quiz.createMany({ data: rowsToInsert });

    return res.json({
      ok: true,
      inserted: created.count,
      skipped,
    });
  } catch (err) {
    console.error("[adminExercises] bulk import error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

export default router;
