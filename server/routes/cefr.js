import express from "express";
import authRequired from "../middleware/authMiddleware.js";
import {
  getCefrProgramOverview,
  getCefrDayDetail,
} from "../services/cefrAccessService.js";
import { startCefrActivityAttempt } from "../services/cefrAttemptService.js";

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


function normalizeDayNumber(value) {
  const raw = String(value || "").trim();

  if (!/^[1-9]\d*$/.test(raw)) return null;

  const dayNumber = Number(raw);

  if (!Number.isSafeInteger(dayNumber) || dayNumber > 2147483647) {
    return null;
  }

  return dayNumber;
}

// GET /api/cefr/programs/:programSlug/days/:dayNumber
router.get(
  "/programs/:programSlug/days/:dayNumber",
  authRequired,
  async (req, res) => {
    try {
      const programSlug = normalizeProgramSlug(req.params.programSlug);

      if (!programSlug) {
        return res.status(400).json({
          ok: false,
          message: "Invalid program slug",
        });
      }

      const dayNumber = normalizeDayNumber(req.params.dayNumber);

      if (!dayNumber) {
        return res.status(400).json({
          ok: false,
          message: "Invalid day number",
        });
      }

      const result = await getCefrDayDetail({
        userId: req.user.id,
        programSlug,
        dayNumber,
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

      if (result.type === "DAY_NOT_FOUND") {
        return res.status(404).json({
          ok: false,
          code: "DAY_NOT_FOUND",
          message: "Day not found",
        });
      }

      if (result.type === "DAY_LOCKED") {
        return res.status(403).json({
          ok: false,
          code: "DAY_LOCKED",
          message: "Day is locked",
          day: result.day,
        });
      }

      if (result.type !== "OK") {
        console.error("Unexpected CEFR day detail result:", result?.type);
        return res.status(500).json({
          ok: false,
          message: "Failed to load day",
        });
      }

      return res.json({
        ok: true,
        program: result.program,
        version: result.version,
        enrollment: result.enrollment,
        cohort: result.cohort,
        day: result.day,
      });
    } catch (err) {
      console.error(
        "GET /api/cefr/programs/:programSlug/days/:dayNumber error:",
        err,
      );

      return res.status(500).json({
        ok: false,
        message: "Failed to load day",
      });
    }
  },
);


// POST /api/cefr/programs/:programSlug/days/:dayNumber/activities/:activityId/attempts
router.post(
  "/programs/:programSlug/days/:dayNumber/activities/:activityId/attempts",
  authRequired,
  async (req, res) => {
    try {
      const programSlug = normalizeProgramSlug(req.params.programSlug);

      if (!programSlug) {
        return res.status(400).json({
          ok: false,
          message: "Invalid program slug",
        });
      }

      const dayNumber = normalizeDayNumber(req.params.dayNumber);

      if (!dayNumber) {
        return res.status(400).json({
          ok: false,
          message: "Invalid day number",
        });
      }

      const activityId = String(req.params.activityId || "").trim();

      if (!activityId || activityId.length > 191) {
        return res.status(400).json({
          ok: false,
          message: "Invalid activity id",
        });
      }

      const result = await startCefrActivityAttempt({
        userId: req.user.id,
        programSlug,
        dayNumber,
        activityId,
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

      if (result.type === "DAY_NOT_FOUND") {
        return res.status(404).json({
          ok: false,
          code: "DAY_NOT_FOUND",
          message: "Day not found",
        });
      }

      if (result.type === "DAY_LOCKED") {
        return res.status(403).json({
          ok: false,
          code: "DAY_LOCKED",
          message: "Day is locked",
          day: result.day,
        });
      }

      if (result.type === "ACTIVITY_NOT_FOUND") {
        return res.status(404).json({
          ok: false,
          code: "ACTIVITY_NOT_FOUND",
          message: "Activity not found",
        });
      }

      if (result.type === "ATTEMPT_CONFLICT") {
        return res.status(409).json({
          ok: false,
          code: "ATTEMPT_CONFLICT",
          message: "Multiple open activity attempts found",
        });
      }

      if (result.type !== "OK") {
        console.error("Unexpected CEFR attempt result:", result?.type);

        return res.status(500).json({
          ok: false,
          message: "Failed to start activity attempt",
        });
      }

      return res.status(result.resumed ? 200 : 201).json({
        ok: true,
        resumed: result.resumed,
        program: result.program,
        version: result.version,
        enrollment: result.enrollment,
        cohort: result.cohort,
        day: result.day,
        activity: result.activity,
        attempt: result.attempt,
      });
    } catch (err) {
      console.error(
        "POST /api/cefr/programs/:programSlug/days/:dayNumber/activities/:activityId/attempts error:",
        err,
      );

      return res.status(500).json({
        ok: false,
        message: "Failed to start activity attempt",
      });
    }
  },
);

export default router;
