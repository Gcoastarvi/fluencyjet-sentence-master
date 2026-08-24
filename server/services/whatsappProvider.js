// server/services/whatsappProvider.js
//
// Phase 4 Meta WhatsApp Cloud API provider.
//
// IMPORTANT:
// This module can perform a real provider request ONLY when called.
// The controlled live endpoint remains protected separately by:
//   - AUTOMATION_SECRET
//   - WHATSAPP_LIVE_SEND_ENABLED=true
//   - liveSend:true
//   - one explicit automationEventId
//   - WHATSAPP_LIVE_TEST_NUMBER recipient restriction
//
// Do not configure production credentials or enable the live-send gate
// until the Phase 4 provider tests and regression tests have passed.

const REQUEST_TIMEOUT_MS = 10000;

const POISON_VALUES = new Set([
  '',
  'undefined',
  'null',
  'changeme',
  'change-me',
  'your_token_here',
  'your_access_token_here',
  'your_phone_number_id_here',
]);

function makeProviderError(code, message, extra = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();

  if (!value || POISON_VALUES.has(value.toLowerCase())) {
    throw makeProviderError(
      'WHATSAPP_PROVIDER_NOT_CONFIGURED',
      `Required WhatsApp provider setting is missing: ${name}`,
      { field: name },
    );
  }

  return value;
}

function normalizeRecipient(value) {
  const digits = String(value || '').replace(/\D/g, '');

  // E.164 permits a maximum of 15 digits.
  // We require a reasonable minimum to reject obviously malformed values.
  if (!/^\d{8,15}$/.test(digits)) {
    throw makeProviderError(
      'WHATSAPP_PROVIDER_INVALID_MESSAGE',
      'WhatsApp recipient number is invalid.',
      { field: 'to' },
    );
  }

  return digits;
}

function normalizeBodyParameters(value) {
  if (value === undefined) return [];

  if (!Array.isArray(value)) {
    throw makeProviderError(
      'WHATSAPP_PROVIDER_INVALID_MESSAGE',
      'WhatsApp bodyParameters must be an array.',
      { field: 'bodyParameters' },
    );
  }

  return value.map((parameter, index) => {
    const text = String(parameter ?? '').trim();

    if (!text) {
      throw makeProviderError(
        'WHATSAPP_PROVIDER_INVALID_MESSAGE',
        `WhatsApp body parameter ${index + 1} is empty.`,
        { field: `bodyParameters[${index}]` },
      );
    }

    return text;
  });
}

async function readJsonSafely(response) {
  try {
    const raw = await response.text();
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Send a WhatsApp template message through Meta Cloud API.
 *
 * Input:
 * {
 *   to: string,
 *   templateName: string,
 *   languageCode: string,
 *   bodyParameters?: Array<string>,
 *   automationEventId: string,
 *   signal?: AbortSignal
 * }
 *
 * Success:
 * {
 *   provider: 'meta',
 *   messageId: string
 * }
 */
export async function sendWhatsAppTemplate(message = {}) {
  const phoneNumberId = requiredEnv('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = requiredEnv('WHATSAPP_ACCESS_TOKEN');
  const graphApiVersion = requiredEnv('WHATSAPP_GRAPH_API_VERSION');

  if (!/^\d+$/.test(phoneNumberId)) {
    throw makeProviderError(
      'WHATSAPP_PROVIDER_NOT_CONFIGURED',
      'WHATSAPP_PHONE_NUMBER_ID is invalid.',
      { field: 'WHATSAPP_PHONE_NUMBER_ID' },
    );
  }

  if (!/^v\d+\.\d+$/.test(graphApiVersion)) {
    throw makeProviderError(
      'WHATSAPP_PROVIDER_NOT_CONFIGURED',
      'WHATSAPP_GRAPH_API_VERSION is invalid.',
      { field: 'WHATSAPP_GRAPH_API_VERSION' },
    );
  }

  const to = normalizeRecipient(message.to);

  const templateName = String(message.templateName || '').trim();
  const languageCode = String(message.languageCode || '').trim();

  if (!templateName) {
    throw makeProviderError(
      'WHATSAPP_PROVIDER_INVALID_MESSAGE',
      'WhatsApp template name is missing.',
      { field: 'templateName' },
    );
  }

  if (!languageCode) {
    throw makeProviderError(
      'WHATSAPP_PROVIDER_INVALID_MESSAGE',
      'WhatsApp template language is missing.',
      { field: 'languageCode' },
    );
  }

  const bodyParameters = normalizeBodyParameters(message.bodyParameters);

  const template = {
    name: templateName,
    language: {
      code: languageCode,
    },
  };

  if (bodyParameters.length > 0) {
    template.components = [
      {
        type: 'body',
        parameters: bodyParameters.map((text) => ({
          type: 'text',
          text,
        })),
      },
    ];
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template,
  };

  const url =
    `https://graph.facebook.com/${graphApiVersion}/` +
    `${phoneNumberId}/messages`;

  const controller = new AbortController();
  const externalSignal = message.signal;
  const abortFromCaller = () => controller.abort();

  if (externalSignal?.aborted) {
    controller.abort();
  } else if (typeof externalSignal?.addEventListener === 'function') {
    externalSignal.addEventListener('abort', abortFromCaller, { once: true });
  }

  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw makeProviderError(
        'WHATSAPP_PROVIDER_TIMEOUT',
        'Meta WhatsApp API request timed out.',
      );
    }

    throw makeProviderError(
      'WHATSAPP_PROVIDER_REQUEST_FAILED',
      'Meta WhatsApp API request failed before a confirmed response.',
      { cause: error },
    );
  } finally {
    clearTimeout(timeout);
    if (typeof externalSignal?.removeEventListener === 'function') {
      externalSignal.removeEventListener('abort', abortFromCaller);
    }
  }

  const data = await readJsonSafely(response);

  if (!response.ok) {
    throw makeProviderError(
      'WHATSAPP_PROVIDER_REJECTED',
      'Meta WhatsApp API rejected the message request.',
      {
        metaStatus: response.status,
        metaErrorCode: data?.error?.code ?? null,
        metaErrorSubcode: data?.error?.error_subcode ?? null,
        metaErrorType: data?.error?.type ?? null,
      },
    );
  }

  const messageId = data?.messages?.[0]?.id;

  if (typeof messageId !== 'string' || !messageId.trim()) {
    throw makeProviderError(
      'WHATSAPP_PROVIDER_INVALID_RESPONSE',
      'Meta WhatsApp API returned success without a message ID.',
    );
  }

  return {
    provider: 'meta',
    messageId: messageId.trim(),
  };
}
