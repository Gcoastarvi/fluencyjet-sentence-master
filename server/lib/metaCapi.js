import crypto from "crypto";
import { FJ_CAPI_VERSION, MEMORY_CAPI_VERSION, MEMORY_PIXEL_ID } from "../config/metaTracking.js";

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
  apiVersion = FJ_CAPI_VERSION,
  eventId,
  eventTime,
  eventSourceUrl,
  value,
  currency,
  contentName,
  contentIds,
  email,
  phone,
  externalId,
  fbc,
  fbp,
  clientIpAddress,
  clientUserAgent,
  testEventCode,
}) {
  const memory = pixelId === MEMORY_PIXEL_ID;
  // Only Memory changes authentication/error handling. Legacy FJ callers keep
  // their existing URL, payload, default test code and response semantics.
  const redact = value => {
    const text = String(value || "");
    if (!memory || typeof accessToken !== "string" || !accessToken.trim()) return text;
    const forms = [accessToken, accessToken.trim()];
    // Even a malformed credential must not make the error handler throw.
    try { forms.push(encodeURIComponent(accessToken)); } catch {}
    return forms.reduce((message, token) => message.replaceAll(token, "[REDACTED]"), text);
  };
  try {
    if (memory && (apiVersion !== MEMORY_CAPI_VERSION ||
        typeof accessToken !== "string" || !accessToken.trim())) {
      return { status: 0, ok: false, body: "Memory CAPI requires its dedicated token and supported version" };
    }
    if (![FJ_CAPI_VERSION, MEMORY_CAPI_VERSION].includes(apiVersion)) {
      return { status: 0, ok: false, body: "Unsupported Meta CAPI version" };
    }
    const userData = {};

    const normalEmail = normalizeEmail(email);
    if (normalEmail) userData.em = [sha256hex(normalEmail)];

    const normalPhone = normalizePhone(phone);
    if (normalPhone) userData.ph = [sha256hex(normalPhone)];

    // external_id is customer/browser identity and must be hashed.
    if (externalId && typeof externalId === "string") {
      const normalizedExternalId = externalId.trim();
      if (normalizedExternalId) {
        userData.external_id = [sha256hex(normalizedExternalId)];
      }
    }

    // Meta browser/click identifiers are sent unhashed.
    if (fbc && typeof fbc === "string" && fbc.trim()) {
      userData.fbc = fbc.trim();
    }

    if (fbp && typeof fbp === "string" && fbp.trim()) {
      userData.fbp = fbp.trim();
    }

    // Original browser request context is also sent unhashed.
    if (
      clientIpAddress &&
      typeof clientIpAddress === "string" &&
      clientIpAddress.trim()
    ) {
      userData.client_ip_address = clientIpAddress.trim();
    }

    if (
      clientUserAgent &&
      typeof clientUserAgent === "string" &&
      clientUserAgent.trim()
    ) {
      userData.client_user_agent = clientUserAgent.trim();
    }

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

    const effectiveTestCode = testEventCode === undefined
      ? (memory ? process.env.MEMORY_META_TEST_EVENT_CODE : process.env.META_TEST_EVENT_CODE)
      : testEventCode;
    if (effectiveTestCode) {
      requestBody.test_event_code = effectiveTestCode;
    }

    const endpoint = `${CAPI_BASE}/${apiVersion}/${pixelId}/events`;
    const url = memory ? endpoint : `${endpoint}?access_token=${accessToken}`;
    const headers = { "Content-Type": "application/json" };
    if (memory) headers.Authorization = `Bearer ${accessToken.trim()}`;

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    const responseText = await res.text();
    if (memory) {
      let accepted = false;
      try {
        const response = JSON.parse(responseText);
        accepted = Number.isInteger(response.events_received) &&
          response.events_received >= 1 && !response.error;
      } catch {}
      return { status: res.status, ok: res.ok && accepted, body: redact(responseText) };
    }
    return { status: res.status, ok: res.ok, body: responseText };
  } catch (err) {
    return { status: 0, ok: false, body: redact(err.message || "fetch error") };
  }
}
