import prisma from "../db/client.js";

const RESPONSE_EVIDENCE_SELECT = {
  id: true,
  activityItemId: true,
  responseNumber: true,
  isCorrect: true,
  evaluationCode: true,
  attempt: {
    select: {
      id: true,
      attemptNumber: true,
      enrollmentId: true,
      activityId: true,
      enrollment: {
        select: {
          userId: true,
        },
      },
      activity: {
        select: {
          xpConfig: true,
        },
      },
    },
  },
  activityItem: {
    select: {
      activityId: true,
    },
  },
};

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function normalizeXpConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const {
    ruleVersion,
    firstCorrect,
    retryCorrect,
    selfAttestedComplete,
  } = value;

  if (
    typeof ruleVersion !== "string" ||
    ruleVersion.trim().length === 0 ||
    ruleVersion.trim().length > 40 ||
    !isPositiveInteger(firstCorrect) ||
    !isPositiveInteger(retryCorrect) ||
    !isPositiveInteger(selfAttestedComplete)
  ) {
    return null;
  }

  return {
    ruleVersion: ruleVersion.trim(),
    firstCorrect,
    retryCorrect,
    selfAttestedComplete,
  };
}

function getAwardKind(response) {
  if (response.evaluationCode === "SELF_ATTESTED_COMPLETE") {
    return "SELF_ATTESTED";
  }

  if (response.isCorrect === true) {
    return "CORRECT";
  }

  return null;
}

function buildIdempotencyKey(enrollmentId, activityItemId) {
  return `cefr:item-success:${enrollmentId}:${activityItemId}`;
}

function buildAward({
  response,
  xpConfig,
  awardKind,
}) {
  if (awardKind === "SELF_ATTESTED") {
    return {
      amount: xpConfig.selfAttestedComplete,
      eventType: "ITEM_SELF_ATTESTED_COMPLETE",
    };
  }

  const isFirstCorrect =
    response.attempt.attemptNumber === 1 &&
    response.responseNumber === 1;

  if (isFirstCorrect) {
    return {
      amount: xpConfig.firstCorrect,
      eventType: "ITEM_FIRST_CORRECT",
    };
  }

  return {
    amount: xpConfig.retryCorrect,
    eventType: "ITEM_RETRY_CORRECT",
  };
}

function buildResult(xp, idempotentReplay) {
  return {
    type: "OK",
    idempotentReplay,
    xp,
  };
}

export async function awardCefrResponseXp({
  responseId,
}) {
  if (
    typeof responseId !== "string" ||
    responseId.trim().length === 0
  ) {
    return {
      type: "RESPONSE_NOT_FOUND",
    };
  }

  const response = await prisma.response.findUnique({
    where: {
      id: responseId.trim(),
    },
    select: RESPONSE_EVIDENCE_SELECT,
  });

  if (!response) {
    return {
      type: "RESPONSE_NOT_FOUND",
    };
  }

  const attempt = response.attempt;
  const activityItem = response.activityItem;

  if (
    !attempt ||
    !activityItem ||
    typeof attempt.enrollmentId !== "string" ||
    typeof attempt.activityId !== "string" ||
    typeof activityItem.activityId !== "string" ||
    attempt.activityId !== activityItem.activityId ||
    !attempt.enrollment ||
    !Number.isInteger(attempt.enrollment.userId)
  ) {
    return {
      type: "EVIDENCE_CONFLICT",
    };
  }

  const awardKind = getAwardKind(response);

  if (!awardKind) {
    return {
      type: "NO_AWARD",
      reason: "NOT_ELIGIBLE",
    };
  }

  const idempotencyKey = buildIdempotencyKey(
    attempt.enrollmentId,
    response.activityItemId,
  );

  const existingAward = await prisma.xpLedger.findUnique({
    where: {
      idempotencyKey,
    },
  });

  if (existingAward) {
    return buildResult(existingAward, true);
  }

  const xpConfig = normalizeXpConfig(
    attempt.activity?.xpConfig,
  );

  if (!xpConfig) {
    return {
      type: "XP_CONFIG_ERROR",
    };
  }

  const award = buildAward({
    response,
    xpConfig,
    awardKind,
  });

  const data = {
    userId: attempt.enrollment.userId,
    enrollmentId: attempt.enrollmentId,
    activityId: attempt.activityId,
    attemptId: attempt.id,
    responseId: response.id,
    amount: award.amount,
    eventType: award.eventType,
    ruleVersion: xpConfig.ruleVersion,
    idempotencyKey,
    metadata: {
      activityItemId: response.activityItemId,
      attemptNumber: attempt.attemptNumber,
      responseNumber: response.responseNumber,
      evaluationCode: response.evaluationCode,
    },
  };

  try {
    const xp = await prisma.xpLedger.create({
      data,
    });

    return buildResult(xp, false);
  } catch (error) {
    if (error?.code !== "P2002") {
      throw error;
    }

    const concurrentWinner =
      await prisma.xpLedger.findUnique({
        where: {
          idempotencyKey,
        },
      });

    if (!concurrentWinner) {
      throw error;
    }

    return buildResult(concurrentWinner, true);
  }
}


export async function awardCefrAttemptCompletionXp({
  attemptId,
}) {
  if (
    typeof attemptId !== "string" ||
    attemptId.trim().length === 0
  ) {
    return {
      type: "ATTEMPT_NOT_FOUND",
    };
  }

  const attempt = await prisma.attempt.findUnique({
    where: {
      id: attemptId.trim(),
    },
    select: {
      id: true,
      attemptNumber: true,
      status: true,
      completedAt: true,
      enrollmentId: true,
      activityId: true,
      enrollment: {
        select: {
          userId: true,
        },
      },
      activity: {
        select: {
          xpConfig: true,
        },
      },
    },
  });

  if (!attempt) {
    return {
      type: "ATTEMPT_NOT_FOUND",
    };
  }

  if (
    typeof attempt.enrollmentId !== "string" ||
    typeof attempt.activityId !== "string" ||
    !attempt.enrollment ||
    !Number.isInteger(attempt.enrollment.userId) ||
    !attempt.activity
  ) {
    return {
      type: "EVIDENCE_CONFLICT",
    };
  }

  if (
    attempt.status !== "COMPLETED" ||
    attempt.completedAt === null
  ) {
    return {
      type: "NO_AWARD",
      reason: "ATTEMPT_NOT_COMPLETED",
    };
  }

  const idempotencyKey =
    `cefr:activity-completion:${attempt.enrollmentId}:${attempt.activityId}`;

  const existingAward = await prisma.xpLedger.findUnique({
    where: {
      idempotencyKey,
    },
  });

  if (existingAward) {
    return buildResult(existingAward, true);
  }

  const rawXpConfig = attempt.activity.xpConfig;
  const xpConfig = normalizeXpConfig(rawXpConfig);

  if (!xpConfig) {
    return {
      type: "XP_CONFIG_ERROR",
    };
  }

  if (
    !Object.prototype.hasOwnProperty.call(
      rawXpConfig,
      "activityCompletion",
    )
  ) {
    return {
      type: "NO_AWARD",
      reason: "NO_ACTIVITY_COMPLETION_BONUS",
    };
  }

  if (!isPositiveInteger(rawXpConfig.activityCompletion)) {
    return {
      type: "XP_CONFIG_ERROR",
    };
  }

  const data = {
    userId: attempt.enrollment.userId,
    enrollmentId: attempt.enrollmentId,
    activityId: attempt.activityId,
    attemptId: attempt.id,
    amount: rawXpConfig.activityCompletion,
    eventType: "ACTIVITY_COMPLETED",
    ruleVersion: xpConfig.ruleVersion,
    idempotencyKey,
    metadata: {
      attemptNumber: attempt.attemptNumber,
    },
  };

  try {
    const xp = await prisma.xpLedger.create({
      data,
    });

    return buildResult(xp, false);
  } catch (error) {
    if (error?.code !== "P2002") {
      throw error;
    }

    const concurrentWinner =
      await prisma.xpLedger.findUnique({
        where: {
          idempotencyKey,
        },
      });

    if (!concurrentWinner) {
      throw error;
    }

    return buildResult(concurrentWinner, true);
  }
}
