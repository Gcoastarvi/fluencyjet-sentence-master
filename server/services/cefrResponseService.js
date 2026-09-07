import { isDeepStrictEqual } from "node:util";

import prisma from "../db/client.js";
import { getCefrDayDetail } from "./cefrAccessService.js";
import { evaluateCefrSubmission } from "./cefrEvaluator.js";

const ATTEMPT_SELECT = {
  id: true,
  attemptNumber: true,
  status: true,
  completedAt: true,
};

const RESPONSE_SELECT = {
  id: true,
  attemptId: true,
  activityItemId: true,
  responseNumber: true,
  submittedAnswer: true,
  isCorrect: true,
  evaluationCode: true,
  score: true,
  hintUsed: true,
  answerRevealed: true,
  responseTimeMs: true,
  submittedAt: true,
};

const IDEMPOTENCY_RESPONSE_SELECT = {
  ...RESPONSE_SELECT,
  idempotencyKey: true,
};

function normalizeIdempotencyKey(value) {
  if (value === null || value === undefined) {
    return {
      ok: true,
      value: null,
    };
  }

  if (typeof value !== "string") {
    return {
      ok: false,
      value: null,
    };
  }

  const normalized = value.trim();

  if (normalized.length === 0 || normalized.length > 128) {
    return {
      ok: false,
      value: null,
    };
  }

  return {
    ok: true,
    value: normalized,
  };
}

function normalizeResponseTimeMs(value) {
  return Number.isInteger(value) &&
    value >= 0 &&
    value <= 2147483647
    ? value
    : null;
}

function toPublicResponse(response) {
  if (!response) {
    return response;
  }

  const {
    idempotencyKey: _idempotencyKey,
    ...publicResponse
  } = response;

  return publicResponse;
}

function responseMatchesRequest({
  response,
  submittedAnswer,
  hintUsed,
  answerRevealed,
  responseTimeMs,
}) {
  return (
    isDeepStrictEqual(response.submittedAnswer, submittedAnswer) &&
    response.hintUsed === hintUsed &&
    response.answerRevealed === answerRevealed &&
    response.responseTimeMs === responseTimeMs
  );
}

async function findIdempotentResponse({
  attemptId,
  activityItemId,
  idempotencyKey,
}) {
  if (idempotencyKey === null) {
    return null;
  }

  return prisma.response.findFirst({
    where: {
      attemptId,
      activityItemId,
      idempotencyKey,
    },
    select: IDEMPOTENCY_RESPONSE_SELECT,
  });
}

function buildOkResult({
  dayResult,
  activity,
  attempt,
  response,
  idempotentReplay,
}) {
  return {
    type: "OK",
    program: dayResult.program,
    version: dayResult.version,
    enrollment: dayResult.enrollment,
    cohort: dayResult.cohort,
    day: {
      id: dayResult.day.id,
      dayNumber: dayResult.day.dayNumber,
    },
    activity: {
      id: activity.id,
      key: activity.key,
      activityType: activity.activityType,
      evaluationMode: activity.evaluationMode,
    },
    attempt,
    response,
    idempotentReplay,
  };
}

async function findLatestResponseNumber({
  attemptId,
  activityItemId,
}) {
  const latest = await prisma.response.findFirst({
    where: {
      attemptId,
      activityItemId,
    },
    orderBy: {
      responseNumber: "desc",
    },
    select: {
      responseNumber: true,
    },
  });

  return Number(latest?.responseNumber || 0);
}

async function appendResponse({
  attemptId,
  activityItemId,
  submittedAnswer,
  evaluation,
  hintUsed,
  answerRevealed,
  responseTimeMs,
  idempotencyKey,
  now,
}) {
  const maxCreateAttempts = 4;

  for (
    let createAttempt = 0;
    createAttempt < maxCreateAttempts;
    createAttempt += 1
  ) {
    const latestResponseNumber = await findLatestResponseNumber({
      attemptId,
      activityItemId,
    });

    const responseNumber = latestResponseNumber + 1;

    try {
      const response = await prisma.response.create({
        data: {
          attemptId,
          activityItemId,
          responseNumber,
          submittedAnswer,
          isCorrect: evaluation.isCorrect,
          evaluationCode: evaluation.evaluationCode,
          score: evaluation.score,
          hintUsed,
          answerRevealed,
          responseTimeMs,
          ...(idempotencyKey !== null ? { idempotencyKey } : {}),
          submittedAt: now,
        },
        select: RESPONSE_SELECT,
      });

      return {
        type: "OK",
        response,
        idempotentReplay: false,
      };
    } catch (err) {
      if (err?.code !== "P2002") {
        throw err;
      }

      if (idempotencyKey !== null) {
        const winner = await findIdempotentResponse({
          attemptId,
          activityItemId,
          idempotencyKey,
        });

        if (winner) {
          if (
            !responseMatchesRequest({
              response: winner,
              submittedAnswer,
              hintUsed,
              answerRevealed,
              responseTimeMs,
            })
          ) {
            return {
              type: "IDEMPOTENCY_CONFLICT",
            };
          }

          return {
            type: "OK",
            response: toPublicResponse(winner),
            idempotentReplay: true,
          };
        }
      }

      if (createAttempt === maxCreateAttempts - 1) {
        throw err;
      }
    }
  }

  throw new Error("Failed to append CEFR Response");
}

export async function submitCefrActivityResponse({
  userId,
  programSlug,
  dayNumber,
  activityId,
  attemptId,
  activityItemId,
  submittedAnswer,
  hintUsed = false,
  answerRevealed = false,
  responseTimeMs = null,
  idempotencyKey = null,
  now = new Date(),
}) {
  const normalizedIdempotency = normalizeIdempotencyKey(idempotencyKey);

  if (!normalizedIdempotency.ok) {
    return {
      type: "INVALID_IDEMPOTENCY_KEY",
    };
  }

  const normalizedIdempotencyKey = normalizedIdempotency.value;
  const normalizedHintUsed = Boolean(hintUsed);
  const normalizedAnswerRevealed = Boolean(answerRevealed);
  const normalizedResponseTimeMs = normalizeResponseTimeMs(responseTimeMs);

  const dayResult = await getCefrDayDetail({
    userId,
    programSlug,
    dayNumber,
    now,
  });

  if (dayResult.type !== "OK") {
    return dayResult;
  }

  const activity =
    dayResult.day.activities.find(
      (candidate) => candidate.id === activityId,
    ) || null;

  if (!activity) {
    return {
      type: "ACTIVITY_NOT_FOUND",
      program: dayResult.program,
      version: dayResult.version,
      enrollment: dayResult.enrollment,
      cohort: dayResult.cohort,
      day: {
        id: dayResult.day.id,
        dayNumber: dayResult.day.dayNumber,
      },
    };
  }

  const publicItem =
    activity.items?.find(
      (candidate) => candidate.id === activityItemId,
    ) || null;

  if (!publicItem) {
    return {
      type: "ACTIVITY_ITEM_NOT_FOUND",
      program: dayResult.program,
      version: dayResult.version,
      enrollment: dayResult.enrollment,
      cohort: dayResult.cohort,
      day: {
        id: dayResult.day.id,
        dayNumber: dayResult.day.dayNumber,
      },
      activity: {
        id: activity.id,
        key: activity.key,
        activityType: activity.activityType,
        evaluationMode: activity.evaluationMode,
      },
    };
  }

  const attempt = await prisma.attempt.findFirst({
    where: {
      id: attemptId,
      enrollmentId: dayResult.enrollment.id,
      activityId,
    },
    select: ATTEMPT_SELECT,
  });

  if (!attempt) {
    return {
      type: "ATTEMPT_NOT_FOUND",
      program: dayResult.program,
      version: dayResult.version,
      enrollment: dayResult.enrollment,
      cohort: dayResult.cohort,
      day: {
        id: dayResult.day.id,
        dayNumber: dayResult.day.dayNumber,
      },
      activity: {
        id: activity.id,
        key: activity.key,
        activityType: activity.activityType,
        evaluationMode: activity.evaluationMode,
      },
    };
  }

  if (normalizedIdempotencyKey !== null) {
    const existingResponse = await findIdempotentResponse({
      attemptId,
      activityItemId,
      idempotencyKey: normalizedIdempotencyKey,
    });

    if (existingResponse) {
      if (
        !responseMatchesRequest({
          response: existingResponse,
          submittedAnswer,
          hintUsed: normalizedHintUsed,
          answerRevealed: normalizedAnswerRevealed,
          responseTimeMs: normalizedResponseTimeMs,
        })
      ) {
        return {
          type: "IDEMPOTENCY_CONFLICT",
        };
      }

      return buildOkResult({
        dayResult,
        activity,
        attempt,
        response: toPublicResponse(existingResponse),
        idempotentReplay: true,
      });
    }
  }

  if (
    attempt.status !== "IN_PROGRESS" ||
    attempt.completedAt !== null
  ) {
    return {
      type: "ATTEMPT_NOT_OPEN",
      attempt,
    };
  }

  const activityItem = await prisma.activityItem.findFirst({
    where: {
      id: activityItemId,
      activityId,
    },
    select: {
      id: true,
      answerKey: true,
      activity: {
        select: {
          evaluationMode: true,
        },
      },
    },
  });

  if (!activityItem) {
    return {
      type: "ACTIVITY_ITEM_NOT_FOUND",
      program: dayResult.program,
      version: dayResult.version,
      enrollment: dayResult.enrollment,
      cohort: dayResult.cohort,
      day: {
        id: dayResult.day.id,
        dayNumber: dayResult.day.dayNumber,
      },
      activity: {
        id: activity.id,
        key: activity.key,
        activityType: activity.activityType,
        evaluationMode: activity.evaluationMode,
      },
    };
  }

  const evaluation = evaluateCefrSubmission({
    evaluationMode: activityItem.activity.evaluationMode,
    answerKey: activityItem.answerKey,
    submittedAnswer,
  });

  if (!evaluation.ok) {
    return {
      type: evaluation.evaluationCode,
      evaluationCode: evaluation.evaluationCode,
    };
  }

  const appendResult = await appendResponse({
    attemptId,
    activityItemId,
    submittedAnswer,
    evaluation,
    hintUsed: normalizedHintUsed,
    answerRevealed: normalizedAnswerRevealed,
    responseTimeMs: normalizedResponseTimeMs,
    idempotencyKey: normalizedIdempotencyKey,
    now,
  });

  if (appendResult.type !== "OK") {
    return appendResult;
  }

  return buildOkResult({
    dayResult,
    activity,
    attempt,
    response: appendResult.response,
    idempotentReplay: appendResult.idempotentReplay,
  });
}
