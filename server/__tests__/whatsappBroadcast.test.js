/**
 * Focused broadcast scheduling tests. Prisma and the provider are mocked;
 * this suite cannot send a WhatsApp message.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockPrisma = {
  automationEvent: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  spokenEnglishPurchase: {
    findFirst: jest.fn(),
  },
  whatsAppPhoneSuppression: {
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

const { createWhatsAppBroadcastHandler } =
  await import('../routes/automationProcessor.js');

const SECRET = 'broadcast-test-secret';
const AUTH = { Authorization: `Bearer ${SECRET}` };
const SCHEDULED_AT = '2026-09-13T09:00:00.000Z';
const TEMPLATE = 'b1_fj_continue_practice_v1';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.post(
    '/broadcast',
    createWhatsAppBroadcastHandler({ database: mockPrisma }),
  );
  return app;
}

function makeUser(overrides = {}) {
  return {
    id: 1,
    name: 'Learner',
    email: 'learner@example.test',
    whatsapp_consent: true,
    has_access: false,
    whatsapp_number_normalized: '+919876543210',
    whatsapp_opted_out_at: null,
    ...overrides,
  };
}

function configureUsers(users) {
  const byId = new Map(users.map((user) => [user.id, user]));
  mockPrisma.user.findMany.mockResolvedValue(
    users.map(({ id, whatsapp_number_normalized }) => ({
      id,
      whatsapp_number_normalized,
    })),
  );
  mockPrisma.user.findUnique.mockImplementation(
    async ({ where }) => byId.get(where.id) || null,
  );
  mockPrisma.user.findFirst.mockImplementation(async ({ where }) => {
    const user = byId.get(where.id);
    return user?.whatsapp_number_normalized ===
      where.whatsapp_number_normalized
      ? { id: user.id }
      : null;
  });
  mockPrisma.user.findMany.mockImplementation(async ({ where }) => {
    if (where?.id?.in) {
      return users
        .filter((user) => where.id.in.includes(user.id))
        .map(({ id, whatsapp_number_normalized }) => ({
          id,
          whatsapp_number_normalized,
        }));
    }
    return users
      .filter(
        (user) =>
          user.whatsapp_number_normalized ===
          where.whatsapp_number_normalized,
      )
      .map(({ has_access, whatsapp_opted_out_at }) => ({
        has_access,
        whatsapp_opted_out_at,
      }));
  });
}

function send(body) {
  return request(makeApp()).post('/broadcast').set(AUTH).send({
    campaignKey: 'continue-practice-2026-09-13',
    templateName: TEMPLATE,
    userIds: [1],
    scheduledAt: SCHEDULED_AT,
    preview: true,
    ...body,
  });
}

beforeEach(() => {
  process.env.AUTOMATION_SECRET = SECRET;
  jest.clearAllMocks();
  mockPrisma.automationEvent.findMany.mockResolvedValue([]);
  mockPrisma.automationEvent.create.mockResolvedValue({ id: 'scheduled-event' });
  mockPrisma.whatsAppPhoneSuppression.findUnique.mockResolvedValue(null);
  mockPrisma.spokenEnglishPurchase.findFirst.mockResolvedValue(null);
  configureUsers([makeUser()]);
});

describe('WhatsApp broadcast scheduling', () => {
  test('preview is read-only and selects the approved Tamil template', async () => {
    const response = await send({});

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      mode: 'preview',
      template: {
        name: TEMPLATE,
        languageCode: 'ta',
        bodyParameters: ['learnerName'],
      },
      counts: { eligible: 1, scheduled: 0 },
      whatsappSent: false,
    });
    expect(mockPrisma.automationEvent.create).not.toHaveBeenCalled();
    expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
  });

  test.each([
    ['CONSENT_FALSE', { whatsapp_consent: false }],
    ['USER_HAS_ACCESS', { has_access: true }],
    ['WHATSAPP_TEMPLATE_PARAMETER_MISSING', { name: ' ' }],
    ['INVALID_EVENT_DESTINATION', {
      whatsapp_number_normalized: 'not-a-phone',
    }],
    ['PHONE_OPTED_OUT', { whatsapp_opted_out_at: new Date() }],
  ])('excludes ineligible users: %s', async (reasonCode, override) => {
    configureUsers([makeUser(override)]);
    const response = await send({});

    expect(response.body.rows[0]).toMatchObject({
      decision: 'EXCLUDED',
      reasonCode,
    });
    expect(mockPrisma.automationEvent.create).not.toHaveBeenCalled();
  });

  test('excludes a captured Sentence Master purchaser', async () => {
    mockPrisma.spokenEnglishPurchase.findFirst.mockResolvedValue({
      id: 'captured-purchase',
    });

    const response = await send({});

    expect(response.body.rows[0]).toMatchObject({
      decision: 'EXCLUDED',
      reasonCode: 'USER_HAS_ACCESS',
    });
    expect(mockPrisma.automationEvent.create).not.toHaveBeenCalled();
    expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
  });

  test('protects against duplicate campaign/user scheduling', async () => {
    mockPrisma.automationEvent.findMany.mockResolvedValue([{
      id: 'existing-event',
      userId: 1,
      status: 'PENDING',
    }]);
    const response = await send({ preview: false });

    expect(response.body.rows[0]).toMatchObject({
      decision: 'EXCLUDED',
      reasonCode: 'ALREADY_SCHEDULED',
      automationEventId: 'existing-event',
    });
    expect(mockPrisma.automationEvent.create).not.toHaveBeenCalled();
  });

  test('rejects templates outside the approved registry', async () => {
    const response = await send({ templateName: 'arbitrary_template' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('TEMPLATE_NOT_APPROVED');
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  test('schedules one pending event without calling the provider', async () => {
    const response = await send({ preview: false, userIds: [1, 1] });

    expect(response.status).toBe(200);
    expect(response.body.counts).toMatchObject({
      requested: 2,
      uniqueUsers: 1,
      eligible: 1,
      scheduled: 1,
    });
    expect(mockPrisma.automationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 1,
        eventType: 'WHATSAPP_BROADCAST',
        campaignKey: 'continue-practice-2026-09-13',
        status: 'PENDING',
        destinationNumberNormalized: '+919876543210',
        payload: {
          broadcast: {
            templateName: TEMPLATE,
            languageCode: 'ta',
          },
        },
      }),
      select: { id: true },
    });
    expect(response.body.rows[0].automationEventId).toBe('scheduled-event');
    expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
  });
});