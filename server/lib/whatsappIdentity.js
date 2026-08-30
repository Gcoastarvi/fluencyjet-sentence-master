import {
  LESSON1_PRACTICE_COMPLETED,
  SENTENCE_MASTER_PRODUCT_KEY,
  acquireUserJourneyLock,
} from "./whatsappJourney.js";
import { normalizeWhatsAppNumber } from "./whatsappNumber.js";

export const LESSON1_SIGNUP_REMINDER = "LESSON1_SIGNUP_REMINDER";
export const WHATSAPP_SUPPRESSION_CLEARANCE_SOURCE =
  "try-spoken-english-gym";
export const WHATSAPP_SUPPRESSION_CLEARANCE_REASON =
  "explicit-whatsapp-consent";

export function whatsappIdentityChanged(
  previousNormalizedNumber,
  nextNormalizedNumber,
) {
  return previousNormalizedNumber !== nextNormalizedNumber;
}

export function buildSmartSignupWhatsAppState({
  existingUser,
  nextNormalizedNumber,
  consent,
  now = new Date(),
}) {
  const isFreshConsent = consent === true;
  const identityChanged = whatsappIdentityChanged(
    existingUser?.whatsapp_number_normalized ?? null,
    nextNormalizedNumber,
  );

  return {
    identityChanged,
    update: {
      whatsapp_consent: isFreshConsent,
      whatsapp_consent_at: isFreshConsent ? now : null,
      whatsapp_consent_source: isFreshConsent
        ? "try-spoken-english-gym"
        : null,
      // A true identity change cannot carry the old destination's opt-out.
      // Explicit consent on the same destination is a deliberate re-opt-in.
      whatsapp_opted_out_at:
        identityChanged || isFreshConsent
          ? null
          : (existingUser?.whatsapp_opted_out_at ?? null),
    },
  };
}

export function buildWebinarWhatsAppState({
  existingUser,
  nextNormalizedNumber,
}) {
  const identityChanged = whatsappIdentityChanged(
    existingUser?.whatsapp_number_normalized ?? null,
    nextNormalizedNumber,
  );

  if (!identityChanged) {
    return {
      identityChanged: false,
      update: {},
    };
  }

  return {
    identityChanged: true,
    update: {
      whatsapp_consent: false,
      whatsapp_consent_at: null,
      whatsapp_consent_source: null,
      whatsapp_opted_out_at: null,
    },
  };
}

export async function clearWhatsAppPhoneSuppressionOnExplicitConsent({
  prisma,
  userId,
  phoneNumberNormalized,
  consent,
  now = new Date(),
}) {
  if (consent !== true || !phoneNumberNormalized) {
    return { count: 0 };
  }

  return prisma.whatsAppPhoneSuppression.updateMany({
    where: {
      phoneNumberNormalized,
      isOptedOut: true,
    },
    data: {
      isOptedOut: false,
      clearedAt: now,
      clearanceSource: WHATSAPP_SUPPRESSION_CLEARANCE_SOURCE,
      clearanceReason: WHATSAPP_SUPPRESSION_CLEARANCE_REASON,
      clearedByUserId: userId,
    },
  });
}

export async function cancelPendingLesson1Reminder(prisma, userId) {
  return prisma.automationEvent.updateMany({
    where: {
      userId,
      productKey: SENTENCE_MASTER_PRODUCT_KEY,
      eventType: LESSON1_SIGNUP_REMINDER,
      status: "PENDING",
    },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
    },
  });
}

export async function reconcileLesson1SignupReminder({
  prisma,
  userId,
  whatsappConsent,
  whatsappNumber,
  whatsappNumberNormalized,
  source = "try-spoken-english-gym",
}) {
  return prisma.$transaction(async (tx) => {
    await acquireUserJourneyLock(
      tx,
      userId,
      SENTENCE_MASTER_PRODUCT_KEY,
    );

    const [lesson1Progress, practiceMilestone] = await Promise.all([
      tx.lessonModeProgress.findUnique({
        where: {
          userId_lessonId_mode: {
            userId: String(userId),
            lessonId: 1,
            mode: "reorder",
          },
        },
        select: { completed: true },
      }),
      tx.userJourneyMilestone.findUnique({
        where: {
          userId_productKey_milestoneType: {
            userId,
            productKey: SENTENCE_MASTER_PRODUCT_KEY,
            milestoneType: LESSON1_PRACTICE_COMPLETED,
          },
        },
        select: { id: true },
      }),
    ]);

    await cancelPendingLesson1Reminder(tx, userId);

    const hasCanonicalDestination =
      typeof whatsappNumberNormalized === "string" &&
      whatsappNumberNormalized.trim() !== "" &&
      normalizeWhatsAppNumber(whatsappNumberNormalized) ===
        whatsappNumberNormalized;

    if (
      !whatsappConsent ||
      !hasCanonicalDestination ||
      practiceMilestone ||
      Number(lesson1Progress?.completed || 0) >= 10
    ) {
      return { created: false };
    }

    const automationEvent = await tx.automationEvent.create({
      data: {
        userId,
        productKey: SENTENCE_MASTER_PRODUCT_KEY,
        eventType: LESSON1_SIGNUP_REMINDER,
        status: "PENDING",
        destinationNumberNormalized: whatsappNumberNormalized,
        scheduledAt: new Date(Date.now() + 7 * 60 * 1000),
        payload: {
          whatsapp_number: whatsappNumber,
          source,
        },
      },
    });

    return { created: true, automationEvent };
  }, {
    maxWait: 5_000,
    timeout: 15_000,
  });
}