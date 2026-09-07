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
  now,
}) {
  const maxCreateAttempts = 4;

  for (let createAttempt = 0; createAttempt < maxCreateAttempts; createAttempt += 1) {
    const latestResponseNumber = await findLatestResponseNumber({
      attemptId,
      activityItemId,
    });

    const responseNumber = latestResponseNumber + 1;

    try {
      return await prisma.response.create({
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
          submittedAt: now,
        },
        select: RESPONSE_SELECT,
      });
    } catch (err) {
      if (err?.code !== "P2002") {
        throw err;
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
  now = new Date(),
}) {
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

  const response = await appendResponse({
    attemptId,
    activityItemId,
    submittedAnswer,
    evaluation,
    hintUsed: Boolean(hintUsed),
    answerRevealed: Boolean(answerRevealed),
    responseTimeMs:
      Number.isInteger(responseTimeMs) &&
      responseTimeMs >= 0 &&
      responseTimeMs <= 2147483647
        ? responseTimeMs
        : null,
    now,
  });

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
  };
}
