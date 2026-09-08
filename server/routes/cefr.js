import express from "express";
import authRequired from "../middleware/authMiddleware.js";
import {
  getCefrProgramOverview,
  getCefrDayDetail,
} from "../services/cefrAccessService.js";
import {
  startCefrActivityAttempt,
  completeCefrActivityAttempt,
} from "../services/cefrAttemptService.js";
import { submitCefrActivityResponse } from "../services/cefrResponseService.js";
import { getCefrLearnerProgress } from "../services/cefrProgressService.js";

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

// GET /api/cefr/programs/:programSlug/progress
router.get(
  "/programs/:programSlug/progress",
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

      const result = await getCefrLearnerProgress({
        userId: req.user.id,
        programSlug,
      });

      if (result.type === "PROGRAM_NOT_FOUND") {
        return res.status(404).json({
          ok: false,
          code: "PROGRAM_NOT_FOUND",
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
        console.error(
          "Unexpected CEFR learner progress result:",
          result?.type,
        );

        return res.status(500).json({
          ok: false,
          message: "Failed to load learner progress",
        });
      }

      return res.status(200).json({
        ok: true,
        program: result.program,
        version: result.version,
        enrollment: result.enrollment,
        cohort: result.cohort,
        totalXp: result.totalXp,
        days: result.days,
      });
    } catch (err) {
      console.error(
        "GET /api/cefr/programs/:programSlug/progress error:",
        err,
      );

      return res.status(500).json({
        ok: false,
        message: "Failed to load learner progress",
      });
    }
  },
);

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

// POST /api/cefr/programs/:programSlug/days/:dayNumber/activities/:activityId/attempts/:attemptId/complete
router.post(
  "/programs/:programSlug/days/:dayNumber/activities/:activityId/attempts/:attemptId/complete",
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
      const attemptId = String(req.params.attemptId || "").trim();

      if (!activityId || activityId.length > 191) {
        return res.status(400).json({
          ok: false,
          message: "Invalid activity id",
        });
      }

      if (!attemptId || attemptId.length > 191) {
        return res.status(400).json({
          ok: false,
          message: "Invalid attempt id",
        });
      }

      const result = await completeCefrActivityAttempt({
        userId: req.user.id,
        programSlug,
        dayNumber,
        activityId,
        attemptId,
      });

      if (result.type === "PROGRAM_NOT_FOUND") {
        return res.status(404).json({
          ok: false,
          code: "PROGRAM_NOT_FOUND",
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

      if (result.type === "ATTEMPT_NOT_FOUND") {
        return res.status(404).json({
          ok: false,
          code: "ATTEMPT_NOT_FOUND",
          message: "Attempt not found",
        });
      }

      if (result.type === "ATTEMPT_NOT_OPEN") {
        return res.status(409).json({
          ok: false,
          code: "ATTEMPT_NOT_OPEN",
          message: "Attempt is not open",
        });
      }

      if (result.type === "ACTIVITY_INCOMPLETE") {
        return res.status(409).json({
          ok: false,
          code: "ACTIVITY_INCOMPLETE",
          message: "Activity is not complete",
          completedItemIds: result.completedItemIds || [],
          missingItemIds: result.missingItemIds || [],
        });
      }

      if (result.type === "ACTIVITY_COMPLETION_CONFIG_ERROR") {
        console.error("CEFR activity completion configuration error");

        return res.status(500).json({
          ok: false,
          code: "ACTIVITY_COMPLETION_CONFIG_ERROR",
          message: "Activity completion configuration error",
        });
      }

      if (result.type === "ATTEMPT_COMPLETION_CONFLICT") {
        return res.status(409).json({
          ok: false,
          code: "ATTEMPT_COMPLETION_CONFLICT",
          message: "Attempt completion conflict",
        });
      }

      if (result.type === "XP_AWARD_FAILED") {
        console.error(
          "CEFR activity completion XP finalization failed:",
          result.xpError,
        );

        return res.status(500).json({
          ok: false,
          code: "XP_AWARD_FAILED",
          message: "Activity completed, but XP finalization failed",
          attempt: result.attempt,
        });
      }

      if (result.type !== "OK") {
        console.error(
          "Unexpected CEFR attempt completion result:",
          result?.type,
        );

        return res.status(500).json({
          ok: false,
          message: "Failed to complete activity attempt",
        });
      }

      return res.status(200).json({
        ok: true,
        alreadyCompleted: result.alreadyCompleted,
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
        "POST /api/cefr/programs/:programSlug/days/:dayNumber/activities/:activityId/attempts/:attemptId/complete error:",
        err,
      );

      return res.status(500).json({
        ok: false,
        message: "Failed to complete activity attempt",
      });
    }
  },
);

// POST /api/cefr/programs/:programSlug/days/:dayNumber/activities/:activityId/attempts/:attemptId/items/:activityItemId/responses
router.post(
  "/programs/:programSlug/days/:dayNumber/activities/:activityId/attempts/:attemptId/items/:activityItemId/responses",
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
      const attemptId = String(req.params.attemptId || "").trim();
      const activityItemId = String(req.params.activityItemId || "").trim();

      if (!activityId || activityId.length > 191) {
        return res.status(400).json({
          ok: false,
          message: "Invalid activity id",
        });
      }

      if (!attemptId || attemptId.length > 191) {
        return res.status(400).json({
          ok: false,
          message: "Invalid attempt id",
        });
      }

      if (!activityItemId || activityItemId.length > 191) {
        return res.status(400).json({
          ok: false,
          message: "Invalid activity item id",
        });
      }

      const rawIdempotencyKey = req.get("Idempotency-Key");
      const idempotencyKey =
        typeof rawIdempotencyKey === "string"
          ? rawIdempotencyKey.trim()
          : "";

      if (!idempotencyKey || idempotencyKey.length > 128) {
        return res.status(400).json({
          ok: false,
          code: "INVALID_IDEMPOTENCY_KEY",
          message: "Valid Idempotency-Key header required",
        });
      }

      const result = await submitCefrActivityResponse({
        userId: req.user.id,
        programSlug,
        dayNumber,
        activityId,
        attemptId,
        activityItemId,
        submittedAnswer: req.body?.submittedAnswer,
        hintUsed: req.body?.hintUsed ?? false,
        answerRevealed: req.body?.answerRevealed ?? false,
        responseTimeMs: req.body?.responseTimeMs ?? null,
        idempotencyKey,
      });

      if (result.type === "PROGRAM_NOT_FOUND") {
        return res.status(404).json({
          ok: false,
          code: "PROGRAM_NOT_FOUND",
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

      if (result.type === "ACTIVITY_ITEM_NOT_FOUND") {
        return res.status(404).json({
          ok: false,
          code: "ACTIVITY_ITEM_NOT_FOUND",
          message: "Activity item not found",
        });
      }

      if (result.type === "ATTEMPT_NOT_FOUND") {
        return res.status(404).json({
          ok: false,
          code: "ATTEMPT_NOT_FOUND",
          message: "Attempt not found",
        });
      }

      if (result.type === "ATTEMPT_NOT_OPEN") {
        return res.status(409).json({
          ok: false,
          code: "ATTEMPT_NOT_OPEN",
          message: "Attempt is not open",
        });
      }

      if (
        result.type === "INVALID_IDEMPOTENCY_KEY" ||
        result.type === "INVALID_SUBMISSION"
      ) {
        return res.status(400).json({
          ok: false,
          code: result.type,
          message:
            result.type === "INVALID_IDEMPOTENCY_KEY"
              ? "Valid Idempotency-Key header required"
              : "Invalid submission",
        });
      }

      if (result.type === "IDEMPOTENCY_CONFLICT") {
        return res.status(409).json({
          ok: false,
          code: "IDEMPOTENCY_CONFLICT",
          message: "Idempotency key was already used with different evidence",
        });
      }

      if (result.type === "EVALUATOR_CONFIG_ERROR") {
        console.error("CEFR evaluator configuration error");

        return res.status(500).json({
          ok: false,
          code: "EVALUATOR_CONFIG_ERROR",
          message: "Unable to evaluate submission",
        });
      }

      if (result.type === "XP_AWARD_FAILED") {
        console.error("CEFR XP finalization failed:", result.xpError);

        return res.status(500).json({
          ok: false,
          code: "XP_AWARD_FAILED",
          message: "Response saved but XP could not be finalized",
        });
      }

      if (result.type !== "OK") {
        console.error("Unexpected CEFR Response result:", result?.type);

        return res.status(500).json({
          ok: false,
          message: "Failed to submit response",
        });
      }

      return res.status(result.idempotentReplay ? 200 : 201).json({
        ok: true,
        idempotentReplay: result.idempotentReplay,
        program: result.program,
        version: result.version,
        enrollment: result.enrollment,
        cohort: result.cohort,
        day: result.day,
        activity: result.activity,
        attempt: result.attempt,
        response: result.response,
        xp: result.xp,
      });
    } catch (err) {
      console.error(
        "POST /api/cefr/programs/:programSlug/days/:dayNumber/activities/:activityId/attempts/:attemptId/items/:activityItemId/responses error:",
        err,
      );

      return res.status(500).json({
        ok: false,
        message: "Failed to submit response",
      });
    }
  },
);

export default router;
