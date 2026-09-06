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
