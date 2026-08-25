/**
 * Focused coverage for the manual Phase 14C rollout worker.
 * Prisma and the WhatsApp provider are mocked; no real message or database
 * connection can be used by this suite.
 */

import {
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

const { createRolloutReminderHandler } =
  await import('../routes/automationProcessor.js');

const SECRET = 'test-automation-secret-rollout';
const WATERMARK = '2026-08-25T10:00:00.000Z';
const TEST_NUMBER = '+919999999999';
const FIRST_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_ID = '22222222-2222-4222-8222-222222222222';

function makeApp(options = {}) {
  const app = express();
  app.use(express.json());
  app.post(
    '/rollout',
    createRolloutReminderHandler({
      database: mockPrisma,
      sendTemplate: mockSendWhatsAppTemplate,
      isRolloutWorkerEnabled: () => true,
      ...options,
    }),
  );
  return app;
}

function rolloutRequest(app, body) {
  return request(app)
    .post('/rollout')
    .set('Authorization', `Bearer ${SECRET}`)
    .send(body);
}

function makeEvent(
  id = FIRST_ID,
  userId = 1,
  destinationNumberNormalized = TEST_NUMBER,
  overrides = {},
) {
  return {
    id,
    userId,
    eventType: 'LESSON1_SIGNUP_REMINDER',
    status: 'PENDING',
    createdAt: new Date(WATERMARK),
    scheduledAt: new Date('2026-08-25T10:01:00.000Z'),
    destinationNumberNormalized,
    ...overrides,
  };
}

function makeUser(id = 1, number = TEST_NUMBER) {
  return {
    id,
    name: `Rollout User ${id}`,
    email: `rollout-${id}@example.test`,
    whatsapp_consent: true,
    has_access: false,
    whatsapp_number_normalized: number,
    whatsapp_opted_out_at: null,
  };
}

function configureEligibleEvent(event) {
  const user = makeUser(event.userId, event.destinationNumberNormalized);
  mockPrisma.user.findUnique.mockResolvedValue(user);
  mockPrisma.user.findFirst.mockResolvedValue({ id: user.id });
  mockPrisma.user.findMany.mockResolvedValue([{
    has_access: false,
    whatsapp_opted_out_at: null,
  }]);
  mockPrisma.whatsAppPhoneSuppression.findUnique.mockResolvedValue(null);
  mockPrisma.lessonModeProgress.findUnique.mockResolvedValue(null);
  mockPrisma.$executeRaw.mockResolvedValue(1);
  mockPrisma.$transaction.mockImplementation(async (callback) =>
    callback(mockPrisma));
  mockPrisma.automationEvent.updateMany.mockResolvedValue({ count: 1 });
  mockSendWhatsAppTemplate.mockResolvedValue({
    provider: 'mocked-provider',
    messageId: `wamid.rollout.${event.id}`,
  });
}

function configureLiveReads(events) {
  const readsById = new Map();
  mockPrisma.automationEvent.findUnique.mockImplementation(
    async ({ where, select } = {}) => {
      const event = events.find((candidate) => candidate.id === where?.id);
      if (select?.status) {
        return event ? { status: event.status === 'PENDING' ? 'SENT' : event.status } : null;
      }
      const readCount = (readsById.get(where?.id) || 0) + 1;
      readsById.set(where?.id, readCount);
      return readCount === 1
        ? event
        : { ...event, status: 'SENDING' };
    },
  );
}

beforeEach(() => {
  process.env.AUTOMATION_SECRET = SECRET;
  process.env.WHATSAPP_LESSON1_ROLLOUT_WATERMARK = WATERMARK;
  process.env.WHATSAPP_LIVE_SEND_ENABLED = 'false';
  process.env.WHATSAPP_CANARY_WORKER_ENABLED = 'false';
  process.env.WHATSAPP_ROLLOUT_WORKER_ENABLED = 'false';
  process.env.WHATSAPP_LESSON1_TEMPLATE_NAME = 'rollout_template';
  process.env.WHATSAPP_LESSON1_TEMPLATE_LANGUAGE = 'en';
  jest.resetAllMocks();
  mockPrisma.$transaction.mockImplementation(async (callback) =>
    callback(mockPrisma));
  mockPrisma.$executeRaw.mockResolvedValue(1);
});

afterEach(() => {
  for (const name of [
    'AUTOMATION_SECRET',
    'WHATSAPP_LESSON1_ROLLOUT_WATERMARK',
    'WHATSAPP_ROLLOUT_WATERMARK',
    'WHATSAPP_LIVE_SEND_ENABLED',
    'WHATSAPP_CANARY_WORKER_ENABLED',
    'WHATSAPP_ROLLOUT_WORKER_ENABLED',
    'WHATSAPP_LESSON1_TEMPLATE_NAME',
    'WHATSAPP_LESSON1_TEMPLATE_LANGUAGE',
  ]) {
    delete process.env[name];
  }
});

describe('manual Lesson 1 WhatsApp rollout worker', () => {
  test('fails closed before discovery when the watermark is missing', async () => {
    delete process.env.WHATSAPP_LESSON1_ROLLOUT_WATERMARK;

    const response = await rolloutRequest(makeApp(), { preview: true });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      ok: false,
      error: 'WHATSAPP_ROLLOUT_WATERMARK_NOT_CONFIGURED',
    });
    expect(mockPrisma.automationEvent.findMany).not.toHaveBeenCalled();
  });

  test('rejects invalid mode and unknown fields before database access', async () => {
    let response = await rolloutRequest(makeApp(), {
      preview: true,
      liveSend: true,
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('MODE_CONFLICT');

    response = await rolloutRequest(makeApp(), {
      preview: true,
      unexpected: true,
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('UNKNOWN_FIELDS');
    expect(mockPrisma.automationEvent.findMany).not.toHaveBeenCalled();
  });

  test('discovers only due events at or after the createdAt watermark', async () => {
    const event = makeEvent();
    mockPrisma.automationEvent.findMany.mockResolvedValue([event]);

    const response = await rolloutRequest(makeApp(), {
      preview: true,
      limit: 2,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      worker: 'LESSON1_SIGNUP_REMINDER_ROLLOUT',
      mode: 'preview',
      dryRun: true,
      rolloutWatermark: WATERMARK,
      limit: 2,
    });
    expect(mockPrisma.automationEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          eventType: 'LESSON1_SIGNUP_REMINDER',
          status: 'PENDING',
          createdAt: { gte: new Date(WATERMARK) },
          scheduledAt: { lte: expect.any(Date) },
        },
        orderBy: [
          { createdAt: 'asc' },
          { id: 'asc' },
        ],
        take: 3,
      }),
    );
  });

  test('preview is read-only and rejects a missing immutable destination', async () => {
    const event = makeEvent(FIRST_ID, 1, null);
    mockPrisma.automationEvent.findMany.mockResolvedValue([event]);

    const response = await rolloutRequest(makeApp(), {
      preview: true,
    });

    expect(response.status).toBe(200);
    expect(response.body.counts).toEqual({
      examined: 1,
      skipped: 1,
      sent: 0,
      unconfirmed: 0,
    });
    expect(response.body.rows[0]).toMatchObject({
      result: 'SKIPPED',
      reasonCode: 'MISSING_EVENT_DESTINATION',
      whatsappSent: false,
    });
    expect(mockPrisma.automationEvent.updateMany).not.toHaveBeenCalled();
    expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
  });

  test('live mode uses the rollout gate, ignores canary/live gates, and sends at most once', async () => {
    const first = makeEvent(FIRST_ID, 1);
    const second = makeEvent(SECOND_ID, 2, '+919888888888');
    mockPrisma.automationEvent.findMany.mockResolvedValue([first, second]);
    configureEligibleEvent(first);
    configureLiveReads([first, second]);

    const response = await rolloutRequest(makeApp(), {
      liveSend: true,
      limit: 2,
    });

    expect(response.status).toBe(200);
    expect(response.body.mode).toBe('live');
    expect(response.body.counts).toEqual({
      examined: 1,
      skipped: 0,
      sent: 1,
      unconfirmed: 0,
    });
    expect(response.body.rows[0]).toMatchObject({
      automationEventId: FIRST_ID,
      result: 'SENT',
      whatsappSent: true,
      destination: '[masked]',
    });
    expect(mockSendWhatsAppTemplate).toHaveBeenCalledTimes(1);
    expect(mockSendWhatsAppTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ to: TEST_NUMBER }),
    );
  });

  test('stops after a post-dispatch transaction failure instead of trying another candidate', async () => {
    const first = makeEvent(FIRST_ID, 1);
    const second = makeEvent(SECOND_ID, 2, '+919888888888');
    mockPrisma.automationEvent.findMany.mockResolvedValue([first, second]);
    configureEligibleEvent(first);
    configureLiveReads([first, second]);
    mockPrisma.$transaction.mockImplementation(async (callback) => {
      await callback(mockPrisma);
      throw new Error('transaction outcome is unknown');
    });

    const response = await rolloutRequest(makeApp(), {
      liveSend: true,
      limit: 2,
    });

    expect(response.status).toBe(200);
    expect(response.body.counts).toEqual({
      examined: 1,
      skipped: 0,
      sent: 0,
      unconfirmed: 1,
    });
    expect(response.body.rows).toEqual([
      expect.objectContaining({
        automationEventId: FIRST_ID,
        result: 'UNCONFIRMED',
        reasonCode: 'ROLLOUT_PROCESSING_UNKNOWN',
        whatsappSent: null,
      }),
    ]);
    expect(mockSendWhatsAppTemplate).toHaveBeenCalledTimes(1);
  });

  test('live mode fails closed when its worker gate is disabled', async () => {
    const response = await rolloutRequest(
      makeApp({ isRolloutWorkerEnabled: () => false }),
      { liveSend: true },
    );

    expect(response.status).toBe(503);
    expect(response.body.error).toBe('WHATSAPP_ROLLOUT_WORKER_DISABLED');
    expect(mockPrisma.automationEvent.findMany).not.toHaveBeenCalled();
  });
});