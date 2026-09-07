import prisma from "../db/client.js";
import { getCefrProgramOverview } from "./cefrAccessService.js";

function hasResumeEvidence({ evaluationMode, response }) {
  if (evaluationMode === "AUTO") {
    return response.isCorrect === true;
  }

  if (evaluationMode === "SELF_ATTESTED") {
    return response.evaluationCode === "SELF_ATTESTED_COMPLETE";
  }

  return false;
}

function toPublicAttempt(attempt) {
  if (!attempt) return null;

  return {
    id: attempt.id,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt,
  };
}

export async function getCefrLearnerProgress({
  userId,
  programSlug,
  now = new Date(),
}) {
  const overview = await getCefrProgramOverview({
    userId,
    programSlug,
    now,
  });

  if (overview.type !== "OK") {
    return overview;
  }

  const enrollmentId = overview.enrollment.id;

  const learningDays = await prisma.learningDay.findMany({
    where: {
      programVersionId: overview.version.id,
    },
    orderBy: {
      dayNumber: "asc",
    },
    select: {
      id: true,
      dayNumber: true,
      activities: {
        orderBy: {
          orderIndex: "asc",
        },
        select: {
          id: true,
          key: true,
          title: true,
          activityType: true,
          evaluationMode: true,
          orderIndex: true,
          items: {
            orderBy: {
              orderIndex: "asc",
            },
            select: {
              id: true,
            },
          },
          attempts: {
            where: {
              enrollmentId,
            },
            orderBy: {
              attemptNumber: "desc",
            },
            select: {
              id: true,
              attemptNumber: true,
              status: true,
              startedAt: true,
              completedAt: true,
              responses: {
                select: {
                  activityItemId: true,
                  isCorrect: true,
                  evaluationCode: true,
                },
              },
            },
          },
          xpEntries: {
            where: {
              enrollmentId,
            },
            select: {
              amount: true,
            },
          },
        },
      },
    },
  });

  const xpTotal = await prisma.xpLedger.aggregate({
    where: {
      enrollmentId,
    },
    _sum: {
      amount: true,
    },
  });

  const accessByDayId = new Map(
    (overview.days || []).map((day) => [day.id, day]),
  );

  const days = learningDays.map((learningDay) => {
    const accessDay = accessByDayId.get(learningDay.id) || {
      id: learningDay.id,
      dayNumber: learningDay.dayNumber,
    };

    const activities = learningDay.activities.map((activity) => {
      const latestAttempt = activity.attempts[0] || null;

      const completed = activity.attempts.some(
        (attempt) =>
          attempt.status === "COMPLETED" &&
          attempt.completedAt !== null,
      );

      const completedItemSet = new Set();

      if (latestAttempt) {
        for (const response of latestAttempt.responses || []) {
          if (
            hasResumeEvidence({
              evaluationMode: activity.evaluationMode,
              response,
            })
          ) {
            completedItemSet.add(response.activityItemId);
          }
        }
      }

      const completedItemIds = activity.items
        .map((item) => item.id)
        .filter((itemId) => completedItemSet.has(itemId));

      const earnedXp = (activity.xpEntries || []).reduce(
        (total, entry) => total + Number(entry.amount || 0),
        0,
      );

      return {
        id: activity.id,
        key: activity.key,
        title: activity.title,
        activityType: activity.activityType,
        evaluationMode: activity.evaluationMode,
        orderIndex: activity.orderIndex,
        completed,
        earnedXp,
        latestAttempt: toPublicAttempt(latestAttempt),
        resume: {
          completedItemIds,
          totalItems: activity.items.length,
        },
      };
    });

    const completedActivityCount = activities.filter(
      (activity) => activity.completed,
    ).length;

    return {
      ...accessDay,
      id: learningDay.id,
      dayNumber: learningDay.dayNumber,
      activityCount: activities.length,
      completedActivityCount,
      completed:
        activities.length > 0 &&
        completedActivityCount === activities.length,
      activities,
    };
  });

  return {
    type: "OK",
    program: overview.program,
    version: overview.version,
    enrollment: overview.enrollment,
    cohort: overview.cohort,
    totalXp: Number(xpTotal?._sum?.amount || 0),
    days,
  };
}
