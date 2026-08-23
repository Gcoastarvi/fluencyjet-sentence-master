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
  if (!whatsappConsent) {
    await cancelPendingLesson1Reminder(prisma, userId);
    return;
  }

  const lesson1Progress = await prisma.lessonModeProgress.findUnique({
    where: {
      userId_lessonId_mode: {
        userId: String(userId),
        lessonId: 1,
        mode: "reorder",
      },
    },
  });

  const alreadyDone =
    lesson1Progress &&
    lesson1Progress.total > 0 &&
    lesson1Progress.completed >= lesson1Progress.total;

  // Cancel stale rows before creating a replacement. The database partial
  // unique index remains the final protection against duplicate PENDING rows.
  await cancelPendingLesson1Reminder(prisma, userId);

  if (alreadyDone) {
    return;
  }

  await prisma.automationEvent.create({
    data: {
      userId,
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
}