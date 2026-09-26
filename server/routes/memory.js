// server/routes/memory.js
import express from "express";
import prisma from "../db/client.js";
import { normalizeWhatsAppNumber } from "../lib/whatsappNumber.js";
import {
  scoreSchoolAdvancedFormA,
  scoreSchoolFoundationFormA,
} from "../services/memoryAssessmentScorer.js";

const router = express.Router();

function cleanString(value, maxLength = 100) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function optionalString(value, maxLength = 200) {
  const cleaned = cleanString(value, maxLength);
  return cleaned || null;
}

function isReasonableEmail(value) {
  if (!value) return true;

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function cleanAnswerArray(value, maxItems, maxLength = 100) {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, maxItems)
    .map((item) => cleanString(item, maxLength))
    .filter(Boolean);
}

function cleanAnswerObject(value, allowedKeys, maxLength = 500) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const cleaned = {};

  for (const key of allowedKeys) {
    const answer = cleanString(value[key], maxLength);
    if (answer) cleaned[key] = answer;
  }

  return cleaned;
}

function sanitizeSchoolFoundationFormAResponses(responses) {
  const source =
    responses && typeof responses === "object" && !Array.isArray(responses)
      ? responses
      : {};

  return {
    immediateAnswers: cleanAnswerArray(
      source.immediateAnswers,
      10,
      100,
    ),

    orderedAnswers: cleanAnswerArray(
      source.orderedAnswers,
      6,
      50,
    ),

    associationAnswers: cleanAnswerObject(
      source.associationAnswers,
      ["rocket", "umbrella", "guitar", "apple", "boat"],
      20,
    ),

    academicAnswers: cleanAnswerObject(
      source.academicAnswers,
      [
        "habitat",
        "grass",
        "eggs",
        "leave_month",
        "parent_duration",
      ],
      500,
    ),

    delayedAnswers: cleanAnswerArray(
      source.delayedAnswers,
      10,
      100,
    ),
  };
}


function sanitizeSchoolAdvancedFormAResponses(responses) {
  const source =
    responses && typeof responses === "object" && !Array.isArray(responses)
      ? responses
      : {};

  return {
    immediateAnswers: cleanAnswerArray(
      source.immediateAnswers,
      12,
      100,
    ),

    orderedAnswers: cleanAnswerArray(
      source.orderedAnswers,
      8,
      50,
    ),

    associationAnswers: cleanAnswerObject(
      source.associationAnswers,
      [
        "bridge",
        "planet",
        "feather",
        "orchid",
        "basket",
        "castle",
      ],
      20,
    ),

    academicAnswers: cleanAnswerObject(
      source.academicAnswers,
      [
        "location",
        "reed",
        "bird_species",
        "arrival_months",
        "reeds_planted",
        "water_depth_frequency",
      ],
      500,
    ),

    delayedAnswers: cleanAnswerArray(
      source.delayedAnswers,
      12,
      100,
    ),
  };
}

function getAssessmentDefinition(trackId, form) {
  if (form !== "A") return null;

  if (trackId === "school_foundation") {
    return {
      trackId: "school_foundation",
      form: "A",
      sanitizeResponses: sanitizeSchoolFoundationFormAResponses,
      score: scoreSchoolFoundationFormA,
    };
  }

  if (trackId === "school_advanced") {
    return {
      trackId: "school_advanced",
      form: "A",
      sanitizeResponses: sanitizeSchoolAdvancedFormAResponses,
      score: scoreSchoolAdvancedFormA,
    };
  }

  return null;
}


const LEAD_TRACK_RULES = {
  school_foundation: {
    allowedStudentClasses: ["6", "7", "8"],
    invalidClassMessage:
      "Class must be 6, 7, or 8 for this assessment.",
  },

  school_advanced: {
    allowedStudentClasses: ["9", "10", "11", "12"],
    invalidClassMessage:
      "Class must be 9, 10, 11, or 12 for this assessment.",
  },
};

function getLeadTrackRule(trackId) {
  return LEAD_TRACK_RULES[trackId] || null;
}

function sanitizeAttribution(value) {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};

  return {
    utmSource: optionalString(
      source.utmSource ?? source.utm_source,
      150,
    ),
    utmMedium: optionalString(
      source.utmMedium ?? source.utm_medium,
      150,
    ),
    utmCampaign: optionalString(
      source.utmCampaign ?? source.utm_campaign,
      200,
    ),
    utmContent: optionalString(
      source.utmContent ?? source.utm_content,
      200,
    ),
    utmTerm: optionalString(
      source.utmTerm ?? source.utm_term,
      200,
    ),
    source: optionalString(source.source, 150),
    campaign: optionalString(source.campaign, 200),
    adset: optionalString(source.adset, 200),
    ad: optionalString(source.ad, 200),
  };
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

    const assessment = getAssessmentDefinition(trackId, form);

    if (!assessment) {
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

    const result = assessment.score({
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

// POST /api/memory/session
//
// Persist an anonymous Form A baseline.
//
// Important:
// - Browser-supplied scores are ignored.
// - The authoritative scorer runs again on the server.
// - Only sanitized assessment responses are persisted.
router.post("/session", async (req, res) => {
  try {
    const body = req.body || {};

    const trackId = cleanString(body.trackId);
    const form = cleanString(body.form).toUpperCase();
    const responses = body.responses;

    const assessment = getAssessmentDefinition(trackId, form);

    if (!assessment) {
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

    const storedResponses =
      assessment.sanitizeResponses(responses);

    const result = assessment.score({
      immediateAnswers: storedResponses.immediateAnswers,
      orderedAnswers: storedResponses.orderedAnswers,
      associationAnswers: storedResponses.associationAnswers,
      academicAnswers: storedResponses.academicAnswers,
      delayedAnswers: storedResponses.delayedAnswers,
    });

    const created = await prisma.memoryAssessmentSession.create({
      data: {
        trackId: result.trackId,
        status: "FORM_A_COMPLETED",

        formAAnswers: storedResponses,
        formAResult: result,
        formAScore: result.totalScore,
        formARetentionRatio: result.retentionRatio,

        ...sanitizeAttribution(body.attribution),
      },

      select: {
        publicToken: true,
        ownerToken: true,
      },
    });

    return res.status(201).json({
      ok: true,
      session: {
        publicToken: created.publicToken,
        ownerToken: created.ownerToken,
        result,
      },
    });
  } catch (error) {
    console.error("Memory assessment session creation failed:", error);

    return res.status(500).json({
      ok: false,
      code: "MEMORY_SESSION_CREATE_FAILED",
      message: "Unable to save the assessment right now.",
    });
  }
});

// PATCH /api/memory/session/lead
//
// Attach parent/guardian contact details to an existing anonymous
// assessment session.
//
// Security:
// - publicToken is NOT accepted as an update credential.
// - Only the private ownerToken can mutate a session.
// - The ownerToken is never returned by this endpoint.
router.patch("/session/lead", async (req, res) => {
  try {
    const body = req.body || {};

    const ownerToken = cleanString(body.ownerToken, 100);
    const learnerName = cleanString(body.learnerName, 100);
    const studentClass = cleanString(body.studentClass, 30);
    const parentGuardianName = cleanString(
      body.parentGuardianName,
      100,
    );
    const whatsappNumber = cleanString(
      body.whatsappNumber,
      30,
    );
    const state = cleanString(body.state, 100);
    const email = optionalString(body.email, 191);

    if (!ownerToken) {
      return res.status(400).json({
        ok: false,
        code: "MEMORY_OWNER_TOKEN_REQUIRED",
        message: "Assessment ownership token is required.",
      });
    }

    if (
      !learnerName ||
      !studentClass ||
      !parentGuardianName ||
      !whatsappNumber ||
      !state
    ) {
      return res.status(400).json({
        ok: false,
        code: "MEMORY_LEAD_FIELDS_REQUIRED",
        message:
          "Student name, class, parent or guardian name, WhatsApp number, and state are required.",
      });
    }

    const whatsappNumberNormalized =
      normalizeWhatsAppNumber(whatsappNumber);

    if (!whatsappNumberNormalized) {
      return res.status(400).json({
        ok: false,
        code: "INVALID_WHATSAPP_NUMBER",
        message: "Please enter a valid WhatsApp number.",
      });
    }

    if (!isReasonableEmail(email)) {
      return res.status(400).json({
        ok: false,
        code: "INVALID_EMAIL",
        message: "Please enter a valid email address.",
      });
    }

    if (body.whatsappConsent !== true) {
      return res.status(400).json({
        ok: false,
        code: "WHATSAPP_CONSENT_REQUIRED",
        message:
          "WhatsApp consent is required to send the assessment report.",
      });
    }

    // Do not trust a browser-supplied track.
    // Resolve the assessment track from the private owner token.
    const session =
      await prisma.memoryAssessmentSession.findUnique({
        where: {
          ownerToken,
        },

        select: {
          trackId: true,
        },
      });

    if (!session) {
      return res.status(404).json({
        ok: false,
        code: "MEMORY_SESSION_NOT_FOUND",
        message: "Assessment session was not found.",
      });
    }

    const leadTrackRule = getLeadTrackRule(session.trackId);

    if (!leadTrackRule) {
      return res.status(400).json({
        ok: false,
        code: "UNSUPPORTED_MEMORY_ASSESSMENT",
        message:
          "This assessment track is not currently available for lead capture.",
      });
    }

    if (
      !leadTrackRule.allowedStudentClasses.includes(studentClass)
    ) {
      return res.status(400).json({
        ok: false,
        code: "INVALID_STUDENT_CLASS",
        message: leadTrackRule.invalidClassMessage,
      });
    }

    const capturedAt = new Date();

    const updated =
      await prisma.memoryAssessmentSession.updateMany({
        where: {
          ownerToken,
          trackId: session.trackId,
        },

        data: {
          learnerName,
          studentClass,
          parentGuardianName,

          whatsappNumber,
          whatsappNumberNormalized,
          whatsappContactRole: "PARENT_GUARDIAN",

          whatsappConsent: true,
          whatsappConsentAt: capturedAt,
          whatsappConsentSource:
            "memory-challenge-result-lead-form",

          email,
          state,
          leadCapturedAt: capturedAt,

          status: "LEAD_CAPTURED",
        },
      });

    if (updated.count !== 1) {
      return res.status(404).json({
        ok: false,
        code: "MEMORY_SESSION_NOT_FOUND",
        message: "Assessment session was not found.",
      });
    }

    return res.json({
      ok: true,
      lead: {
        saved: true,
      },
    });
  } catch (error) {
    console.error("Memory lead capture failed:", error);

    return res.status(500).json({
      ok: false,
      code: "MEMORY_LEAD_CAPTURE_FAILED",
      message: "Unable to save the assessment details right now.",
    });
  }
});

export default router;
