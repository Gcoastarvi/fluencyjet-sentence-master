import {
  validateMemoryRetestSession,
} from "./memoryRetestSession.js";

import {
  scoreSchoolFoundationFormB,
} from "./memoryFormBScorer.js";

import {
  scoreSchoolAdvancedFormB,
} from "./memorySchoolAdvancedFormBScorer.js";

import {
  scoreAdvancedFormB,
} from "./memoryAdvancedFormBScorer.js";

const TRACKS = {
  school_foundation: {
    score: scoreSchoolFoundationFormB,
    immediateCount: 10,
    orderedCount: 6,
    associationKeys: [
      "drum",
      "butterfly",
      "coconut",
      "ship",
      "glove",
    ],
    academicKeys: [
      "habitat",
      "insects",
      "flowers",
      "rain_month",
      "root_duration",
    ],
  },

  school_advanced: {
    score: scoreSchoolAdvancedFormB,
    immediateCount: 12,
    orderedCount: 8,
    associationKeys: [
      "camera",
      "coconut",
      "ladder",
      "drum",
      "rocket",
      "peacock",
    ],
    academicKeys: [
      "zones",
      "restricted_zone",
      "inspection_frequency",
      "watch_months",
      "smoke_reporting",
      "scientific_review",
    ],
  },

  advanced: {
    score: scoreAdvancedFormB,
    immediateCount: 14,
    orderedCount: 10,
    associationKeys: [
      "peacock",
      "factory",
      "puzzle",
      "market",
      "kitchen",
      "bakery",
      "jungle",
    ],
    academicKeys: [
      "apartments",
      "daily_water",
      "leak_reduction",
      "sections",
      "sensor_frequency",
      "inspection_day",
      "district",
    ],
  },
};

const ALLOWED_BASELINE_STATUSES = [
  "FORM_A_COMPLETED",
  "LEAD_CAPTURED",
];

function failure(code) {
  return { saved: false, code };
}

function cleanString(value, maxLength) {
  if (
    value !== null &&
    value !== undefined &&
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return "";
  }

  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function cleanArray(value, maxItems, preservePositions = false) {
  if (!Array.isArray(value)) return [];

  const values = value
    .slice(0, maxItems)
    .map((item) => cleanString(item, 100));

  return preservePositions
    ? values
    : values.filter(Boolean);
}

function cleanObject(value, allowedKeys, maxLength) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  const cleaned = {};

  for (const key of allowedKeys) {
    const answer = cleanString(value[key], maxLength);

    if (answer) {
      cleaned[key] = answer;
    }
  }

  return cleaned;
}

function sanitizeResponses(responses, track) {
  return {
    immediateAnswers: cleanArray(
      responses.immediateAnswers,
      track.immediateCount,
    ),

    orderedAnswers: cleanArray(
      responses.orderedAnswers,
      track.orderedCount,
      true,
    ),

    associationAnswers: cleanObject(
      responses.associationAnswers,
      track.associationKeys,
      20,
    ),

    academicAnswers: cleanObject(
      responses.academicAnswers,
      track.academicKeys,
      500,
    ),

    delayedAnswers: cleanArray(
      responses.delayedAnswers,
      track.immediateCount,
    ),
  };
}

/*
 * Authenticated, authoritative Form B submission.
 *
 * Caller must obtain sessionToken from the protected
 * HttpOnly cookie, never from browser-supplied JSON.
 */
export async function submitMemoryFormB(
  {
    sessionToken,
    responses,
  } = {},
  {
    prisma,
    sessionValidator = validateMemoryRetestSession,
    now = () => new Date(),
  } = {},
) {
  if (typeof prisma?.$transaction !== "function") {
    throw new TypeError(
      "Prisma transaction support required",
    );
  }

  if (typeof sessionValidator !== "function") {
    throw new TypeError(
      "Retest session validator required",
    );
  }

  if (
    typeof sessionToken !== "string" ||
    !/^[a-f0-9]{64}$/.test(sessionToken)
  ) {
    return failure("INVALID_RETEST_SESSION");
  }

  if (
    !responses ||
    typeof responses !== "object" ||
    Array.isArray(responses)
  ) {
    return failure("INVALID_FORM_B_RESPONSES");
  }

  const completedAt = now();

  if (
    !(completedAt instanceof Date) ||
    !Number.isFinite(completedAt.getTime())
  ) {
    throw new RangeError("Invalid submission time");
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const session = await sessionValidator(
          { sessionToken },
          { prisma: tx },
        );

        if (!session?.valid) {
          return failure("INVALID_RETEST_SESSION");
        }

        const track = TRACKS[session.trackId];

        if (!track || !session.assessmentSessionId) {
          return failure("INVALID_RETEST_SESSION");
        }

        const baseline =
          await tx.memoryAssessmentSession.findUnique({
            where: {
              id: session.assessmentSessionId,
            },
            select: {
              id: true,
              trackId: true,
              status: true,
              formAScore: true,
              formBCompletedAt: true,
            },
          });

        if (
          !baseline ||
          baseline.trackId !== session.trackId
        ) {
          return failure("BASELINE_UNAVAILABLE");
        }

        if (baseline.formBCompletedAt !== null) {
          return failure("FORM_B_ALREADY_COMPLETED");
        }

        if (
          !ALLOWED_BASELINE_STATUSES.includes(
            baseline.status,
          )
        ) {
          return failure("BASELINE_UNAVAILABLE");
        }

        const formAScore = Number(
          baseline.formAScore,
        );

        if (
          !Number.isFinite(formAScore) ||
          formAScore < 0 ||
          formAScore > 100
        ) {
          return failure("BASELINE_UNAVAILABLE");
        }

        const storedResponses =
          sanitizeResponses(responses, track);

        const result = track.score(storedResponses);

        if (
          result.form !== "B" ||
          result.trackId !== session.trackId ||
          !Number.isFinite(result.totalScore) ||
          result.totalScore < 0 ||
          result.totalScore > 100
        ) {
          throw new Error(
            "Invalid authoritative Form B scorer result",
          );
        }

        /*
         * Atomic one-time completion gate.
         * Form A fields are never modified.
         */
        const updated =
          await tx.memoryAssessmentSession.updateMany({
            where: {
              id: baseline.id,
              trackId: session.trackId,
              status: {
                in: ALLOWED_BASELINE_STATUSES,
              },
              formBCompletedAt: null,
            },
            data: {
              formBAnswers: storedResponses,
              formBResult: result,
              formBScore: result.totalScore,
              formBRetentionRatio:
                result.retentionRatio,
              formBCompletedAt: completedAt,
            },
          });

        if (updated.count !== 1) {
          return failure("FORM_B_ALREADY_COMPLETED");
        }

        const improvementPoints = Math.round(
          (result.totalScore - formAScore) * 100,
        ) / 100;

        return {
          saved: true,
          trackId: session.trackId,
          formAScore,
          formBScore: result.totalScore,
          improvementPoints,
          formBCompletedAt:
            completedAt.toISOString(),
        };
      },
      {
        isolationLevel: "Serializable",
      },
    );
  } catch (error) {
    if (error?.code === "P2034") {
      return failure("SUBMISSION_CONFLICT_RETRY");
    }

    throw error;
  }
}
