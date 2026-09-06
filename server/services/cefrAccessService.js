import prisma from "../db/client.js";

function entitlementCoversDay(grants, dayNumber) {
  return grants.some(
    (grant) =>
      grant.startDayNumber <= dayNumber && grant.endDayNumber >= dayNumber,
  );
}

export function evaluateCefrDayAccess({
  dayNumber,
  entitlementGrants = [],
  cohort = null,
  liveSession = null,
  now = new Date(),
}) {
  const entitled = entitlementCoversDay(entitlementGrants, dayNumber);

  if (!entitled) {
    return {
      entitled: false,
      unlocked: false,
      accessState: "NO_ENTITLEMENT",
    };
  }

  if (!cohort) {
    return {
      entitled: true,
      unlocked: false,
      accessState: "NO_ACTIVE_COHORT",
    };
  }

  if (!liveSession) {
    return {
      entitled: true,
      unlocked: false,
      accessState: "NO_LIVE_SESSION",
    };
  }

  if (String(liveSession.status || "").toUpperCase() === "CANCELLED") {
    return {
      entitled: true,
      unlocked: false,
      accessState: "SESSION_CANCELLED",
    };
  }

  if (now < liveSession.appUnlockAt) {
    return {
      entitled: true,
      unlocked: false,
      accessState: "SCHEDULED",
    };
  }

  return {
    entitled: true,
    unlocked: true,
    accessState: "UNLOCKED",
  };
}

export async function getCefrProgramOverview({
  userId,
  programSlug,
  now = new Date(),
}) {
  const program = await prisma.program.findUnique({
    where: { slug: programSlug },
    select: {
      id: true,
      slug: true,
      name: true,
      cefrLevel: true,
      language: {
        select: {
          code: true,
          name: true,
        },
      },
    },
  });

  if (!program) {
    return {
      type: "PROGRAM_NOT_FOUND",
    };
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      endedAt: null,
      programVersion: {
        programId: program.id,
      },
    },
    orderBy: {
      enrolledAt: "desc",
    },
    select: {
      id: true,
      status: true,
      enrolledAt: true,
      programVersionId: true,

      programVersion: {
        select: {
          id: true,
          versionKey: true,
          learningDays: {
            orderBy: {
              dayNumber: "asc",
            },
            select: {
              id: true,
              dayNumber: true,
              title: true,
              summary: true,
            },
          },
        },
      },

      entitlementGrants: {
        where: {
          status: "ACTIVE",
          revokedAt: null,
        },
        select: {
          id: true,
          startDayNumber: true,
          endDayNumber: true,
          grantedAt: true,
        },
      },

      cohortEnrollments: {
        where: {
          status: "ACTIVE",
          leftAt: null,
        },
        orderBy: {
          joinedAt: "desc",
        },
        take: 2,
        select: {
          id: true,
          cohort: {
            select: {
              id: true,
              key: true,
              name: true,
              timezone: true,
              programVersionId: true,
              liveSessions: {
                select: {
                  id: true,
                  learningDayId: true,
                  startsAt: true,
                  endsAt: true,
                  appUnlockAt: true,
                  status: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!enrollment) {
    return {
      type: "ENROLLMENT_REQUIRED",
      program,
    };
  }

  if (enrollment.cohortEnrollments.length > 1) {
    return {
      type: "COHORT_CONFLICT",
      program,
      enrollmentId: enrollment.id,
    };
  }

  const cohort =
    enrollment.cohortEnrollments.length === 1
      ? enrollment.cohortEnrollments[0].cohort
      : null;

  if (cohort && cohort.programVersionId !== enrollment.programVersionId) {
    return {
      type: "COHORT_VERSION_MISMATCH",
      program,
      enrollmentId: enrollment.id,
    };
  }

  const liveSessionByLearningDayId = new Map(
    (cohort?.liveSessions || []).map((session) => [
      session.learningDayId,
      session,
    ]),
  );

  const days = enrollment.programVersion.learningDays.map((day) => {
    const liveSession = liveSessionByLearningDayId.get(day.id) || null;

    const access = evaluateCefrDayAccess({
      dayNumber: day.dayNumber,
      entitlementGrants: enrollment.entitlementGrants,
      cohort,
      liveSession,
      now,
    });

    return {
      id: day.id,
      dayNumber: day.dayNumber,
      title: day.title,
      summary: day.summary,
      ...access,
      liveSession: liveSession
        ? {
            id: liveSession.id,
            startsAt: liveSession.startsAt,
            endsAt: liveSession.endsAt,
            appUnlockAt: liveSession.appUnlockAt,
            status: liveSession.status,
          }
        : null,
    };
  });

  return {
    type: "OK",
    program,
    version: {
      id: enrollment.programVersion.id,
      versionKey: enrollment.programVersion.versionKey,
    },
    enrollment: {
      id: enrollment.id,
      status: enrollment.status,
      enrolledAt: enrollment.enrolledAt,
    },
    cohort: cohort
      ? {
          id: cohort.id,
          key: cohort.key,
          name: cohort.name,
          timezone: cohort.timezone,
        }
      : null,
    days,
  };
}

export async function getCefrDayDetail({
  userId,
  programSlug,
  dayNumber,
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

  const dayAccess =
    overview.days.find((day) => day.dayNumber === dayNumber) || null;

  if (!dayAccess) {
    return {
      type: "DAY_NOT_FOUND",
      program: overview.program,
      version: overview.version,
      enrollment: overview.enrollment,
      cohort: overview.cohort,
    };
  }

  if (!dayAccess.unlocked) {
    return {
      type: "DAY_LOCKED",
      program: overview.program,
      version: overview.version,
      enrollment: overview.enrollment,
      cohort: overview.cohort,
      day: dayAccess,
    };
  }

  const learningDay = await prisma.learningDay.findFirst({
    where: {
      id: dayAccess.id,
      programVersionId: overview.version.id,
    },
    select: {
      id: true,
      dayNumber: true,
      title: true,
      summary: true,
      activities: {
        orderBy: {
          orderIndex: "asc",
        },
        select: {
          id: true,
          key: true,
          activityType: true,
          evaluationMode: true,
          title: true,
          orderIndex: true,
          config: true,
          items: {
            orderBy: {
              orderIndex: "asc",
            },
            select: {
              id: true,
              itemKey: true,
              orderIndex: true,
              prompt: true,
              payload: true,
              hint: true,
            },
          },
        },
      },
    },
  });

  if (!learningDay) {
    return {
      type: "DAY_NOT_FOUND",
      program: overview.program,
      version: overview.version,
      enrollment: overview.enrollment,
      cohort: overview.cohort,
    };
  }

  return {
    type: "OK",
    program: overview.program,
    version: overview.version,
    enrollment: overview.enrollment,
    cohort: overview.cohort,
    day: {
      ...learningDay,
      entitled: dayAccess.entitled,
      unlocked: dayAccess.unlocked,
      accessState: dayAccess.accessState,
      liveSession: dayAccess.liveSession,
    },
  };
}
