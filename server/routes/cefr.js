import express from "express";
import authRequired from "../middleware/authMiddleware.js";
import { getCefrProgramOverview } from "../services/cefrAccessService.js";

const router = express.Router();

function normalizeProgramSlug(value) {
  const slug = String(value || "")
    .trim()
    .toLowerCase();

  if (!slug || slug.length > 120) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;

  return slug;
}

// GET /api/cefr/programs/:programSlug
router.get("/programs/:programSlug", authRequired, async (req, res) => {
  try {
    const programSlug = normalizeProgramSlug(req.params.programSlug);

    if (!programSlug) {
      return res.status(400).json({
        ok: false,
        message: "Invalid program slug",
      });
    }

    const result = await getCefrProgramOverview({
      userId: req.user.id,
      programSlug,
    });

    if (result.type === "PROGRAM_NOT_FOUND") {
      return res.status(404).json({
        ok: false,
        message: "Program not found",
      });
    }

    if (result.type === "ENROLLMENT_REQUIRED") {
      return res.status(403).json({
        ok: false,
        code: "ENROLLMENT_REQUIRED",
        message: "Enrollment required",
        program: result.program,
      });
    }

    if (result.type === "COHORT_CONFLICT") {
      return res.status(409).json({
        ok: false,
        code: "COHORT_CONFLICT",
        message: "Multiple active cohort memberships found",
      });
    }

    if (result.type === "COHORT_VERSION_MISMATCH") {
      return res.status(409).json({
        ok: false,
        code: "COHORT_VERSION_MISMATCH",
        message: "Cohort and enrollment curriculum versions do not match",
      });
    }

    if (result.type !== "OK") {
      console.error("Unexpected CEFR overview result:", result?.type);
      return res.status(500).json({
        ok: false,
        message: "Failed to load program",
      });
    }

    return res.json({
      ok: true,
      program: result.program,
      version: result.version,
      enrollment: result.enrollment,
      cohort: result.cohort,
      days: result.days,
    });
  } catch (err) {
    console.error("GET /api/cefr/programs/:programSlug error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to load program",
    });
  }
});

export default router;
