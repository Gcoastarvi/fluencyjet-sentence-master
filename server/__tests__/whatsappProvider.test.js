import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

import { sendWhatsAppTemplate } from '../services/whatsappProvider.js';

const ENV_KEYS = [
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_GRAPH_API_VERSION',
];

const ORIGINAL_ENV = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

const ORIGINAL_FETCH = global.fetch;

function validMessage(overrides = {}) {
  return {
    to: '+91 98765 43210',
    templateName: 'fj_resume_lesson1_v1',
    languageCode: 'ta',
    bodyParameters: ['Aravind'],
    automationEventId: '11111111-1111-4111-8111-111111111111',
    ...overrides,
  };
}

function mockResponse({
  ok = true,
  status = 200,
  body = {},
} = {}) {
  return {
    ok,
    status,
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  };
}

beforeEach(() => {
  process.env.WHATSAPP_PHONE_NUMBER_ID = '1228327967030061';
  process.env.WHATSAPP_ACCESS_TOKEN = 'TEST_TOKEN_NOT_REAL';
  process.env.WHATSAPP_GRAPH_API_VERSION = 'v99.0';

  global.fetch = jest.fn();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const original = ORIGINAL_ENV[key];

    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  }

  global.fetch = ORIGINAL_FETCH;
  jest.restoreAllMocks();
});

describe('sendWhatsAppTemplate', () => {
  test('[WP-01] missing provider configuration fails before fetch', async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;

    await expect(
      sendWhatsAppTemplate(validMessage()),
    ).rejects.toMatchObject({
      code: 'WHATSAPP_PROVIDER_NOT_CONFIGURED',
      field: 'WHATSAPP_ACCESS_TOKEN',
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('[WP-02] builds exact Meta template payload', async () => {
    global.fetch.mockResolvedValue(
      mockResponse({
        body: {
          messaging_product: 'whatsapp',
          messages: [{ id: 'wamid.TEST_PROVIDER_123' }],
        },
      }),
    );

    const result = await sendWhatsAppTemplate(validMessage());

    expect(result).toEqual({
      provider: 'meta',
      messageId: 'wamid.TEST_PROVIDER_123',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [url, options] = global.fetch.mock.calls[0];

    expect(url).toBe(
      'https://graph.facebook.com/v99.0/1228327967030061/messages',
    );

    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({
      Authorization: 'Bearer TEST_TOKEN_NOT_REAL',
      'Content-Type': 'application/json',
    });

    expect(JSON.parse(options.body)).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '919876543210',
      type: 'template',
      template: {
        name: 'fj_resume_lesson1_v1',
        language: {
          code: 'ta',
        },
        components: [
          {
            type: 'body',
            parameters: [
              {
                type: 'text',
                text: 'Aravind',
              },
            ],
          },
        ],
      },
    });
  });

  test('[WP-03] malformed recipient fails before fetch', async () => {
    await expect(
      sendWhatsAppTemplate(
        validMessage({
          to: '123',
        }),
      ),
    ).rejects.toMatchObject({
      code: 'WHATSAPP_PROVIDER_INVALID_MESSAGE',
      field: 'to',
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('[WP-04] empty body parameter fails before fetch', async () => {
    await expect(
      sendWhatsAppTemplate(
        validMessage({
          bodyParameters: ['   '],
        }),
      ),
    ).rejects.toMatchObject({
      code: 'WHATSAPP_PROVIDER_INVALID_MESSAGE',
      field: 'bodyParameters[0]',
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('[WP-05] Meta rejection returns structured provider error', async () => {
    global.fetch.mockResolvedValue(
      mockResponse({
        ok: false,
        status: 400,
        body: {
          error: {
            type: 'OAuthException',
            code: 132001,
            error_subcode: 2494073,
          },
        },
      }),
    );

    await expect(
      sendWhatsAppTemplate(validMessage()),
    ).rejects.toMatchObject({
      code: 'WHATSAPP_PROVIDER_REJECTED',
      metaStatus: 400,
      metaErrorCode: 132001,
      metaErrorSubcode: 2494073,
      metaErrorType: 'OAuthException',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('[WP-06] success without message ID is rejected', async () => {
    global.fetch.mockResolvedValue(
      mockResponse({
        body: {
          messaging_product: 'whatsapp',
          messages: [],
        },
      }),
    );

    await expect(
      sendWhatsAppTemplate(validMessage()),
    ).rejects.toMatchObject({
      code: 'WHATSAPP_PROVIDER_INVALID_RESPONSE',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('[WP-07] network failure is treated as unconfirmed', async () => {
    global.fetch.mockRejectedValue(
      new Error('simulated network failure'),
    );

    await expect(
      sendWhatsAppTemplate(validMessage()),
    ).rejects.toMatchObject({
      code: 'WHATSAPP_PROVIDER_REQUEST_FAILED',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
