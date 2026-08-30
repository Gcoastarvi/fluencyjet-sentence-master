import { Prisma } from "@prisma/client";
import { acquireWhatsAppDestinationLock } from "./whatsappDestinationLock.js";
import { normalizeWhatsAppNumber } from "./whatsappNumber.js";

export const SENTENCE_MASTER_PRODUCT_KEY = "sentence_master";

export const LESSON1_SIGNUP_REMINDER = "LESSON1_SIGNUP_REMINDER";
export const LESSON1_WATCH_REMINDER = "LESSON1_WATCH_REMINDER";
export const LEARNING_PATH_DISCOVERY_REMINDER =
  "LEARNING_PATH_DISCOVERY_REMINDER";
export const CHECKOUT_HELP_REMINDER = "CHECKOUT_HELP_REMINDER";
export const ANY_QUESTIONS_REMINDER = "ANY_QUESTIONS_REMINDER";

export const LESSON1_PRACTICE_COMPLETED = "LESSON1_PRACTICE_COMPLETED";
export const LESSON1_OPENED = "LESSON1_OPENED";
export const LEARNING_PATH_EXPLORED = "LEARNING_PATH_EXPLORED";

export const BLOCK_A_REMINDER_EVENT_TYPES = [
  LESSON1_SIGNUP_REMINDER,
  LESSON1_WATCH_REMINDER,
  LEARNING_PATH_DISCOVERY_REMINDER,
];
export const BLOCK_B_REMINDER_EVENT_TYPES = [
  CHECKOUT_HELP_REMINDER,
  ANY_QUESTIONS_REMINDER,
];
export const WHATSAPP_REMINDER_EVENT_TYPES = [
  ...BLOCK_A_REMINDER_EVENT_TYPES,
  ...BLOCK_B_REMINDER_EVENT_TYPES,
];

const WATCH_DELAY_MS = 15 * 60 * 1000;
const DISCOVERY_DELAY_MS = 75 * 60 * 1000;
const CHECKOUT_HELP_DELAY_MS = 20 * 60 * 1000;
const ANY_QUESTIONS_DELAY_MS = 24 * 60 * 60 * 1000;

export async function acquireUserJourneyLock(
  transaction,
  userId,
  productKey = SENTENCE_MASTER_PRODUCT_KEY,
) {
  if (typeof transaction?.$executeRaw !== "function") {
    throw new Error(
      "Journey milestone writes require an interactive PostgreSQL transaction.",
    );
  }

  await transaction.$executeRaw(
    Prisma.sql`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`journey:${userId}:${productKey}`}, 0)
      )
    `,
  );
}

export async function recordMilestoneOnce({
  transaction,
  userId,
  milestoneType,
  productKey = SENTENCE_MASTER_PRODUCT_KEY,
  occurredAt = new Date(),
  metadata = undefined,
}) {
  const where = {
    userId_productKey_milestoneType: {
      userId,
      productKey,
      milestoneType,
    },
  };
  const existing = await transaction.userJourneyMilestone.findUnique({ where });

  if (existing) {
    return { created: false, milestone: existing };
  }

  const milestone = await transaction.userJourneyMilestone.create({
    data: {
      userId,
      productKey,
      milestoneType,
      occurredAt,
      ...(metadata === undefined ? {} : { metadata }),
    },
  });

  return { created: true, milestone };
}

export async function cancelPendingAutomationEvents({
  transaction,
  userId,
  eventTypes,
  productKey = SENTENCE_MASTER_PRODUCT_KEY,
  now = new Date(),
}) {
  const normalizedTypes = Array.isArray(eventTypes)
    ? [...new Set(eventTypes.filter(Boolean))]
    : [];

  if (normalizedTypes.length === 0) {
    return { count: 0 };
  }

  return transaction.automationEvent.updateMany({
    where: {
      userId,
      productKey,
      eventType: { in: normalizedTypes },
      status: "PENDING",
    },
    data: {
      status: "CANCELLED",
      cancelledAt: now,
      processedAt: now,
    },
  });
}

async function createReminderEvent({
  transaction,
  userId,
  eventType,
  productKey,
  scheduledAt,
  sourceMilestone,
}) {
  const user = await transaction.user.findUnique({
    where: { id: userId },
    select: {
      whatsapp_number: true,
      whatsapp_number_normalized: true,
    },
  });

  if (
    eventType === LEARNING_PATH_DISCOVERY_REMINDER &&
    (
      typeof user?.whatsapp_number_normalized !== "string" ||
      user.whatsapp_number_normalized.trim() === "" ||
      normalizeWhatsAppNumber(user.whatsapp_number_normalized) !==
        user.whatsapp_number_normalized
    )
  ) {
    return null;
  }

  return transaction.automationEvent.create({
    data: {
      userId,
      productKey,
      eventType,
      status: "PENDING",
      destinationNumberNormalized: user?.whatsapp_number_normalized || null,
      scheduledAt,
      payload: {
        whatsapp_number: user?.whatsapp_number || null,
        source: "user-journey-milestone",
        sourceMilestone,
      },
    },
  });
}

export async function recordCheckoutIntent({
  database,
  userId,
  occurredAt = new Date(),
  productKey = SENTENCE_MASTER_PRODUCT_KEY,
}) {
  return database.$transaction(async (transaction) => {
    await acquireUserJourneyLock(transaction, userId, productKey);

    const initialUser = await transaction.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        whatsapp_number: true,
        whatsapp_number_normalized: true,
        whatsapp_consent: true,
        has_access: true,
      },
    });

    if (!initialUser) {
      return { created: false, reason: "USER_NOT_FOUND" };
    }

    if (
      !initialUser.whatsapp_consent ||
      !initialUser.whatsapp_number_normalized
    ) {
      return { created: false, reason: "WHATSAPP_NOT_ELIGIBLE" };
    }

    if (initialUser.has_access) {
      return { created: false, reason: "USER_HAS_ACCESS" };
    }

    await acquireWhatsAppDestinationLock(
      transaction,
      initialUser.whatsapp_number_normalized,
    );

    const user = await transaction.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        whatsapp_number: true,
        whatsapp_number_normalized: true,
        whatsapp_consent: true,
        has_access: true,
      },
    });

    if (!user) {
      return { created: false, reason: "USER_NOT_FOUND" };
    }

    if (
      user.whatsapp_number_normalized !==
      initialUser.whatsapp_number_normalized
    ) {
      return { created: false, reason: "WHATSAPP_IDENTITY_CHANGED" };
    }

    if (!user.whatsapp_consent || !user.whatsapp_number_normalized) {
      return { created: false, reason: "WHATSAPP_NOT_ELIGIBLE" };
    }

    if (user.has_access) {
      return { created: false, reason: "USER_HAS_ACCESS" };
    }

    const existing = await transaction.automationEvent.findFirst({
      where: {
        userId,
        productKey,
        eventType: {
          in: [CHECKOUT_HELP_REMINDER, ANY_QUESTIONS_REMINDER],
        },
        status: { in: ["PENDING", "SENDING"] },
      },
      orderBy: [
        { createdAt: "asc" },
        { id: "asc" },
      ],
    });

    if (existing) {
      return { created: false, reason: "ALREADY_ACTIVE", automationEvent: existing };
    }

    const automationEvent = await createReminderEvent({
      transaction,
      userId,
      productKey,
      eventType: CHECKOUT_HELP_REMINDER,
      scheduledAt: new Date(occurredAt.getTime() + CHECKOUT_HELP_DELAY_MS),
      sourceMilestone: "CHECKOUT_INTENT",
    });

    const checkoutIntent = await transaction.sentenceMasterCheckoutIntent.create({
      data: {
        userId,
        productKey,
        learnerEmail: String(user.email).trim().toLowerCase(),
        destinationNumberNormalized: user.whatsapp_number_normalized,
        createdAt: occurredAt,
      },
    });

    return { created: true, automationEvent, checkoutIntent };
  }, {
    maxWait: 5_000,
    timeout: 15_000,
  });
}

export async function scheduleAnyQuestionsAfterCheckoutHelpSent({
  transaction,
  checkoutHelpEvent,
  sentAt,
  anchorSource = "provider-sent",
}) {
  if (
    !checkoutHelpEvent ||
    checkoutHelpEvent.eventType !== CHECKOUT_HELP_REMINDER ||
    checkoutHelpEvent.status !== "SENT" ||
    !(sentAt instanceof Date) ||
    Number.isNaN(sentAt.getTime())
  ) {
    return { created: false, reason: "NOT_AUTHORITATIVE_CHECKOUT_SENT" };
  }

  const existing = await transaction.automationEvent.findFirst({
    where: {
      userId: checkoutHelpEvent.userId,
      productKey: checkoutHelpEvent.productKey || SENTENCE_MASTER_PRODUCT_KEY,
      eventType: ANY_QUESTIONS_REMINDER,
      sourceAutomationEventId: checkoutHelpEvent.id,
    },
    orderBy: [
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });

  if (existing) {
    return { created: false, reason: "ALREADY_ACTIVE", automationEvent: existing };
  }

  const automationEvent = await transaction.automationEvent.create({
    data: {
      userId: checkoutHelpEvent.userId,
      productKey:
        checkoutHelpEvent.productKey || SENTENCE_MASTER_PRODUCT_KEY,
      eventType: ANY_QUESTIONS_REMINDER,
      status: "PENDING",
      sourceAutomationEventId: checkoutHelpEvent.id,
      destinationNumberNormalized:
        checkoutHelpEvent.destinationNumberNormalized || null,
      scheduledAt: new Date(sentAt.getTime() + ANY_QUESTIONS_DELAY_MS),
      payload: {
        source: "checkout-help-sent",
        sourceAutomationEventId: checkoutHelpEvent.id,
        anchorSource,
        anchorSentAt: sentAt.toISOString(),
      },
    },
  });

  return { created: true, automationEvent };
}

export async function recordPracticeCompletionTransition({
  transaction,
  userId,
  previousCompleted,
  nextCompleted,
  occurredAt = new Date(),
  productKey = SENTENCE_MASTER_PRODUCT_KEY,
}) {
  if (previousCompleted >= 10 || nextCompleted < 10) {
    return { created: false, reason: "THRESHOLD_NOT_CROSSED" };
  }

  const milestoneResult = await recordMilestoneOnce({
    transaction,
    userId,
    productKey,
    milestoneType: LESSON1_PRACTICE_COMPLETED,
    occurredAt,
  });

  if (!milestoneResult.created) {
    return milestoneResult;
  }

  await cancelPendingAutomationEvents({
    transaction,
    userId,
    productKey,
    eventTypes: [LESSON1_SIGNUP_REMINDER],
    now: occurredAt,
  });

  const existingLessonOpen = await transaction.userJourneyMilestone.findUnique({
    where: {
      userId_productKey_milestoneType: {
        userId,
        productKey,
        milestoneType: LESSON1_OPENED,
      },
    },
    select: { id: true },
  });

  if (existingLessonOpen) {
    return milestoneResult;
  }

  const automationEvent = await createReminderEvent({
    transaction,
    userId,
    productKey,
    eventType: LESSON1_WATCH_REMINDER,
    scheduledAt: new Date(occurredAt.getTime() + WATCH_DELAY_MS),
    sourceMilestone: LESSON1_PRACTICE_COMPLETED,
  });

  return {
    ...milestoneResult,
    automationEvent,
  };
}

export async function recordBlockAJourneyMilestone({
  database,
  userId,
  milestoneType,
  occurredAt = new Date(),
  productKey = SENTENCE_MASTER_PRODUCT_KEY,
}) {
  if (![LESSON1_OPENED, LEARNING_PATH_EXPLORED].includes(milestoneType)) {
    throw new Error("Unsupported Block A milestone type.");
  }

  return database.$transaction(async (transaction) => {
    await acquireUserJourneyLock(transaction, userId, productKey);

    const milestoneResult = await recordMilestoneOnce({
      transaction,
      userId,
      productKey,
      milestoneType,
      occurredAt,
    });

    if (!milestoneResult.created) {
      return milestoneResult;
    }

    if (milestoneType === LESSON1_OPENED) {
      await cancelPendingAutomationEvents({
        transaction,
        userId,
        productKey,
        eventTypes: [LESSON1_WATCH_REMINDER],
        now: occurredAt,
      });

      const existingPathExploration =
        await transaction.userJourneyMilestone.findUnique({
          where: {
            userId_productKey_milestoneType: {
              userId,
              productKey,
              milestoneType: LEARNING_PATH_EXPLORED,
            },
          },
          select: { id: true },
        });

      if (existingPathExploration) {
        return milestoneResult;
      }

      const automationEvent = await createReminderEvent({
        transaction,
        userId,
        productKey,
        eventType: LEARNING_PATH_DISCOVERY_REMINDER,
        scheduledAt: new Date(occurredAt.getTime() + DISCOVERY_DELAY_MS),
        sourceMilestone: LESSON1_OPENED,
      });

      if (!automationEvent) {
        return milestoneResult;
      }

      return {
        ...milestoneResult,
        automationEvent,
      };
    }

    await cancelPendingAutomationEvents({
      transaction,
      userId,
      productKey,
      eventTypes: [LEARNING_PATH_DISCOVERY_REMINDER],
      now: occurredAt,
    });

    return milestoneResult;
  }, {
    maxWait: 5_000,
    timeout: 15_000,
  });
}

export async function hasJourneyMilestone({
  database,
  userId,
  milestoneType,
  productKey = SENTENCE_MASTER_PRODUCT_KEY,
}) {
  const milestone = await database.userJourneyMilestone.findUnique({
    where: {
      userId_productKey_milestoneType: {
        userId,
        productKey,
        milestoneType,
      },
    },
    select: { id: true },
  });

  return Boolean(milestone);
}