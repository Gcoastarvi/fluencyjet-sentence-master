const CONTACT_API_URL =
  "https://app.wanotifier.com/api/v1/contacts";

const CONTACT_TIMEOUT_MS = 4000;

function isNurtureEnabled() {
  return (
    String(
      process.env.WANOTIFIER_MEMORY_NURTURE_ENABLED || "",
    )
      .trim()
      .toLowerCase() === "true"
  );
}

function getConfig() {
  return {
    apiKey: String(
      process.env.WANOTIFIER_API_KEY || "",
    ).trim(),

    listId: Number(
      process.env.WANOTIFIER_MEMORY_LIST_ID,
    ),

    schoolParentTagId: Number(
      process.env.WANOTIFIER_MEMORY_SCHOOL_PARENT_TAG_ID,
    ),

    competitiveTagId: Number(
      process.env.WANOTIFIER_MEMORY_COMPETITIVE_TAG_ID,
    ),
  };
}

function safeError(value) {
  return String(value || "UNKNOWN_ERROR").slice(0, 500);
}

function getTagId(trackId, config) {
  if (
    trackId === "school_foundation" ||
    trackId === "school_advanced"
  ) {
    return config.schoolParentTagId;
  }

  if (trackId === "advanced") {
    return config.competitiveTagId;
  }

  return null;
}

export async function syncMemoryLeadToWanotifier({
  trackId,
  learnerName,
  whatsappNumberNormalized,
  score,
}) {
  if (!isNurtureEnabled()) {
    return {
      skipped: true,
      reason: "WANOTIFIER_MEMORY_NURTURE_DISABLED",
    };
  }

  const config = getConfig();
  const tagId = getTagId(trackId, config);

  if (
    !config.apiKey ||
    !Number.isInteger(config.listId) ||
    !Number.isInteger(tagId) ||
    !learnerName ||
    !whatsappNumberNormalized ||
    score === null ||
    score === undefined
  ) {
    return {
      skipped: true,
      reason: "WANOTIFIER_MEMORY_CONTACT_CONFIG_INCOMPLETE",
    };
  }

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    CONTACT_TIMEOUT_MS,
  );

  try {
    const url = new URL(CONTACT_API_URL);
    url.searchParams.set("key", config.apiKey);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        whatsapp_number: whatsappNumberNormalized,

        attributes: {
          learner_name: learnerName,
          memory_score: String(score),
        },

        list_ids: [config.listId],
        tag_ids: [tagId],

        status: "subscribed",
        replace: false,
      }),

      signal: controller.signal,
    });

    let responseBody = null;

    try {
      responseBody = await response.json();
    } catch {
      // WANotifier may return non-JSON on a provider failure.
    }

    const accepted =
      response.ok &&
      responseBody?.error === false;

    if (!accepted) {
      console.warn(
        `[memory/wanotifier-contact] failed track=${trackId} error=${safeError(
          responseBody?.message ||
            `WANOTIFIER_HTTP_${response.status}`,
        )}`,
      );

      return {
        ok: false,
        error: safeError(
          responseBody?.message ||
            `WANOTIFIER_HTTP_${response.status}`,
        ),
      };
    }

    console.log(
      `[memory/wanotifier-contact] synced track=${trackId}`,
    );

    return {
      ok: true,
    };
  } catch (error) {
    const message =
      error?.name === "AbortError"
        ? "WANOTIFIER_CONTACT_TIMEOUT"
        : safeError(error?.message || error);

    console.warn(
      `[memory/wanotifier-contact] failed track=${trackId} error=${message}`,
    );

    return {
      ok: false,
      error: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}
