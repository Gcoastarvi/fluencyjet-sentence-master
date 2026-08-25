/**
 * Focused coverage for the manual Phase 14B canary worker.
 * Prisma and the WhatsApp provider are fully mocked; this suite cannot send
 * a real message or contact a production database.
 */
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockPrisma = {
  $transaction: jest.fn(),
  $executeRaw: jest.fn(),
  automationEvent: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  whatsAppPhoneSuppression: {
    findUnique: jest.fn(),
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

const { createCanaryReminderHandler } =
  await import('../routes/automationProcessor.js');

const SECRET = 'test-automation-secret-canary';
const TEST_NUMBER = '+919999999999';
const TARGET_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_TARGET_ID = '22222222-2222-4222-8222-222222222222';

function makeApp(options = {}) {
  const app = express();
  app.use(express.json());
  app.post(
    '/canary',
    createCanaryReminderHandler({
      database: mockPrisma,
      sendTemplate: mockSendWhatsAppTemplate,
      ...options,
    }),
  );
  return app;
}

function canaryRequest(app, body = { liveSend: true }) {
  return request(app)
    .post('/canary')
    .set('Authorization', `Bearer ${SECRET}`)
    .send(body);
}

function makeEvent(
  id = TARGET_ID,
  userId = 1,
  destinationNumberNormalized = TEST_NUMBER,
  overrides = {},
) {
  return {
    id,
    userId,
    eventType: 'LESSON1_SIGNUP_REMINDER',
    status: 'PENDING',
    scheduledAt: new Date(Date.now() - 60_000),
    destinationNumberNormalized,
    ...overrides,
  };
}

function makeUser({
  id = 1,
  name = 'Canary Learner',
  email = 'canary-learner@example.test',
  consent = true,
  hasAccess = false,
  number = TEST_NUMBER,
  optedOutAt = null,
} = {}) {
  return {
    id,
    name,
    email,
    whatsapp_consent: consent,
    has_access: hasAccess,
    whatsapp_number_normalized: number,
    whatsapp_opted_out_at: optedOutAt,
  };
}

function configureEligibleUser(user = makeUser()) {
  mockPrisma.user.findUnique.mockResolvedValue(user);
  mockPrisma.user.findFirst.mockResolvedValue({ id: user.id });
  mockPrisma.user.findMany.mockResolvedValue([{
    has_access: user.has_access,
    whatsapp_opted_out_at: user.whatsapp_opted_out_at,
  }]);
  mockPrisma.whatsAppPhoneSuppression.findUnique.mockResolvedValue(null);
  mockPrisma.lessonModeProgress.findUnique.mockResolvedValue(null);
}

function configureLiveLifecycle(event = makeEvent(), finalStatus = 'SENT') {
  let exactRead = 0;
  mockPrisma.automationEvent.findUnique.mockImplementation(async ({
    where,
    select,
  } = {}) => {
    if (select?.status) {
      return {
        status: where?.id === event.id ? finalStatus : 'PENDING',
      };
    }

    exactRead += 1;
    return exactRead === 1 ? event : { ...event, status: 'SENDING' };
  });
  mockPrisma.automationEvent.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.$executeRaw.mockResolvedValue(1);
  mockPrisma.$transaction.mockImplementation(async (callback) =>
    callback(mockPrisma));
  mockSendWhatsAppTemplate.mockResolvedValue({
    provider: 'mocked-provider',
    messageId: 'wamid.canary.test',
  });
}

beforeEach(() => {
  process.env.AUTOMATION_SECRET = SECRET;
  process.env.WHATSAPP_LIVE_SEND_ENABLED = 'true';
  process.env.WHATSAPP_CANARY_WORKER_ENABLED = 'true';
  process.env.WHATSAPP_LIVE_TEST_NUMBER = TEST_NUMBER;
  process.env.WHATSAPP_LESSON1_TEMPLATE_NAME = 'canary_template';
  process.env.WHATSAPP_LESSON1_TEMPLATE_LANGUAGE = 'en';
  jest.resetAllMocks();
  mockPrisma.$transaction.mockImplementation(async (callback) =>
    callback(mockPrisma));
  mockPrisma.$executeRaw.mockResolvedValue(1);
});

afterEach(() => {
  delete process.env.AUTOMATION_SECRET;
  delete process.env.WHATSAPP_LIVE_SEND_ENABLED;
  delete process.env.WHATSAPP_CANARY_WORKER_ENABLED;
  delete process.env.WHATSAPP_LIVE_TEST_NUMBER;
  delete process.env.WHATSAPP_LESSON1_TEMPLATE_NAME;
  delete process.env.WHATSAPP_LESSON1_TEMPLATE_LANGUAGE;
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('POST /api/automation/process-due-reminder-canary', () => {
  test('requires automation bearer authentication', async () => {
    const response = await request(makeApp())
      .post('/canary')
      .send({ liveSend: true });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ ok: false, error: 'UNAUTHORIZED' });
    expect(mockPrisma.automationEvent.findMany).not.toHaveBeenCalled();
    expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
  });

  test('requires both live-send and canary-worker gates', async () => {
    process.env.WHATSAPP_LIVE_SEND_ENABLED = 'false';
    let response = await canaryRequest(makeApp());

    expect(response.status).toBe(503);
    expect(response.body.error).toBe('WHATSAPP_LIVE_SEND_DISABLED');
    expect(mockPrisma.automationEvent.findMany).not.toHaveBeenCalled();

    jest.clearAllMocks();
    process.env.WHATSAPP_LIVE_SEND_ENABLED = 'true';
    process.env.WHATSAPP_CANARY_WORKER_ENABLED = 'false';
    response = await canaryRequest(makeApp());

    expect(response.status).toBe(503);
    expect(response.body.error).toBe('WHATSAPP_CANARY_WORKER_DISABLED');
    expect(mockPrisma.automationEvent.findMany).not.toHaveBeenCalled();
    expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
  });

  test('requires explicit liveSend:true and rejects unknown fields', async () => {
    let response = await canaryRequest(makeApp(), {});
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('LIVE_SEND_CONFIRMATION_REQUIRED');

    response = await canaryRequest(makeApp(), {
      liveSend: true,
      discover: true,
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('UNKNOWN_FIELDS');
    expect(mockPrisma.automationEvent.findMany).not.toHaveBeenCalled();
  });

  test('uses a bounded deterministic due scan', async () => {
    const dueEvents = [
      makeEvent(TARGET_ID, 1, TEST_NUMBER, {
        scheduledAt: new Date(Date.now() - 120_000),
      }),
      makeEvent(SECOND_TARGET_ID, 2, TEST_NUMBER, {
        scheduledAt: new Date(Date.now() - 60_000),
      }),
    ];
    mockPrisma.automationEvent.findMany.mockResolvedValue(dueEvents);
    configureEligibleUser(makeUser());
    configureLiveLifecycle(dueEvents[0]);

    const response = await canaryRequest(makeApp());

    expect(response.status).toBe(200);
    expect(response.body.scanLimit).toBe(10);
    expect(response.body.counts.sent).toBe(1);
    expect(mockPrisma.automationEvent.findMany).toHaveBeenCalledWith({
      where: {
        eventType: 'LESSON1_SIGNUP_REMINDER',
        status: 'PENDING',
        scheduledAt: { lte: expect.any(Date) },
      },
      orderBy: [
        { scheduledAt: 'asc' },
        { id: 'asc' },
      ],
      take: 10,
      select: {
        id: true,
        eventType: true,
        status: true,
        userId: true,
        scheduledAt: true,
        destinationNumberNormalized: true,
      },
    });
  });

  test('skips older excluded legacy rows without mutation or starvation', async () => {
    const legacy = makeEvent('33333333-3333-4333-8333-333333333333', 3, '+919988887777', {
      scheduledAt: new Date(Date.now() - 180_000),
    });
    const target = makeEvent(TARGET_ID, 1, TEST_NUMBER);
    mockPrisma.automationEvent.findMany.mockResolvedValue([legacy, target]);
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(makeUser({
        id: 3,
        consent: false,
        number: '+919988887777',
      }))
      .mockResolvedValue(makeUser());
    mockPrisma.user.findFirst.mockResolvedValue({ id: 1 });
    mockPrisma.user.findMany.mockResolvedValue([{
      has_access: false,
      whatsapp_opted_out_at: null,
    }]);
    mockPrisma.whatsAppPhoneSuppression.findUnique.mockResolvedValue(null);
    mockPrisma.lessonModeProgress.findUnique.mockResolvedValue(null);
    configureLiveLifecycle(target);

    const response = await canaryRequest(makeApp());

    expect(response.status).toBe(200);
    expect(response.body.counts).toMatchObject({
      examined: 2,
      skipped: 1,
      sent: 1,
      unconfirmed: 0,
    });
    expect(response.body.rows[0]).toMatchObject({
      automationEventId: legacy.id,
      status: 'PENDING',
      result: 'SKIPPED',
      reasonCode: 'CONSENT_FALSE',
      destination: '[masked]',
    });
    expect(response.body.rows[1]).toMatchObject({
      automationEventId: target.id,
      status: 'SENT',
      result: 'SENT',
      destination: '[masked]',
      whatsappSent: true,
    });
    expect(mockPrisma.automationEvent.updateMany).toHaveBeenCalledTimes(2);
    expect(mockSendWhatsAppTemplate).toHaveBeenCalledTimes(1);
  });

  test('enforces the canonical dedicated test number without mutation', async () => {
    const productionEvent = makeEvent(TARGET_ID, 1, '+918888888888');
    mockPrisma.automationEvent.findMany.mockResolvedValue([productionEvent]);
    configureEligibleUser(makeUser({ number: '+918888888888' }));

    const response = await canaryRequest(makeApp());

    expect(response.status).toBe(200);
    expect(response.body.rows).toEqual([expect.objectContaining({
      automationEventId: TARGET_ID,
      status: 'PENDING',
      result: 'SKIPPED',
      reasonCode: 'TEST_RECIPIENT_ONLY',
      destination: '[masked]',
      whatsappSent: false,
    })]);
    expect(mockPrisma.automationEvent.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
  });

  test('canonicalizes the configured test number before allowing a send', async () => {
    process.env.WHATSAPP_LIVE_TEST_NUMBER = '99999 99999';
    const event = makeEvent();
    mockPrisma.automationEvent.findMany.mockResolvedValue([event]);
    configureEligibleUser(makeUser({ number: TEST_NUMBER }));
    configureLiveLifecycle(event);

    const response = await canaryRequest(makeApp());

    expect(response.status).toBe(200);
    expect(response.body.counts.sent).toBe(1);
    expect(mockSendWhatsAppTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ to: TEST_NUMBER }),
    );
  });

  test('permits at most one actual send per invocation', async () => {
    const first = makeEvent(TARGET_ID);
    const second = makeEvent(SECOND_TARGET_ID);
    mockPrisma.automationEvent.findMany.mockResolvedValue([first, second]);
    configureEligibleUser(makeUser());
    configureLiveLifecycle(first);

    const response = await canaryRequest(makeApp());

    expect(response.status).toBe(200);
    expect(response.body.counts.sent).toBe(1);
    expect(response.body.rows).toHaveLength(1);
    expect(mockSendWhatsAppTemplate).toHaveBeenCalledTimes(1);
    expect(mockSendWhatsAppTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ automationEventId: TARGET_ID }),
    );
  });

  test('reuses the locked PENDING to SENDING to SENT lifecycle', async () => {
    const event = makeEvent();
    mockPrisma.automationEvent.findMany.mockResolvedValue([event]);
    configureEligibleUser();
    configureLiveLifecycle(event);

    const response = await canaryRequest(makeApp());

    expect(response.status).toBe(200);
    expect(response.body.rows[0]).toMatchObject({
      status: 'SENT',
      result: 'SENT',
      reasonCode: null,
      whatsappSent: true,
    });
    expect(mockPrisma.automationEvent.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: TARGET_ID, status: 'PENDING' },
        data: expect.objectContaining({ status: 'SENDING' }),
      }),
    );
    expect(mockPrisma.automationEvent.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: TARGET_ID, status: 'SENDING' },
        data: expect.objectContaining({
          status: 'SENT',
          providerMessageId: 'wamid.canary.test',
        }),
      }),
    );
    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  test('keeps provider uncertainty in SENDING and does not retry', async () => {
    const providerError = new Error('provider details must not escape');
    providerError.code = 'CANARY_PROVIDER_FAILURE';
    const event = makeEvent();
    mockPrisma.automationEvent.findMany.mockResolvedValue([event]);
    configureEligibleUser();
    configureLiveLifecycle(event, 'SENDING');
    mockSendWhatsAppTemplate.mockRejectedValue(providerError);

    const response = await canaryRequest(makeApp());

    expect(response.status).toBe(200);
    expect(response.body.rows[0]).toMatchObject({
      status: 'SENDING',
      result: 'UNCONFIRMED',
      reasonCode: 'WHATSAPP_SEND_UNCONFIRMED',
      whatsappSent: null,
    });
    expect(JSON.stringify(response.body)).not.toContain(
      'provider details must not escape',
    );
    expect(JSON.stringify(response.body)).not.toContain(
      'CANARY_PROVIDER_FAILURE',
    );
    expect(mockPrisma.automationEvent.updateMany).toHaveBeenCalledTimes(1);
    expect(mockSendWhatsAppTemplate).toHaveBeenCalledTimes(1);
  });

  test('does not call provider when any authoritative safety gate excludes a row', async () => {
    const cases = [
      ['consent', makeUser({ consent: false }), 'CONSENT_FALSE'],
      ['access', makeUser({ hasAccess: true }), 'USER_HAS_ACCESS'],
      ['name', makeUser({ name: null }), 'WHATSAPP_TEMPLATE_PARAMETER_MISSING'],
    ];

    for (const [_label, user, reasonCode] of cases) {
      jest.clearAllMocks();
      mockPrisma.automationEvent.findMany.mockResolvedValue([makeEvent()]);
      configureEligibleUser(user);

      const response = await canaryRequest(makeApp());

      expect(response.status).toBe(200);
      expect(response.body.rows[0].reasonCode).toBe(reasonCode);
      expect(mockPrisma.automationEvent.updateMany).not.toHaveBeenCalled();
      expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
    }
  });

  test('does not expose learner identity, full numbers, provider IDs, or payloads', async () => {
    const event = makeEvent();
    mockPrisma.automationEvent.findMany.mockResolvedValue([event]);
    configureEligibleUser(makeUser({
      name: 'Private Canary Learner',
      email: 'private-canary@example.test',
    }));
    configureLiveLifecycle(event);

    const response = await canaryRequest(makeApp());
    const serialized = JSON.stringify(response.body);

    expect(response.status).toBe(200);
    expect(serialized).not.toContain('Private Canary Learner');
    expect(serialized).not.toContain('private-canary@example.test');
    expect(serialized).not.toContain(TEST_NUMBER);
    expect(serialized).not.toContain('wamid.canary.test');
    expect(serialized).not.toContain('providerMessageId');
    expect(serialized).not.toContain('rawPayload');
    expect(serialized).toContain('[masked]');
  });

  test('does not process existing SENDING rows or reset them', async () => {
    const sendingEvent = makeEvent(TARGET_ID, 1, TEST_NUMBER, {
      status: 'SENDING',
    });
    mockPrisma.automationEvent.findMany.mockResolvedValue([]);
    configureEligibleUser();

    const response = await canaryRequest(makeApp());

    expect(response.status).toBe(200);
    expect(response.body.counts.examined).toBe(0);
    expect(mockPrisma.automationEvent.updateMany).not.toHaveBeenCalled();
    expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
    expect(sendingEvent.status).toBe('SENDING');
  });
});