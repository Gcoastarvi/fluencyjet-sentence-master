import crypto from "crypto";

const CAPI_VERSION = "v19.0";
const CAPI_BASE = "https://graph.facebook.com";

function sha256hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(raw) {
  if (!raw || typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (v.length < 5 || !v.includes("@") || !v.includes(".")) return null;
  return v;
}

function normalizePhone(raw) {
  if (!raw || typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits || digits.length < 7) return null;
  if (digits.length === 10 && /^[6-9]/.test(digits)) return "91" + digits;
  if (digits.length >= 11) return digits;
  return digits;
}

/**
 * Send a single server-side Purchase event to Meta Conversions API.
 *
 * Returns { status, ok, body } — caller decides whether to retry.
 * This function never throws; all errors are caught and returned.
 */
export async function sendCapiPurchase({
  pixelId,
  accessToken,
  eventId,
  eventTime,
  eventSourceUrl,
  value,
  currency,
  contentName,
  contentIds,
  email,
  phone,
}) {
  try {
    const userData = {};

    const normalEmail = normalizeEmail(email);
    if (normalEmail) userData.em = [sha256hex(normalEmail)];

    const normalPhone = normalizePhone(phone);
    if (normalPhone) userData.ph = [sha256hex(normalPhone)];

    const event = {
      event_name: "Purchase",
      event_time: Math.floor(eventTime / 1000),
      action_source: "website",
      event_id: eventId,
      event_source_url: eventSourceUrl,
      user_data: userData,
      custom_data: {
        currency,
        value,
        content_name: contentName,
        content_ids: contentIds,
        content_type: "product",
      },
    };

    const requestBody = { data: [event] };

    if (process.env.META_TEST_EVENT_CODE) {
      requestBody.test_event_code = process.env.META_TEST_EVENT_CODE;
    }

    const url = `${CAPI_BASE}/${CAPI_VERSION}/${pixelId}/events?access_token=${accessToken}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const responseText = await res.text();
    return { status: res.status, ok: res.ok, body: responseText };
  } catch (err) {
    return { status: 0, ok: false, body: err.message || "fetch error" };
  }
}
