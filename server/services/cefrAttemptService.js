import prisma from "../db/client.js";
import { getCefrDayDetail } from "./cefrAccessService.js";

const ATTEMPT_SELECT = {
  id: true,
  attemptNumber: true,
  status: true,
  startedAt: true,
  completedAt: true,
};

export async function startCefrActivityAttempt({
  userId,
  programSlug,
  dayNumber,
  activityId,
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

  const enrollmentId = dayResult.enrollment.id;

  const openAttempts = await prisma.attempt.findMany({
    where: {
      enrollmentId,
      activityId,
      status: "IN_PROGRESS",
      completedAt: null,
    },
    orderBy: {
      attemptNumber: "desc",
    },
    take: 2,
    select: ATTEMPT_SELECT,
  });

  if (openAttempts.length > 1) {
    return {
      type: "ATTEMPT_CONFLICT",
      enrollmentId,
      activityId,
    };
  }

  if (openAttempts.length === 1) {
    return {
      type: "OK",
      resumed: true,
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
      attempt: openAttempts[0],
    };
  }

  const latestAttempt = await prisma.attempt.findFirst({
    where: {
      enrollmentId,
      activityId,
    },
    orderBy: {
      attemptNumber: "desc",
    },
    select: {
      attemptNumber: true,
    },
  });

  const nextAttemptNumber =
    Number(latestAttempt?.attemptNumber || 0) + 1;

  try {
    const attempt = await prisma.attempt.create({
      data: {
        enrollmentId,
        activityId,
        attemptNumber: nextAttemptNumber,
        status: "IN_PROGRESS",
        startedAt: now,
      },
      select: ATTEMPT_SELECT,
    });

    return {
      type: "OK",
      resumed: false,
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
    };
  } catch (err) {
    if (err?.code !== "P2002") {
      throw err;
    }

    const winner = await prisma.attempt.findFirst({
      where: {
        enrollmentId,
        activityId,
        attemptNumber: nextAttemptNumber,
      },
      select: ATTEMPT_SELECT,
    });

    if (!winner) {
      throw err;
    }

    return {
      type: "OK",
      resumed: true,
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
      attempt: winner,
    };
  }
}
function buildCompletionResult({
  dayResult,
  activity,
  attempt,
  alreadyCompleted,
}) {
  return {
    type: "OK",
    alreadyCompleted,
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
  };
}

function hasCompletionEvidence({
  evaluationMode,
  response,
}) {
  if (evaluationMode === "SELF_ATTESTED") {
    return response.evaluationCode === "SELF_ATTESTED_COMPLETE";
  }

  if (evaluationMode === "AUTO") {
    return response.isCorrect === true;
  }

  return false;
}

export async function completeCefrActivityAttempt({
  userId,
  programSlug,
  dayNumber,
  activityId,
  attemptId,
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

  const enrollmentId = dayResult.enrollment.id;

  const attempt = await prisma.attempt.findFirst({
    where: {
      id: attemptId,
      enrollmentId,
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
    attempt.status === "COMPLETED" &&
    attempt.completedAt !== null
  ) {
    return buildCompletionResult({
      dayResult,
      activity,
      attempt,
      alreadyCompleted: true,
    });
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

  if (
    activity.evaluationMode !== "AUTO" &&
    activity.evaluationMode !== "SELF_ATTESTED"
  ) {
    return {
      type: "ACTIVITY_COMPLETION_CONFIG_ERROR",
    };
  }

  const activityItemIds = (activity.items || [])
    .map((item) => item.id)
    .filter(Boolean);

  if (activityItemIds.length === 0) {
    return {
      type: "ACTIVITY_INCOMPLETE",
      completedItemIds: [],
      missingItemIds: [],
      reason: "NO_ACTIVITY_ITEMS",
    };
  }

  const responses = await prisma.response.findMany({
    where: {
      attemptId,
      activityItemId: {
        in: activityItemIds,
      },
    },
    select: {
      activityItemId: true,
      isCorrect: true,
      evaluationCode: true,
    },
  });

  const completedSet = new Set();

  for (const response of responses) {
    if (
      activityItemIds.includes(response.activityItemId) &&
      hasCompletionEvidence({
        evaluationMode: activity.evaluationMode,
        response,
      })
    ) {
      completedSet.add(response.activityItemId);
    }
  }

  const completedItemIds = activityItemIds.filter((id) =>
    completedSet.has(id),
  );

  const missingItemIds = activityItemIds.filter(
    (id) => !completedSet.has(id),
  );

  if (missingItemIds.length > 0) {
    return {
      type: "ACTIVITY_INCOMPLETE",
      completedItemIds,
      missingItemIds,
    };
  }

  const updateResult = await prisma.attempt.updateMany({
    where: {
      id: attemptId,
      enrollmentId,
      activityId,
      status: "IN_PROGRESS",
      completedAt: null,
    },
    data: {
      status: "COMPLETED",
      completedAt: now,
    },
  });

  const completedAttempt = await prisma.attempt.findFirst({
    where: {
      id: attemptId,
      enrollmentId,
      activityId,
    },
    select: ATTEMPT_SELECT,
  });

  if (
    !completedAttempt ||
    completedAttempt.status !== "COMPLETED" ||
    completedAttempt.completedAt === null
  ) {
    return {
      type: "ATTEMPT_COMPLETION_CONFLICT",
    };
  }

  return buildCompletionResult({
    dayResult,
    activity,
    attempt: completedAttempt,
    alreadyCompleted: updateResult.count === 0,
  });
}
