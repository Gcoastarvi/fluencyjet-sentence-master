/**
 * server/__tests__/phase4.test.js
 *
 * Phase 4 controlled live-send endpoint tests:
 *   POST /api/automation/process-due-reminder-live
 *
 * Isolation guarantee:
 *   - Prisma is fully mocked.
 *   - WhatsApp provider is fully mocked.
 *   - No production DB is contacted.
 *   - No network requests leave this process.
 *   - No Meta/WhatsApp message can be sent.
 */

import {
  jest,
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

import request from 'supertest';
import express from 'express';
import { normalizeWhatsAppNumber } from '../lib/whatsappNumber.js';

// ---------------------------------------------------------------------------
// Mock Prisma BEFORE importing the router.
// ---------------------------------------------------------------------------
const mockPrisma = {
  $transaction: jest.fn(),
  $executeRaw: jest.fn(),

  automationEvent: {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
  whatsAppPhoneSuppression: {
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  lessonModeProgress: {
    findUnique: jest.fn(),
  },
};

const mockSendWhatsAppTemplate = jest.fn();

jest.unstable_mockModule('../db/client.js', () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule('../services/whatsappProvider.js', () => ({
  sendWhatsAppTemplate: mockSendWhatsAppTemplate,
}));

const { default: automationRouter } =
  await import('../routes/automationProcessor.js');

// ---------------------------------------------------------------------------
// Test app
// ---------------------------------------------------------------------------
function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/automation', automationRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const SECRET = 'test-automation-secret-phase4';
const AUTH = {
  Authorization: `Bearer ${SECRET}`,
};

const UUID1 = '11111111-1111-4111-8111-111111111111';

const TEST_NUMBER = '+919999999999';

function makeAe(overrides = {}) {
  return {
    id: UUID1,
    userId: 42,
    eventType: 'LESSON1_SIGNUP_REMINDER',
    status: 'PENDING',
    scheduledAt: new Date(Date.now() - 60_000),
    processedAt: null,
    cancelledAt: null,
    sentAt: null,
    payload: {
      source: 'try-spoken-english-gym',
    },
    destinationNumberNormalized: TEST_NUMBER,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeUser(overrides = {}) {
  const whatsappNumber =
    Object.prototype.hasOwnProperty.call(overrides, 'whatsapp_number')
      ? overrides.whatsapp_number
      : TEST_NUMBER;

  const normalizedNumber =
    Object.prototype.hasOwnProperty.call(
      overrides,
      'whatsapp_number_normalized',
    )
      ? overrides.whatsapp_number_normalized
      : normalizeWhatsAppNumber(whatsappNumber);

  return {
    id: 42,
    name: 'Aravind',
    email: 'phase4-test@example.com',
    whatsapp_consent: true,
    whatsapp_number: whatsappNumber,
    whatsapp_number_normalized: normalizedNumber,
    whatsapp_opted_out_at: null,
    has_access: false,
    ...overrides,
  };
}

function liveRequest(body = {}) {
  return request(makeApp())
    .post('/api/automation/process-due-reminder-live')
    .set(AUTH)
    .send(body);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeEach(() => {
  process.env.AUTOMATION_SECRET = SECRET;
  process.env.WHATSAPP_LIVE_SEND_ENABLED = 'true';
  process.env.WHATSAPP_LIVE_TEST_NUMBER = TEST_NUMBER;
  process.env.WHATSAPP_LESSON1_TEMPLATE_NAME =
    'lesson1_signup_reminder';
  process.env.WHATSAPP_LESSON1_TEMPLATE_LANGUAGE = 'ta';

  jest.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(
    async (callback) => callback(mockPrisma),
  );
  mockPrisma.$executeRaw.mockResolvedValue(1);

  // The production handler commits PENDING -> SENDING before the final
  // lock-owning re-read. Model that committed state for the normal live path;
  // individual tests that need a different first read replace this mock.
  mockPrisma.automationEvent.findUnique.mockImplementation(() =>
    mockPrisma.automationEvent.findUnique.mock.calls.length === 1
      ? makeAe()
      : makeAe({ status: 'SENDING' }),
  );
  mockPrisma.automationEvent.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.user.findUnique.mockResolvedValue(makeUser());
  mockPrisma.user.findFirst.mockResolvedValue({ id: 42 });

  mockPrisma.user.findMany.mockResolvedValue([
    {
      has_access: false,
      whatsapp_opted_out_at: null,
    },
  ]);
  mockPrisma.whatsAppPhoneSuppression.findUnique.mockResolvedValue(null);
  mockPrisma.lessonModeProgress.findUnique.mockResolvedValue(null);

  mockSendWhatsAppTemplate.mockResolvedValue({
    provider: 'meta',
    messageId: 'wamid.TEST123',
  });
});

afterEach(() => {
  delete process.env.AUTOMATION_SECRET;
  delete process.env.WHATSAPP_LIVE_SEND_ENABLED;
  delete process.env.WHATSAPP_LIVE_TEST_NUMBER;
  delete process.env.WHATSAPP_LESSON1_TEMPLATE_NAME;
  delete process.env.WHATSAPP_LESSON1_TEMPLATE_LANGUAGE;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe(
  'POST /api/automation/process-due-reminder-live',
  () => {

    test('[L-01] Live kill switch disabled → 503', async () => {
      process.env.WHATSAPP_LIVE_SEND_ENABLED = 'false';

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(503);
      expect(res.body.error).toBe('WHATSAPP_LIVE_SEND_DISABLED');
      expect(mockPrisma.automationEvent.findUnique).not.toHaveBeenCalled();
      expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
    });

    test('[L-02] liveSend missing → 400', async () => {
      const res = await liveRequest({
        automationEventId: UUID1,
      });

      expect(res.status).toBe(400);
      expect(res.body.error)
        .toBe('LIVE_SEND_CONFIRMATION_REQUIRED');

      expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
    });

    test('[L-03] liveSend string "true" → 400', async () => {
      const res = await liveRequest({
        liveSend: 'true',
        automationEventId: UUID1,
      });

      expect(res.status).toBe(400);
      expect(res.body.error)
        .toBe('LIVE_SEND_CONFIRMATION_REQUIRED');

      expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
    });

    test('[L-04] Unknown request field → 400', async () => {
      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
        mode: 'discovery',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('UNKNOWN_FIELDS');
      expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
    });

    test('[L-05] Invalid automationEventId → 400', async () => {
      const res = await liveRequest({
        liveSend: true,
        automationEventId: 'not-a-uuid',
      });

      expect(res.status).toBe(400);
      expect(res.body.error)
        .toBe('INVALID_AUTOMATION_EVENT_ID');

      expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
    });

    test('[L-06] Test number not configured → 503', async () => {
      delete process.env.WHATSAPP_LIVE_TEST_NUMBER;

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(503);
      expect(res.body.error)
        .toBe('WHATSAPP_TEST_NUMBER_NOT_CONFIGURED');

      expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
    });

    test('[L-07] Template not configured → 503', async () => {
      delete process.env.WHATSAPP_LESSON1_TEMPLATE_NAME;

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(503);
      expect(res.body.error)
        .toBe('WHATSAPP_TEMPLATE_NOT_CONFIGURED');

      expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
    });

    test('[L-08] Event not found → 404', async () => {
      mockPrisma.automationEvent.findUnique.mockResolvedValue(null);

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
      expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
    });

    test('[L-09] Wrong event type → 400', async () => {
      mockPrisma.automationEvent.findUnique.mockResolvedValue(
        makeAe({ eventType: 'DAY3_WEBINAR' }),
      );

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('WRONG_EVENT_TYPE');
      expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
    });

    test('[L-10] Existing SENDING row is not sent again', async () => {
      mockPrisma.automationEvent.findUnique.mockResolvedValue(
        makeAe({ status: 'SENDING' }),
      );

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('ALREADY_PROCESSED');
      expect(res.body.existingStatus).toBe('SENDING');

      expect(mockPrisma.automationEvent.updateMany)
        .not.toHaveBeenCalled();

      expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
    });

    test('[L-11] Reminder not due → NOT_DUE', async () => {
      mockPrisma.automationEvent.findUnique.mockResolvedValue(
        makeAe({
          scheduledAt: new Date(Date.now() + 60_000),
        }),
      );

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('NOT_DUE');
      expect(res.body.whatsappSent).toBe(false);

      expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
    });

    test('[L-12] Consent false → CANCELLED, no send', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(
        makeUser({ whatsapp_consent: false }),
      );

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('CANCELLED');
      expect(res.body.skipReason).toBe('CONSENT_FALSE');
      expect(res.body.whatsappSent).toBe(false);

      expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
    });

    test('[L-13] Missing event destination → CANCELLED without a provider call', async () => {
      mockPrisma.automationEvent.findUnique.mockResolvedValue(
        makeAe({ destinationNumberNormalized: null }),
      );

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('CANCELLED');
      expect(res.body.skipReason)
        .toBe('MISSING_EVENT_DESTINATION');

      expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    test('[L-14] User already has access → CANCELLED', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(
        makeUser({ has_access: true }),
      );

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('CANCELLED');
      expect(res.body.skipReason).toBe('USER_HAS_ACCESS');

      expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
    });

    test('[L-14A] Same phone peer has access → CANCELLED, no send', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        {
          has_access: false,
          whatsapp_opted_out_at: null,
        },
        {
          has_access: true,
          whatsapp_opted_out_at: null,
        },
      ]);

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('CANCELLED');
      expect(res.body.skipReason).toBe('PHONE_HAS_ACCESS');
      expect(res.body.whatsappSent).toBe(false);

      expect(mockSendWhatsAppTemplate)
        .not.toHaveBeenCalled();

      expect(mockPrisma.lessonModeProgress.findUnique)
        .not.toHaveBeenCalled();
    });

    test('[L-14B] Same phone peer opted out → CANCELLED, no send', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        {
          has_access: false,
          whatsapp_opted_out_at: null,
        },
        {
          has_access: false,
          whatsapp_opted_out_at: new Date(),
        },
      ]);

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('CANCELLED');
      expect(res.body.skipReason).toBe('PHONE_OPTED_OUT');
      expect(res.body.whatsappSent).toBe(false);

      expect(mockSendWhatsAppTemplate)
        .not.toHaveBeenCalled();

      expect(mockPrisma.lessonModeProgress.findUnique)
        .not.toHaveBeenCalled();
    });

    test('[L-14C] Invalid event destination → CANCELLED, no send', async () => {
      mockPrisma.automationEvent.findUnique.mockResolvedValue(
        makeAe({
          destinationNumberNormalized: 'invalid-number',
        }),
      );

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('CANCELLED');
      expect(res.body.skipReason)
        .toBe('INVALID_EVENT_DESTINATION');
      expect(res.body.whatsappSent).toBe(false);

      expect(mockPrisma.user.findUnique)
        .not.toHaveBeenCalled();

      expect(mockSendWhatsAppTemplate)
        .not.toHaveBeenCalled();
    });

    test('[L-14D] Reminder owner changed canonical phone → CANCELLED, no send', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('CANCELLED');
      expect(res.body.skipReason)
        .toBe('PHONE_IDENTITY_CHANGED');
      expect(res.body.whatsappSent).toBe(false);

      expect(mockPrisma.user.findMany)
        .not.toHaveBeenCalled();

      expect(mockSendWhatsAppTemplate)
        .not.toHaveBeenCalled();
    });

    test('[L-14E] Active durable phone suppression → CANCELLED, no send', async () => {
      mockPrisma.whatsAppPhoneSuppression.findUnique.mockResolvedValue({
        isOptedOut: true,
      });

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('CANCELLED');
      expect(res.body.skipReason).toBe('PHONE_SUPPRESSED');
      expect(res.body.whatsappSent).toBe(false);
      expect(mockPrisma.whatsAppPhoneSuppression.findUnique)
        .toHaveBeenCalledWith({
          where: {
            phoneNumberNormalized: TEST_NUMBER,
          },
          select: {
            isOptedOut: true,
          },
        });
      expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
    });

    test('[L-15] Lesson 1 complete → CANCELLED', async () => {
      mockPrisma.lessonModeProgress.findUnique.mockResolvedValue({
        completed: 10,
        total: 10,
      });

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('CANCELLED');
      expect(res.body.skipReason).toBe('LESSON1_COMPLETE');

      expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
    });

    test('[L-15A] Missing learner name → 422, no claim, no send', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(
        makeUser({ name: null }),
      );

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(422);
      expect(res.body.error)
        .toBe('WHATSAPP_TEMPLATE_PARAMETER_MISSING');

      expect(res.body.parameter).toBe('body.{{1}}');
      expect(res.body.whatsappSent).toBe(false);

      expect(mockPrisma.automationEvent.updateMany)
        .not.toHaveBeenCalled();

      expect(mockSendWhatsAppTemplate)
        .not.toHaveBeenCalled();
    });

    test('[L-16] Non-test recipient → 403, no claim, no send', async () => {
      mockPrisma.automationEvent.findUnique.mockResolvedValue(
        makeAe({
          destinationNumberNormalized: '+918888888888',
        }),
      );

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('TEST_RECIPIENT_ONLY');

      expect(mockPrisma.automationEvent.updateMany)
        .not.toHaveBeenCalled();

      expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
    });

    test('[L-16A] Formatted test allowlist matches canonical recipient', async () => {
      process.env.WHATSAPP_LIVE_TEST_NUMBER = '99999 99999';

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('SENT');
      expect(res.body.whatsappSent).toBe(true);

      expect(mockSendWhatsAppTemplate)
        .toHaveBeenCalledTimes(1);
    });

    test('[L-17] Happy path: PENDING → SENDING → SENT', async () => {
      mockPrisma.automationEvent.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 1 });

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.result).toBe('SENT');
      expect(res.body.whatsappSent).toBe(true);
      expect(res.body.providerMessageId)
        .toBe('wamid.TEST123');

      expect(mockPrisma.automationEvent.updateMany)
        .toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({
            where: {
              id: UUID1,
              status: 'PENDING',
            },
            data: expect.objectContaining({
              status: 'SENDING',
              processedAt: expect.any(Date),
            }),
          }),
        );

      expect(mockSendWhatsAppTemplate)
        .toHaveBeenCalledTimes(1);

      expect(mockSendWhatsAppTemplate)
        .toHaveBeenCalledWith(expect.objectContaining({
          to: TEST_NUMBER,
          templateName: 'lesson1_signup_reminder',
          languageCode: 'ta',
          bodyParameters: ['Aravind'],
          automationEventId: UUID1,
          signal: expect.any(AbortSignal),
        }));

      expect(mockPrisma.automationEvent.updateMany)
        .toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({
            where: {
              id: UUID1,
              status: 'SENDING',
            },
            data: expect.objectContaining({
              status: 'SENT',
              sentAt: expect.any(Date),
              processedAt: expect.any(Date),
              providerMessageId: 'wamid.TEST123',
              payload: expect.objectContaining({
                source: 'try-spoken-english-gym',
                whatsappDelivery: expect.objectContaining({
                  provider: 'meta',
                  messageId: 'wamid.TEST123',
                  sentAt: expect.any(String),
                }),
              }),
            }),
          }),
        );
    });

    test('[L-17A] Provider uses immutable event destination, not mutable display number', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(
        makeUser({
          whatsapp_number: '+91 88888 88888',
          whatsapp_number_normalized: TEST_NUMBER,
        }),
      );

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('SENT');

      expect(mockSendWhatsAppTemplate)
        .toHaveBeenCalledWith(
          expect.objectContaining({
            to: TEST_NUMBER,
          }),
        );

      expect(mockSendWhatsAppTemplate)
        .not.toHaveBeenCalledWith(
          expect.objectContaining({
            to: '+91 88888 88888',
          }),
        );
    });

    test('[L-18] Claim race → provider is never called', async () => {
      mockPrisma.automationEvent.updateMany
        .mockResolvedValueOnce({ count: 0 });

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('ALREADY_PROCESSED');
      expect(res.body.whatsappSent).toBe(false);

      expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
    });

    test('[L-18A] Identity change after claim is guardedly cancelled before provider call', async () => {
      mockPrisma.user.findFirst
        .mockResolvedValueOnce({ id: 42 })
        .mockResolvedValueOnce(null);

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('CANCELLED');
      expect(res.body.skipReason).toBe('PHONE_IDENTITY_CHANGED');
      expect(res.body.whatsappSent).toBe(false);
      expect(mockPrisma.automationEvent.updateMany)
        .toHaveBeenNthCalledWith(
          2,
          {
            where: {
              id: UUID1,
              status: 'SENDING',
              providerMessageId: null,
            },
            data: {
              status: 'CANCELLED',
              cancelledAt: expect.any(Date),
              processedAt: expect.any(Date),
            },
          },
        );
      expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
    });

    test('[L-18B] Access gained after claim is cancelled before provider call', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(makeUser())
        .mockResolvedValueOnce(makeUser({ has_access: true }));

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('CANCELLED');
      expect(res.body.skipReason).toBe('USER_HAS_ACCESS');
      expect(res.body.whatsappSent).toBe(false);
      expect(mockPrisma.automationEvent.updateMany)
        .toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({
            where: {
              id: UUID1,
              status: 'SENDING',
              providerMessageId: null,
            },
          }),
        );
      expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
    });

    test('[L-18C] Durable suppression activated after claim is cancelled before provider call', async () => {
      mockPrisma.whatsAppPhoneSuppression.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ isOptedOut: true });

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('CANCELLED');
      expect(res.body.skipReason).toBe('PHONE_SUPPRESSED');
      expect(res.body.whatsappSent).toBe(false);
      expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
    });

    test('[L-19] Provider error → remains SENDING', async () => {
      const providerError = new Error('provider unavailable');
      providerError.code = 'TEST_PROVIDER_FAILURE';

      mockSendWhatsAppTemplate.mockRejectedValue(providerError);

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(502);
      expect(res.body.error)
        .toBe('WHATSAPP_SEND_UNCONFIRMED');

      expect(res.body.providerError)
        .toBe('TEST_PROVIDER_FAILURE');

      expect(res.body.existingStatus).toBe('SENDING');
      expect(res.body.whatsappSent).toBeNull();

      expect(mockPrisma.automationEvent.updateMany)
        .toHaveBeenCalledTimes(1);
    });

    test('[L-20] Invalid provider response → remains SENDING', async () => {
      mockSendWhatsAppTemplate.mockResolvedValue({});

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(502);
      expect(res.body.error)
        .toBe('WHATSAPP_SEND_UNCONFIRMED');

      expect(res.body.providerError)
        .toBe('INVALID_PROVIDER_RESPONSE');

      expect(res.body.existingStatus).toBe('SENDING');
      expect(res.body.whatsappSent).toBeNull();

      expect(mockPrisma.automationEvent.updateMany)
        .toHaveBeenCalledTimes(1);
    });

    test('[L-21] Finalize race never retries provider', async () => {
      mockPrisma.automationEvent.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(500);
      expect(res.body.error)
        .toBe('SEND_FINALIZE_CONFLICT');

      expect(res.body.providerMessageId)
        .toBe('wamid.TEST123');

      expect(res.body.whatsappSent).toBe(true);

      expect(mockSendWhatsAppTemplate)
        .toHaveBeenCalledTimes(1);
    });

    test('[L-22] Finalize DB failure never retries provider', async () => {
      mockPrisma.automationEvent.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockRejectedValueOnce(
          new Error('simulated finalize DB failure'),
        );

      const res = await liveRequest({
        liveSend: true,
        automationEventId: UUID1,
      });

      expect(res.status).toBe(500);
      expect(res.body.error)
        .toBe('SEND_FINALIZE_FAILED');

      expect(res.body.providerMessageId)
        .toBe('wamid.TEST123');

      expect(res.body.whatsappSent).toBe(true);

      expect(mockSendWhatsAppTemplate)
        .toHaveBeenCalledTimes(1);
    });
  },
);
