// server/routes/memory.js
import express from "express";
import { scoreSchoolFoundationFormA } from "../services/memoryAssessmentScorer.js";

const router = express.Router();

function cleanString(value, maxLength = 100) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

// POST /api/memory/score
//
// Public assessment endpoint.
// Authentication is not required for the free Study Recall Benchmark.
//
// The browser sends raw learner responses.
// Correct answers and scoring rules remain server-side.
router.post("/score", (req, res) => {
  try {
    const body = req.body || {};

    const trackId = cleanString(body.trackId);
    const form = cleanString(body.form).toUpperCase();
    const responses = body.responses;

    if (trackId !== "school_foundation" || form !== "A") {
      return res.status(400).json({
        ok: false,
        code: "UNSUPPORTED_MEMORY_ASSESSMENT",
        message: "This assessment track or form is not currently available.",
      });
    }

    if (
      !responses ||
      typeof responses !== "object" ||
      Array.isArray(responses)
    ) {
      return res.status(400).json({
        ok: false,
        code: "INVALID_MEMORY_RESPONSES",
        message: "Assessment responses are required.",
      });
    }

    const result = scoreSchoolFoundationFormA({
      immediateAnswers: responses.immediateAnswers,
      orderedAnswers: responses.orderedAnswers,
      associationAnswers: responses.associationAnswers,
      academicAnswers: responses.academicAnswers,
      delayedAnswers: responses.delayedAnswers,
    });

    return res.json({
      ok: true,
      result,
    });
  } catch (error) {
    console.error("Memory assessment scoring failed:", error);

    return res.status(500).json({
      ok: false,
      code: "MEMORY_SCORING_FAILED",
      message: "Unable to score the assessment right now.",
    });
  }
});

export default router;
