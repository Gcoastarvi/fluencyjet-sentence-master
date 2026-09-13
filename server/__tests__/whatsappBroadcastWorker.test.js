/**
 * Focused broadcast worker orchestration tests. The live handler, database,
 * and provider are mocked, so this suite cannot send a WhatsApp message.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockPrisma = {
  automationEvent: {
    findMany: jest.fn(),
  },
};
const mockSendWhatsAppTemplate = jest.fn();

jest.unstable_mockModule('../db/client.js', () => ({
  default: mockPrisma,
}));
jest.unstable_mockModule('../services/whatsappProvider.js', () => ({
  sendWhatsAppTemplate: mockSendWhatsAppTemplate,
}));

const { createWhatsAppBroadcastWorkerHandler } =
  await import('../routes/automationProcessor.js');

const SECRET = 'broadcast-worker-test-secret';
const AUTH = { Authorization: `Bearer ${SECRET}` };
const CAMPAIGN = 'b1_2026_09_12';

function makeLiveHandlerFactory(outcomes, calls) {
  return jest.fn(() => async (req, res) => {
    calls.push(req.body.automationEventId);
    const outcome = outcomes[req.body.automationEventId];
    return res.status(outcome.status || 200).json(outcome.body);
  });
}

function makeApp({
  outcomes = {},
  calls = [],
  liveEnabled = true,
  workerEnabled = true,
} = {}) {
  const app = express();
  app.use(express.json());
  app.post(
    '/worker',
    createWhatsAppBroadcastWorkerHandler({
      database: mockPrisma,
      sendTemplate: mockSendWhatsAppTemplate,
      isLiveSendEnabled: () => liveEnabled,
      isBroadcastWorkerEnabled: () => workerEnabled,
      liveHandlerFactory: makeLiveHandlerFactory(outcomes, calls),
    }),
  );
  return app;
}

function run(app, body = {}) {
  return request(app).post('/worker').set(AUTH).send({
    liveSend: true,
    campaignKey: CAMPAIGN,
    limit: 10,
    ...body,
  });
}

beforeEach(() => {
  process.env.AUTOMATION_SECRET = SECRET;
  jest.clearAllMocks();
  mockPrisma.automationEvent.findMany.mockResolvedValue([]);
});

describe('WhatsApp broadcast campaign worker', () => {
  test('discovers only due pending broadcasts for the explicit campaign and limit', async () => {
    const app = makeApp();
    const response = await run(app, { limit: 7 });

    expect(response.status).toBe(200);
    expect(mockPrisma.automationEvent.findMany).toHaveBeenCalledWith({
      where: {
        eventType: 'WHATSAPP_BROADCAST',
        campaignKey: CAMPAIGN,
        status: 'PENDING',
        scheduledAt: { lte: expect.any(Date) },
      },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
      take: 7,
      select: { id: true },
    });
    expect(response.body).toMatchObject({
      worker: 'WHATSAPP_BROADCAST',
      mode: 'live',
      campaignKey: CAMPAIGN,
      limit: 7,
      counts: { examined: 0, sent: 0, unconfirmed: 0 },
    });
    expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
  });

  test('processes candidates sequentially through the shared live handler', async () => {
    mockPrisma.automationEvent.findMany.mockResolvedValue([
      { id: 'event-1' },
      { id: 'event-2' },
      { id: 'event-3' },
    ]);
    const calls = [];
    const app = makeApp({
      calls,
      outcomes: {
        'event-1': { body: { result: 'SENT', whatsappSent: true } },
        'event-2': {
          body: {
            result: 'CANCELLED',
            skipReason: 'PHONE_OPTED_OUT',
            whatsappSent: false,
          },
        },
        'event-3': {
          body: { result: 'ALREADY_PROCESSED', whatsappSent: false },
        },
      },
    });

    const response = await run(app);

    expect(calls).toEqual(['event-1', 'event-2', 'event-3']);
    expect(response.body.counts).toEqual({
      examined: 3,
      skipped: 2,
      sent: 1,
      unconfirmed: 0,
    });
    expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
  });

  test('stops immediately after an unconfirmed provider outcome', async () => {
    mockPrisma.automationEvent.findMany.mockResolvedValue([
      { id: 'event-1' },
      { id: 'event-2' },
      { id: 'event-3' },
    ]);
    const calls = [];
    const app = makeApp({
      calls,
      outcomes: {
        'event-1': { body: { result: 'SENT', whatsappSent: true } },
        'event-2': {
          status: 502,
          body: {
            error: 'WHATSAPP_SEND_UNCONFIRMED',
            whatsappSent: null,
          },
        },
        'event-3': { body: { result: 'SENT', whatsappSent: true } },
      },
    });

    const response = await run(app);

    expect(calls).toEqual(['event-1', 'event-2']);
    expect(response.body.counts).toEqual({
      examined: 2,
      skipped: 0,
      sent: 1,
      unconfirmed: 1,
    });
    expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
  });

  test.each([
    [{ liveSend: false }, 400, 'LIVE_SEND_CONFIRMATION_REQUIRED'],
    [{ campaignKey: 'invalid campaign key' }, 400, 'INVALID_CAMPAIGN_KEY'],
    [{ limit: 0 }, 400, 'INVALID_LIMIT'],
    [{ limit: 101 }, 400, 'INVALID_LIMIT'],
  ])('fails closed for invalid request %#', async (body, status, error) => {
    const response = await run(makeApp(), body);

    expect(response.status).toBe(status);
    expect(response.body.error).toBe(error);
    expect(mockPrisma.automationEvent.findMany).not.toHaveBeenCalled();
  });

  test.each([
    [false, true, 'WHATSAPP_LIVE_SEND_DISABLED'],
    [true, false, 'WHATSAPP_BROADCAST_WORKER_DISABLED'],
  ])('requires both independent live gates %#', async (
    liveEnabled,
    workerEnabled,
    error,
  ) => {
    const response = await run(makeApp({ liveEnabled, workerEnabled }));

    expect(response.status).toBe(503);
    expect(response.body.error).toBe(error);
    expect(mockPrisma.automationEvent.findMany).not.toHaveBeenCalled();
    expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
  });
});