import express from "express";
import prisma from "../db/client.js";

const router = express.Router();

/**
 * POST /api/admin/exercises/bulk
 * Body: { lessonId: number, mode: "typing"|"reorder", text: string, xp?: number }
 *
 * text lines format:
 * Tamil | English
 */
router.post("/bulk", async (req, res) => {
  try {
    const { lessonId, mode, text, xp } = req.body || {};

    const lessonIdNum = Number(lessonId);
    const modeStr = String(mode || "").toLowerCase();
    const xpNum = Number(xp || 150);

    if (!Number.isFinite(lessonIdNum) || lessonIdNum <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid lessonId" });
    }
    if (!["typing", "reorder"].includes(modeStr)) {
      return res.status(400).json({ ok: false, error: "Invalid mode" });
    }
    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ ok: false, error: "Missing text" });
    }

    // Parse: each line must be "Tamil | English"
    const rows = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => line.split("|").map((p) => p.trim()))
      .filter((parts) => parts.length >= 2)
      .map((parts) => ({
        tamil: parts[0],
        english: parts.slice(1).join(" | "),
      }))
      .filter((r) => r.tamil && r.english);

    if (!rows.length) {
      return res.status(400).json({
        ok: false,
        error: "No valid rows found. Expected: Tamil | English per line.",
      });
    }

    // Insert into Quiz table (this exists in your schema)
    const rowsToInsert = rows.map((r, i) => {
      const english = String(r.english || "").trim();
      const words = english.split(/\s+/).filter(Boolean);

      return {
        lessonId: lessonIdNum,
        type: modeStr,              // store as "typing" or "reorder" (lowercase)
        prompt: r.tamil,            // Tamil prompt
        question: english,          // English answer
        xpReward: xpNum,
        data: modeStr === "reorder" ? { correctOrder: words } : null,
      };
    });

    const result = await prisma.quiz.createMany({ data: rowsToInsert });

    return res.json({ ok: true, inserted: result.count });
  } catch (err) {
    console.error("[bulk] ERROR full:", err);
    return res.status(500).json({
      ok: false,
      error: "Bulk insert failed",
      debug: { name: err?.name, message: err?.message },
    });
  }
});

export default router;
