import prisma from "../db/client.js";

const DELIVERY_TIMEOUT_MS = 4000;
const STALE_SENDING_MINUTES = 10;

function getDeliveryUrl() {
  return String(process.env.WANOTIFIER_MEMORY_SCORE_URL || "").trim();
}

function safeError(value) {
  return String(value || "UNKNOWN_ERROR").slice(0, 500);
}

function formatScore(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (Number.isInteger(numeric)) {
    return String(numeric);
  }

  return String(Number(numeric.toFixed(2)));
}

async function callWanotifier({
  url,
  learnerName,
  contactName,
  whatsappNumberNormalized,
  score,
}) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    DELIVERY_TIMEOUT_MS,
  );

  try {
    const recipient = {
      whatsapp_number: whatsappNumberNormalized,
    };

    if (contactName) {
      recipient.first_name = contactName;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          body_variables: [
            learnerName,
            score,
          ],
        },
        recipients: [recipient],
      }),
      signal: controller.signal,
    });

    let responseBody = null;

    try {
      responseBody = await response.json();
    } catch {
      // WANotifier may return a non-JSON failure response.
    }

    const accepted =
      response.ok &&
      responseBody?.error === false;

    if (!accepted) {
      return {
        ok: false,
        error: safeError(
          responseBody?.message ||
            `WANOTIFIER_HTTP_${response.status}`,
        ),
      };
    }

    return {
      ok: true,
      providerStatus:
        responseBody?.status || "attempted",
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error?.name === "AbortError"
          ? "WANOTIFIER_TIMEOUT"
          : safeError(error?.message || error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function deliverMemoryScoreWhatsApp({
  ownerToken,
  trackId,
  learnerName,
  parentGuardianName,
  whatsappContactRole,
  whatsappNumberNormalized,
  formAScore,
}) {
  const url = getDeliveryUrl();

  // Local tests/dev remain unchanged if this secret is not configured.
  if (!url) {
    return {
      skipped: true,
      reason: "WANOTIFIER_MEMORY_SCORE_URL_NOT_CONFIGURED",
    };
  }

  const score = formatScore(formAScore);

  if (
    !ownerToken ||
    !learnerName ||
    !whatsappNumberNormalized ||
    score === null
  ) {
    return {
      skipped: true,
      reason: "MEMORY_SCORE_DELIVERY_DATA_INCOMPLETE",
    };
  }

  const now = new Date();

  const staleBefore = new Date(
    now.getTime() -
      STALE_SENDING_MINUTES * 60 * 1000,
  );

  // Atomic claim:
  // only one concurrent request may move this session into SENDING.
  const claim = await prisma.memoryAssessmentSession.updateMany({
    where: {
      ownerToken,
      trackId,

      OR: [
        {
          whatsappScoreDeliveryStatus: null,
        },
        {
          whatsappScoreDeliveryStatus: "FAILED",
        },
        {
          whatsappScoreDeliveryStatus: "SENDING",
          whatsappScoreDeliveryLastAttemptAt: {
            lt: staleBefore,
          },
        },
      ],
    },

    data: {
      whatsappScoreDeliveryStatus: "SENDING",
      whatsappScoreDeliveryAttempts: {
        increment: 1,
      },
      whatsappScoreDeliveryLastAttemptAt: now,
      whatsappScoreDeliveryError: null,
    },
  });

  if (claim.count !== 1) {
    return {
      skipped: true,
      reason: "ALREADY_SENT_OR_IN_PROGRESS",
    };
  }

  // For school tracks the WhatsApp belongs to the parent/guardian.
  // Do not overwrite that contact with the student's name.
  const contactName =
    whatsappContactRole === "PARENT_GUARDIAN"
      ? parentGuardianName || null
      : learnerName;

  const result = await callWanotifier({
    url,
    learnerName,
    contactName,
    whatsappNumberNormalized,
    score,
  });

  if (result.ok) {
    await prisma.memoryAssessmentSession.updateMany({
      where: {
        ownerToken,
        trackId,
        whatsappScoreDeliveryStatus: "SENDING",
      },

      data: {
        whatsappScoreDeliveryStatus: "ACCEPTED",
        whatsappScoreDeliveryAcceptedAt: new Date(),
        whatsappScoreDeliveryError: null,
      },
    });

    console.log(
      `[memory/whatsapp-score] accepted track=${trackId}`,
    );

    return result;
  }

  await prisma.memoryAssessmentSession.updateMany({
    where: {
      ownerToken,
      trackId,
      whatsappScoreDeliveryStatus: "SENDING",
    },

    data: {
      whatsappScoreDeliveryStatus: "FAILED",
      whatsappScoreDeliveryError:
        safeError(result.error),
    },
  });

  console.warn(
    `[memory/whatsapp-score] failed track=${trackId} error=${safeError(
      result.error,
    )}`,
  );

  return result;
}
