import {
  submitMemoryFormB,
} from "../services/memoryFormBSubmission.js";

import express from "express";
import rateLimit from "express-rate-limit";
import prisma from "../db/client.js";
import {
  redeemMemoryRetestLink,
} from "../services/memoryRetestRedeem.js";
import {
  validateMemoryRetestSession,
} from "../services/memoryRetestSession.js";

const router = express.Router();

const COOKIE_NAME = "fj_memory_retest_session";
const COOKIE_PATH = "/api/memory-retest";

const PRODUCTION_ORIGINS = new Set([
  "https://www.fluencyjet.com",
  "https://fluencyjet.com",
]);

function isTrustedOrigin(origin) {
  if (typeof origin !== "string" || !origin) {
    return false;
  }

  if (PRODUCTION_ORIGINS.has(origin)) {
    return true;
  }

  if (process.env.NODE_ENV === "production") {
    return false;
  }

  if (
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d{2,5})?$/.test(
      origin,
    )
  ) {
    return true;
  }

  const preview = process.env.REPLIT_DEV_DOMAIN;

  return Boolean(
    preview && origin === `https://${preview}`,
  );
}

function requireTrustedOrigin(req, res, next) {
  if (!isTrustedOrigin(req.get("origin"))) {
    return res.status(403).json({
      ok: false,
      code: "RETEST_ORIGIN_NOT_ALLOWED",
    });
  }

  next();
}

function cookieOptions(req, maxAge) {
  return {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production" || req.secure,
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge,
  };
}

router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.set("Referrer-Policy", "no-referrer");
  next();
});

const redeemLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    ok: false,
    code: "RETEST_RATE_LIMITED",
  },
});

/*
 * POST /api/memory-retest/redeem
 *
 * Accepts a one-time link token.
 * Returns an HttpOnly browser session cookie.
 * Never returns the session token in JSON.
 */
router.post(
  "/redeem",
  redeemLimiter,
  requireTrustedOrigin,
  async (req, res) => {
    try {
      const linkToken = req.body?.linkToken;

      if (
        typeof linkToken !== "string" ||
        !/^[a-f0-9]{64}$/.test(linkToken)
      ) {
        return res.status(400).json({
          ok: false,
          code: "INVALID_RETEST_LINK",
        });
      }

      const result = await redeemMemoryRetestLink(
        { linkToken },
        { prisma },
      );

      if (!result.redeemed) {
        return res.status(401).json({
          ok: false,
          code: "INVALID_OR_USED_RETEST_LINK",
        });
      }

      const expiresAt = new Date(
        result.sessionExpiresAt,
      );

      const maxAge =
        expiresAt.getTime() - Date.now();

      if (
        !Number.isFinite(maxAge) ||
        maxAge <= 0
      ) {
        return res.status(503).json({
          ok: false,
          code: "RETEST_SESSION_UNAVAILABLE",
        });
      }

      res.cookie(
        COOKIE_NAME,
        result.sessionToken,
        cookieOptions(req, maxAge),
      );

      return res.json({
        ok: true,
        trackId: result.trackId,
        sessionExpiresAt: expiresAt.toISOString(),
      });
    } catch (error) {
      console.error(
        "Memory retest redemption failed:",
        error?.code || error?.name || "UNKNOWN_ERROR",
      );

      return res.status(500).json({
        ok: false,
        code: "RETEST_REDEMPTION_FAILED",
      });
    }
  },
);

/*
 * GET /api/memory-retest/session
 *
 * Uses only the protected cookie.
 * Never accepts a session token from a URL.
 */
router.get("/session", async (req, res) => {
  try {
    const sessionToken = req.cookies?.[COOKIE_NAME];

    const result = await validateMemoryRetestSession(
      { sessionToken },
      { prisma },
    );

    if (!result.valid) {
      return res.status(401).json({
        ok: false,
        code: "INVALID_RETEST_SESSION",
      });
    }

    return res.json({
      ok: true,
      trackId: result.trackId,
    });
  } catch (error) {
    console.error(
      "Memory retest session validation failed:",
      error?.code || error?.name || "UNKNOWN_ERROR",
    );

    return res.status(500).json({
      ok: false,
      code: "RETEST_SESSION_CHECK_FAILED",
    });
  }
});


/*
 * POST /api/memory-retest/submit
 *
 * Authenticated one-time Form B submission.
 * The session comes exclusively from the HttpOnly cookie.
 * Scores and assessment track are determined by the server.
 */
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    ok: false,
    code: "RETEST_RATE_LIMITED",
  },
});

router.post(
  "/submit",
  requireTrustedOrigin,
  submitLimiter,
  async (req, res) => {
    try {
      const sessionToken =
        req.cookies?.[COOKIE_NAME];

      const result = await submitMemoryFormB(
        {
          sessionToken,
          responses: req.body?.responses,
        },
        { prisma },
      );

      if (!result?.saved) {
        const code =
          result?.code || "FORM_B_SUBMISSION_FAILED";

        const statusByCode = {
          INVALID_RETEST_SESSION: 401,
          INVALID_FORM_B_RESPONSES: 400,
          BASELINE_UNAVAILABLE: 409,
          FORM_B_ALREADY_COMPLETED: 409,
          SUBMISSION_CONFLICT_RETRY: 503,
        };

        return res.status(
          statusByCode[code] || 500,
        ).json({
          ok: false,
          code,
        });
      }

      return res.status(201).json({
        ok: true,
        trackId: result.trackId,
        formAScore: result.formAScore,
        formBScore: result.formBScore,
        improvementPoints:
          result.improvementPoints,
        formBCompletedAt:
          result.formBCompletedAt,
      });
    } catch (error) {
      console.error(
        "Form B submission failed:",
        error?.code || error?.name || "UNKNOWN_ERROR",
      );

      return res.status(500).json({
        ok: false,
        code: "FORM_B_SUBMISSION_FAILED",
      });
    }
  },
);


/*
 * GET /api/memory-retest/result
 *
 * Uses only the validated HttpOnly-cookie session.
 * No browser-provided assessment ID, track or score.
 */
router.get("/result", async (req, res) => {
  try {
    const sessionToken = req.cookies?.[COOKIE_NAME];

    const verification = await validateMemoryRetestSession(
      { sessionToken },
      { prisma },
    );

    /*
     * Accept either:
     * - A verified assessment-linked session, or
     * - A verified purchase-linked session with explicit
     *   null Form A baseline.
     *
     * Undefined and malformed baseline identifiers
     * are never treated as optional baselines.
     */
    const hasAssessment =
      typeof verification?.assessmentSessionId === "string" &&
      verification.assessmentSessionId.trim().length > 0;

    const hasPurchaseOnly =
      verification?.assessmentSessionId === null &&
      typeof verification?.purchaseId === "string" &&
      verification.purchaseId.trim().length > 0;

    if (
      !verification?.valid ||
      ![
        "school_foundation",
        "school_advanced",
        "advanced",
      ].includes(verification.trackId) ||
      !(hasAssessment || hasPurchaseOnly)
    ) {
      return res.status(401).json({
        ok: false,
        code: "INVALID_RETEST_SESSION",
      });
    }

    /*
     * Form B-only result:
     * Locate it strictly through the purchase ID
     * supplied by the validated HttpOnly-cookie session.
     */
    if (hasPurchaseOnly) {
      const saved =
        await prisma.memoryFormBOnlyResult.findUnique({
          where: {
            purchaseId: verification.purchaseId,
          },
          select: {
            trackId: true,
            formBScore: true,
            formBCompletedAt: true,
          },
        });

      if (!saved) {
        return res.status(404).json({
          ok: false,
          code: "FORM_B_RESULT_NOT_READY",
        });
      }

      if (saved.trackId !== verification.trackId) {
        return res.status(404).json({
          ok: false,
          code: "RETEST_RESULT_UNAVAILABLE",
        });
      }

      if (
        saved.formBScore == null ||
        !saved.formBCompletedAt
      ) {
        return res.status(404).json({
          ok: false,
          code: "FORM_B_RESULT_NOT_READY",
        });
      }

      const formBScore = Number(saved.formBScore);
      const completedAt =
        new Date(saved.formBCompletedAt);

      if (
        !Number.isFinite(formBScore) ||
        formBScore < 0 ||
        formBScore > 100 ||
        !Number.isFinite(completedAt.getTime())
      ) {
        return res.status(500).json({
          ok: false,
          code: "RETEST_RESULT_UNAVAILABLE",
        });
      }

      return res.json({
        ok: true,
        trackId: verification.trackId,
        formAScore: null,
        formBScore,
        improvementPoints: null,
        formBCompletedAt: completedAt.toISOString(),
      });
    }

    /*
     * Original assessment-linked result.
     * Preserve its existing Before/After logic.
     */
    const assessment =
      await prisma.memoryAssessmentSession.findUnique({
        where: {
          id: verification.assessmentSessionId,
        },
        select: {
          trackId: true,
          formAScore: true,
          formBScore: true,
          formBCompletedAt: true,
        },
      });

    if (
      !assessment ||
      assessment.trackId !== verification.trackId
    ) {
      return res.status(404).json({
        ok: false,
        code: "RETEST_RESULT_UNAVAILABLE",
      });
    }

    if (
      !assessment.formBCompletedAt ||
      assessment.formAScore == null ||
      assessment.formBScore == null
    ) {
      return res.status(404).json({
        ok: false,
        code: "FORM_B_RESULT_NOT_READY",
      });
    }

    const formAScore = Number(assessment.formAScore);
    const formBScore = Number(assessment.formBScore);
    const completedAt = new Date(assessment.formBCompletedAt);

    if (
      !Number.isFinite(formAScore) ||
      !Number.isFinite(formBScore) ||
      formAScore < 0 ||
      formAScore > 100 ||
      formBScore < 0 ||
      formBScore > 100 ||
      !Number.isFinite(completedAt.getTime())
    ) {
      return res.status(500).json({
        ok: false,
        code: "RETEST_RESULT_UNAVAILABLE",
      });
    }

    const improvementPoints =
      Math.round((formBScore - formAScore) * 100) / 100;

    return res.json({
      ok: true,
      trackId: verification.trackId,
      formAScore,
      formBScore,
      improvementPoints,
      formBCompletedAt: completedAt.toISOString(),
    });
  } catch (error) {
    console.error(
      "Memory retest result retrieval failed:",
      error?.code || error?.name || "UNKNOWN_ERROR",
    );

    return res.status(500).json({
      ok: false,
      code: "RETEST_RESULT_UNAVAILABLE",
    });
  }
});

export default router;
