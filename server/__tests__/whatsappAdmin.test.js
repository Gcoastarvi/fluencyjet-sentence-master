import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';

const mockPrisma = {
  user: { findMany: jest.fn() },
  automationEvent: { findMany: jest.fn() },
};
const broadcastBodies = [];
const workerBodies = [];
const reconcileCalls = [];
const mockBroadcastWorkerEnabled = jest.fn(() => false);
const mockLiveSendEnabled = jest.fn(() => false);

jest.unstable_mockModule('../db/client.js', () => ({ default: mockPrisma }));
jest.unstable_mockModule('../routes/automationProcessor.js', () => ({
  APPROVED_BROADCAST_TEMPLATES: {
    b1_fj_continue_practice_v1: {
      templateName: 'b1_fj_continue_practice_v1',
      languageCode: 'ta',
    },
  },
  createWhatsAppBroadcastHandler: jest.fn(() => async (req, res) => {
    broadcastBodies.push(req.body);
    return res.json({ ok: true, delegated: 'scheduler', body: req.body });
  }),
  createWhatsAppBroadcastWorkerHandler: jest.fn(() => async (req, res) => {
    workerBodies.push(req.body);
    return res.json({ ok: true, delegated: 'worker', body: req.body });
  }),
  isWhatsAppBroadcastWorkerEnabled: mockBroadcastWorkerEnabled,
  isWhatsAppLiveSendEnabled: mockLiveSendEnabled,
  reconcileSendingHandler: jest.fn(async (req, res, options) => {
    const now = new Date();
    reconcileCalls.push({
      body: req.body,
      idempotencyKey: req.get('Idempotency-Key'),
      freshGuard: options.validateLockedEvent({
        eventType: 'WHATSAPP_BROADCAST',
        processedAt: new Date(now.getTime() - 60 * 1000),
      }, now),
      oldGuard: options.validateLockedEvent({
        eventType: 'WHATSAPP_BROADCAST',
        processedAt: new Date(now.getTime() - 16 * 60 * 1000),
      }, now),
      missingGuard: options.validateLockedEvent({
        eventType: 'WHATSAPP_BROADCAST',
        processedAt: null,
      }, now),
    });
    return res.json({ ok: true, delegated: 'reconciliation' });
  }),
}));

const { default: whatsappAdminRouter } =
  await import('../routes/whatsappAdmin.js');

const JWT_SECRET = 'admin-test-jwt-secret';

function token(payload = { role: 'admin' }) {
  return jwt.sign(payload, JWT_SECRET);
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/whatsapp', whatsappAdminRouter);
  return app;
}

function adminRequest(method, path) {
  return request(makeApp())
    [method](path)
    .set('Authorization', `Bearer ${token()}`);
}

beforeEach(() => {
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';
  process.env.WHATSAPP_ACCESS_TOKEN = 'configured-token';
  process.env.WHATSAPP_GRAPH_API_VERSION = 'v20.0';
  process.env.WHATSAPP_LIVE_SEND_ENABLED = 'true';
  process.env.WHATSAPP_BROADCAST_WORKER_ENABLED = 'true';
  jest.clearAllMocks();
  mockBroadcastWorkerEnabled.mockReturnValue(true);
  mockLiveSendEnabled.mockReturnValue(true);
  broadcastBodies.length = 0;
  workerBodies.length = 0;
  reconcileCalls.length = 0;
  mockPrisma.user.findMany.mockResolvedValue([]);
  mockPrisma.automationEvent.findMany.mockResolvedValue([]);
});

describe('admin WhatsApp contract', () => {
  test('requires strict adminOnly JWT authorization', async () => {
    const response = await request(makeApp()).get('/api/admin/whatsapp/readiness');
    expect(response.status).toBe(401);
  });

  test('readiness contains only safe booleans and metadata', async () => {
    const response = await adminRequest('get', '/api/admin/whatsapp/readiness');
    expect(response.body).toMatchObject({
      ok: true,
      ready: true,
      provider: {
        phoneNumberIdConfigured: true,
        accessTokenConfigured: true,
        graphApiVersionConfigured: true,
      },
      gates: { liveSendEnabled: true, broadcastWorkerEnabled: true },
      approvedTemplates: [{
        name: 'b1_fj_continue_practice_v1',
        languageCode: 'ta',
        bodyParameters: ['learnerName'],
      }],
      blockers: [],
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('configured-token');
    expect(serialized).not.toContain('AUTOMATION_SECRET');
    expect(response.body.senderSettings).toBeUndefined();
  });

  test('source and inclusive date audience is bounded and delegated without exposing IDs', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 7 }, { id: 8 }]);
    const response = await adminRequest('post', '/api/admin/whatsapp/preview')
      .send({
        campaignKey: 'spring-2026',
        templateName: 'b1_fj_continue_practice_v1',
        source: 'webinar',
        from: '2026-01-01',
        to: '2026-01-31',
        scheduledAt: '2026-02-01T09:00:00.000Z',
      });
    expect(response.status).toBe(200);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        source: 'webinar',
        created_at: {
          gte: new Date('2026-01-01T00:00:00.000Z'),
          lte: new Date('2026-01-31T23:59:59.999Z'),
        },
      },
      take: 101,
    }));
    expect(broadcastBodies[0]).toEqual(expect.objectContaining({
      preview: true,
      userIds: [7, 8],
    }));
    expect(response.body.userIds).toBeUndefined();
  });

  test('direct IDs and source/date filters are mutually exclusive', async () => {
    const response = await adminRequest('post', '/api/admin/whatsapp/preview')
      .send({
        campaignKey: 'spring-2026',
        templateName: 'b1_fj_continue_practice_v1',
        userIds: [7],
        source: 'webinar',
        from: '2026-01-01',
        to: '2026-01-31',
        scheduledAt: '2026-02-01T09:00:00.000Z',
      });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('AUDIENCE_MODES_CONFLICT');
  });

  test('source audiences over 100 fail closed', async () => {
    mockPrisma.user.findMany.mockResolvedValue(
      Array.from({ length: 101 }, (_, id) => ({ id: id + 1 })),
    );
    const response = await adminRequest('post', '/api/admin/whatsapp/preview')
      .send({
        campaignKey: 'spring-2026',
        templateName: 'b1_fj_continue_practice_v1',
        source: 'webinar',
        from: '2026-01-01',
        to: '2026-01-31',
        scheduledAt: '2026-02-01T09:00:00.000Z',
      });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('AUDIENCE_TOO_LARGE');
    expect(broadcastBodies).toHaveLength(0);
  });

  test('campaign scheduling delegates exact scheduler contract', async () => {
    const response = await adminRequest('post', '/api/admin/whatsapp/campaigns')
      .send({
        campaignKey: 'spring-2026',
        templateName: 'b1_fj_continue_practice_v1',
        userIds: [7],
        scheduledAt: '2026-02-01T09:00:00.000Z',
      });
    expect(response.status).toBe(200);
    expect(broadcastBodies[0]).toEqual({
      campaignKey: 'spring-2026',
      templateName: 'b1_fj_continue_practice_v1',
      scheduledAt: '2026-02-01T09:00:00.000Z',
      preview: false,
      userIds: [7],
    });
  });

  test('process delegates both exact worker gates and body', async () => {
    const response = await adminRequest(
      'post',
      '/api/admin/whatsapp/campaigns/spring-2026/process',
    ).send({ limit: 7 });
    expect(response.status).toBe(200);
    expect(workerBodies[0]).toEqual({
      liveSend: true,
      campaignKey: 'spring-2026',
      limit: 7,
    });
  });

  test('campaign counts always include required statuses', async () => {
    mockPrisma.automationEvent.findMany.mockResolvedValue([
      { id: '1', campaignKey: 'spring-2026', status: 'PENDING' },
      { id: '2', campaignKey: 'spring-2026', status: 'FAILED' },
      { id: '3', campaignKey: 'spring-2026', status: 'CUSTOM_STATUS' },
    ]);
    const response = await adminRequest('get', '/api/admin/whatsapp/campaigns');
    expect(response.body.campaigns[0].counts).toMatchObject({
      total: 3,
      PENDING: 1,
      SENDING: 0,
      SENT: 0,
      CANCELLED: 0,
      FAILED: 1,
      CUSTOM_STATUS: 1,
    });
  });

  test('event history masks provider identifiers and marks quarantine eligibility', async () => {
    mockPrisma.automationEvent.findMany.mockResolvedValue([
      {
        id: 'event-1',
        userId: 7,
        status: 'SENDING',
        createdAt: new Date(),
        scheduledAt: null,
        processedAt: new Date(Date.now() - 16 * 60 * 1000),
        sentAt: null,
        cancelledAt: null,
        providerMessageId: 'wamid.secret',
        destinationNumberNormalized: '919876543210',
      },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 7, name: 'Naren' },
    ]);
    const response = await adminRequest(
      'get',
      '/api/admin/whatsapp/campaigns/spring-2026/events',
    );
    expect(response.body.events[0]).toMatchObject({
      id: 'event-1',
      userId: 7,
      learnerName: 'Naren',
      whatsappNumberMasked: '••••••••3210',
      status: 'SENDING',
      providerMessageIdPresent: true,
      quarantinable: true,
    });
    expect(JSON.stringify(response.body)).not.toContain('wamid.secret');
    expect(JSON.stringify(response.body)).not.toContain('919876543210');
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: { id: { in: [7] } },
      select: { id: true, name: true },
    });
  });

  test('quarantine injects exact reconciliation contract and idempotency header', async () => {
    const eventId = '11111111-1111-4111-8111-111111111111';
    const response = await adminRequest(
      'post',
      `/api/admin/whatsapp/events/${eventId}/quarantine`,
    ).send({
      campaignKey: 'spring-2026',
      idempotencyKey: 'quarantine-1',
    });
    expect(response.status).toBe(200);
    expect(reconcileCalls[0]).toEqual({
      body: {
        automationEventId: eventId,
        campaignKey: 'spring-2026',
        action: 'QUARANTINE',
        reasonCode: 'OUTCOME_UNKNOWN',
      },
      idempotencyKey: 'quarantine-1',
      freshGuard: {
        status: 409,
        body: { ok: false, error: 'BROADCAST_NOT_STUCK' },
      },
      oldGuard: null,
      missingGuard: {
        status: 409,
        body: { ok: false, error: 'BROADCAST_NOT_STUCK' },
      },
    });
  });
});