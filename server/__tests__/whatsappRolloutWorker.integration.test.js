/**
 * PostgreSQL coverage for the manual rollout worker. Route clients connect
 * only to TEST_DATABASE_URL; DATABASE_URL is used only for a sanitized
 * same-target guard before any fixture is written.
 */

import crypto from 'crypto';
import express from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { acquireWhatsAppDestinationLock } from '../lib/whatsappDestinationLock.js';

jest.setTimeout(45_000);

function requiredTestDatabaseUrl() {
  const value = String(process.env.TEST_DATABASE_URL || '').trim();
  if (!value) {
    throw new Error(
      'TEST_DATABASE_URL is required for rollout worker integration tests.',
    );
  }
  return value;
}

function targetFingerprint(connectionString) {
  const url = new URL(connectionString);
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      protocol: url.protocol,
      host: url.hostname.toLowerCase(),
      port: url.port || '5432',
      database: decodeURIComponent(url.pathname).replace(/^\/+/, ''),
    }))
    .digest('hex');
}

function verifyDistinctTargets(testDatabaseUrl, productionDatabaseUrl) {
  if (targetFingerprint(testDatabaseUrl) === targetFingerprint(productionDatabaseUrl)) {
    throw new Error('TEST_DATABASE_URL must not target DATABASE_URL.');
  }
}

function verifyIsolatedTarget(testDatabaseUrl) {
  const productionDatabaseUrl = String(process.env.DATABASE_URL || '').trim();
  if (!productionDatabaseUrl) {
    throw new Error(
      'DATABASE_URL is required only to verify TEST_DATABASE_URL isolation.',
    );
  }
  verifyDistinctTargets(testDatabaseUrl, productionDatabaseUrl);
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitFor(condition, message, timeoutMilliseconds = 6_000) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(message);
}

const testDatabaseUrl = requiredTestDatabaseUrl();
verifyIsolatedTarget(testDatabaseUrl);

const controlClient = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});
const rolloutClient = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});
const webhookClient = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});
const lockClient = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});
const defaultProvider = jest.fn(() => {
  throw new Error('The default provider must never run in rollout tests.');
});

jest.unstable_mockModule('../db/client.js', () => ({
  default: webhookClient,
}));
jest.unstable_mockModule('../services/whatsappProvider.js', () => ({
  sendWhatsAppTemplate: defaultProvider,
}));

const { createRolloutReminderHandler } =
  await import('../routes/automationProcessor.js');
const { default: webhookRouter } =
  await import('../routes/webhookWhatsApp.js');

const originalEnvironment = {
  automationSecret: process.env.AUTOMATION_SECRET,
  metaAppSecret: process.env.META_APP_SECRET,
  liveSendEnabled: process.env.WHATSAPP_LIVE_SEND_ENABLED,
  canaryEnabled: process.env.WHATSAPP_CANARY_WORKER_ENABLED,
  rolloutEnabled: process.env.WHATSAPP_ROLLOUT_WORKER_ENABLED,
  rolloutWatermark: process.env.WHATSAPP_LESSON1_ROLLOUT_WATERMARK,
  templateName: process.env.WHATSAPP_LESSON1_TEMPLATE_NAME,
  templateLanguage: process.env.WHATSAPP_LESSON1_TEMPLATE_LANGUAGE,
};

const automationSecret = 'rollout-worker-integration-secret';
const metaAppSecret = 'rollout-worker-meta-secret';
const runToken = crypto.randomInt(100_000_000, 999_999_999).toString();
const testUserIds = new Set();
const testEventIds = new Set();
const testNumbers = new Set();
const testInboundMessageIds = new Set();

function makeApp(provider = jest.fn()) {
  const app = express();
  app.use('/api/webhooks', webhookRouter);
  app.use(express.json());
  app.post(
    '/api/automation/process-due-reminder-rollout',
    createRolloutReminderHandler({
      database: rolloutClient,
      sendTemplate: provider,
    }),
  );
  return app;
}

function rolloutRequest(app, body) {
  return request(app)
    .post('/api/automation/process-due-reminder-rollout')
    .set('Authorization', `Bearer ${automationSecret}`)
    .send(body)
    .then((response) => response);
}

function numberFor(index) {
  const number = `+1995${runToken}${index}`;
  testNumbers.add(number);
  return number;
}

async function createUser(index, {
  number = numberFor(index),
  name = `Rollout Integration User ${index}`,
} = {}) {
  testNumbers.add(number);
  const user = await controlClient.user.create({
    data: {
      name,
      email: `rollout-${runToken}-${index}@example.test`,
      password: 'not-a-real-password',
      whatsapp_number: number,
      whatsapp_number_normalized: number,
      whatsapp_consent: true,
      whatsapp_consent_at: new Date(),
      has_access: false,
    },
  });
  testUserIds.add(user.id);
  return user;
}

async function createEvent(user, {
  eventType = 'LESSON1_SIGNUP_REMINDER',
  createdAt = new Date(),
  scheduledAt = new Date(Date.now() - 60_000),
  destinationNumberNormalized = user.whatsapp_number_normalized,
} = {}) {
  const event = await controlClient.automationEvent.create({
    data: {
      id: crypto.randomUUID(),
      userId: user.id,
      eventType,
      status: 'PENDING',
      createdAt,
      scheduledAt,
      destinationNumberNormalized,
      payload: {
        privateEmail: user.email,
        rawProviderPayload: `private-${runToken}`,
      },
    },
  });
  testEventIds.add(event.id);
  return event;
}

async function cleanup() {
  const eventIds = [...testEventIds];
  const userIds = [...testUserIds];
  const numbers = [...testNumbers];
  const inboundMessageIds = [...testInboundMessageIds];

  if (inboundMessageIds.length) {
    await controlClient.whatsAppMessageEvent.deleteMany({
      where: { providerMessageId: { in: inboundMessageIds } },
    });
  }
  if (numbers.length) {
    await controlClient.whatsAppPhoneSuppression.deleteMany({
      where: { phoneNumberNormalized: { in: numbers } },
    });
  }
  if (eventIds.length) {
    await controlClient.automationEvent.deleteMany({
      where: { id: { in: eventIds } },
    });
  }
  if (userIds.length) {
    await controlClient.user.deleteMany({ where: { id: { in: userIds } } });
  }

  testEventIds.clear();
  testUserIds.clear();
  testNumbers.clear();
  testInboundMessageIds.clear();
}

function signPayload(rawBody) {
  return (
    'sha256=' +
    crypto
      .createHmac('sha256', metaAppSecret)
      .update(Buffer.from(rawBody, 'utf8'))
      .digest('hex')
  );
}

function postStop(app, number) {
  const providerMessageId =
    `wamid.rollout.stop.${runToken}.${testInboundMessageIds.size}`;
  testInboundMessageIds.add(providerMessageId);
  const rawBody = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{
      id: 'rollout-test-waba',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '199900000000',
            phone_number_id: 'rollout-test-phone',
          },
          messages: [{
            from: number.slice(1),
            id: providerMessageId,
            timestamp: '1787043600',
            type: 'text',
            text: { body: 'STOP' },
          }],
        },
      }],
    }],
  });

  return request(app)
    .post('/api/webhooks/whatsapp')
    .set('Content-Type', 'application/json')
    .set('X-Hub-Signature-256', signPayload(rawBody))
    .send(rawBody)
    .then((response) => response);
}

beforeAll(async () => {
  process.env.AUTOMATION_SECRET = automationSecret;
  process.env.META_APP_SECRET = metaAppSecret;
  process.env.WHATSAPP_LIVE_SEND_ENABLED = 'false';
  process.env.WHATSAPP_CANARY_WORKER_ENABLED = 'false';
  process.env.WHATSAPP_ROLLOUT_WORKER_ENABLED = 'false';
  process.env.WHATSAPP_LESSON1_TEMPLATE_NAME = 'rollout_template';
  process.env.WHATSAPP_LESSON1_TEMPLATE_LANGUAGE = 'en';
  await Promise.all([
    controlClient.$connect(),
    rolloutClient.$connect(),
    webhookClient.$connect(),
    lockClient.$connect(),
  ]);
});

beforeEach(() => {
  process.env.WHATSAPP_LIVE_SEND_ENABLED = 'false';
  process.env.WHATSAPP_ROLLOUT_WORKER_ENABLED = 'false';
});

afterEach(async () => {
  await cleanup();
  jest.clearAllMocks();
});

afterAll(async () => {
  await cleanup();
  await Promise.all([
    controlClient.$disconnect(),
    rolloutClient.$disconnect(),
    webhookClient.$disconnect(),
    lockClient.$disconnect(),
  ]);

  for (const [name, value] of Object.entries({
    AUTOMATION_SECRET: originalEnvironment.automationSecret,
    META_APP_SECRET: originalEnvironment.metaAppSecret,
    WHATSAPP_LIVE_SEND_ENABLED: originalEnvironment.liveSendEnabled,
    WHATSAPP_CANARY_WORKER_ENABLED: originalEnvironment.canaryEnabled,
    WHATSAPP_ROLLOUT_WORKER_ENABLED: originalEnvironment.rolloutEnabled,
    WHATSAPP_LESSON1_ROLLOUT_WATERMARK: originalEnvironment.rolloutWatermark,
    WHATSAPP_LESSON1_TEMPLATE_NAME: originalEnvironment.templateName,
    WHATSAPP_LESSON1_TEMPLATE_LANGUAGE: originalEnvironment.templateLanguage,
  })) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe('manual rollout worker PostgreSQL integration', () => {
  test('has an explicit same-target test database guard', () => {
    expect(() => verifyDistinctTargets(
      'postgresql://user:secret@example.test:5432/rollout_test',
      'postgresql://another:secret@example.test:5432/rollout_test',
    )).toThrow('TEST_DATABASE_URL must not target DATABASE_URL.');
  });

  test('global live gate blocks before discovery when rollout gate is enabled', async () => {
    process.env.WHATSAPP_ROLLOUT_WORKER_ENABLED = 'true';
    process.env.WHATSAPP_LESSON1_ROLLOUT_WATERMARK =
      new Date(Date.now() - 30 * 60_000).toISOString();
    const provider = jest.fn(() => {
      throw new Error('Provider must not run while global live sending is disabled.');
    });
    const findManySpy = jest.spyOn(rolloutClient.automationEvent, 'findMany');
    const updateManySpy = jest.spyOn(rolloutClient.automationEvent, 'updateMany');
    const transactionSpy = jest.spyOn(rolloutClient, '$transaction');

    try {
      const response = await rolloutRequest(makeApp(provider), { liveSend: true });

      expect(response.status).toBe(503);
      expect(response.body.error).toBe('WHATSAPP_LIVE_SEND_DISABLED');
      expect(findManySpy).not.toHaveBeenCalled();
      expect(updateManySpy).not.toHaveBeenCalled();
      expect(transactionSpy).not.toHaveBeenCalled();
      expect(provider).not.toHaveBeenCalled();
    } finally {
      findManySpy.mockRestore();
      updateManySpy.mockRestore();
      transactionSpy.mockRestore();
    }
  });

  test('rollout gate blocks before discovery when global live gate is enabled', async () => {
    process.env.WHATSAPP_LIVE_SEND_ENABLED = 'true';
    process.env.WHATSAPP_LESSON1_ROLLOUT_WATERMARK =
      new Date(Date.now() - 30 * 60_000).toISOString();
    const provider = jest.fn(() => {
      throw new Error('Provider must not run while rollout sending is disabled.');
    });
    const findManySpy = jest.spyOn(rolloutClient.automationEvent, 'findMany');
    const updateManySpy = jest.spyOn(rolloutClient.automationEvent, 'updateMany');
    const transactionSpy = jest.spyOn(rolloutClient, '$transaction');

    try {
      const response = await rolloutRequest(makeApp(provider), { liveSend: true });

      expect(response.status).toBe(503);
      expect(response.body.error).toBe('WHATSAPP_ROLLOUT_WORKER_DISABLED');
      expect(findManySpy).not.toHaveBeenCalled();
      expect(updateManySpy).not.toHaveBeenCalled();
      expect(transactionSpy).not.toHaveBeenCalled();
      expect(provider).not.toHaveBeenCalled();
    } finally {
      findManySpy.mockRestore();
      updateManySpy.mockRestore();
      transactionSpy.mockRestore();
    }
  });

  test('ignores pre-watermark backlog and leaves preview candidates unchanged', async () => {
    const now = Date.now();
    const watermark = new Date(now - 30 * 60_000);
    process.env.WHATSAPP_LESSON1_ROLLOUT_WATERMARK = watermark.toISOString();
    const app = makeApp();
    const historicalUser = await createUser(1);
    const previewUser = await createUser(2);
    const historicalEvent = await createEvent(historicalUser, {
      createdAt: new Date(watermark.getTime() - 1),
    });
    const previewEvent = await createEvent(previewUser, {
      createdAt: watermark,
    });

    const before = await controlClient.automationEvent.findMany({
      where: { id: { in: [historicalEvent.id, previewEvent.id] } },
      select: { id: true, status: true, processedAt: true, sentAt: true },
    });
    const response = await rolloutRequest(app, { preview: true, limit: 10 });
    const after = await controlClient.automationEvent.findMany({
      where: { id: { in: [historicalEvent.id, previewEvent.id] } },
      select: { id: true, status: true, processedAt: true, sentAt: true },
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      mode: 'preview',
      dryRun: true,
      rolloutWatermark: watermark.toISOString(),
      counts: {
        examined: 1,
        sent: 0,
      },
    });
    expect(response.body.rows).toEqual([
      expect.objectContaining({
        automationEventId: previewEvent.id,
        result: 'ELIGIBLE',
        destination: '[masked]',
      }),
    ]);
    expect(JSON.stringify(response.body)).not.toContain(previewUser.email);
    expect(JSON.stringify(response.body)).not.toContain(
      previewUser.whatsapp_number_normalized,
    );
    expect(after).toEqual(before);
  });

  test('sends no more than one rollout candidate per invocation', async () => {
    process.env.WHATSAPP_LIVE_SEND_ENABLED = 'true';
    process.env.WHATSAPP_ROLLOUT_WORKER_ENABLED = 'true';
    const watermark = new Date(Date.now() - 30 * 60_000);
    process.env.WHATSAPP_LESSON1_ROLLOUT_WATERMARK = watermark.toISOString();
    const provider = jest.fn().mockResolvedValue({
      provider: 'mocked-provider',
      messageId: `wamid.rollout.${runToken}.sent`,
    });
    const app = makeApp(provider);
    const firstUser = await createUser(3);
    const secondUser = await createUser(4);
    const firstEvent = await createEvent(firstUser, {
      createdAt: watermark,
    });
    const secondEvent = await createEvent(secondUser, {
      createdAt: new Date(watermark.getTime() + 1),
    });

    const response = await rolloutRequest(app, { liveSend: true, limit: 10 });
    const events = await controlClient.automationEvent.findMany({
      where: { id: { in: [firstEvent.id, secondEvent.id] } },
      select: { id: true, status: true, providerMessageId: true },
    });

    expect(response.status).toBe(200);
    expect(response.body.counts).toEqual({
      examined: 1,
      skipped: 0,
      sent: 1,
      unconfirmed: 0,
    });
    expect(response.body.rows).toEqual([
      expect.objectContaining({
        automationEventId: firstEvent.id,
        result: 'SENT',
        destination: '[masked]',
      }),
    ]);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: firstEvent.id,
        status: 'SENT',
        providerMessageId: `wamid.rollout.${runToken}.sent`,
      }),
      expect.objectContaining({
        id: secondEvent.id,
        status: 'PENDING',
        providerMessageId: null,
      }),
    ]));
  });

  test('cancels a bad first limit-one candidate so the next run can process the later row', async () => {
    process.env.WHATSAPP_LIVE_SEND_ENABLED = 'true';
    process.env.WHATSAPP_ROLLOUT_WORKER_ENABLED = 'true';
    const watermark = new Date(Date.now() - 30 * 60_000);
    process.env.WHATSAPP_LESSON1_ROLLOUT_WATERMARK = watermark.toISOString();
    const provider = jest.fn().mockResolvedValue({
      provider: 'mocked-provider',
      messageId: `wamid.rollout.${runToken}.starvation`,
    });
    const app = makeApp(provider);
    const badUser = await createUser(6);
    const eligibleUser = await createUser(7);
    const badEvent = await createEvent(badUser, {
      eventType: 'LEARNING_PATH_DISCOVERY_REMINDER',
      createdAt: watermark,
      destinationNumberNormalized: null,
    });
    const eligibleEvent = await createEvent(eligibleUser, {
      createdAt: new Date(watermark.getTime() + 1),
    });

    const firstResponse = await rolloutRequest(app, {
      liveSend: true,
      limit: 1,
    });
    const retired = await controlClient.automationEvent.findUnique({
      where: { id: badEvent.id },
      select: { status: true, cancelledAt: true, processedAt: true },
    });

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body).toMatchObject({
      counts: {
        examined: 1,
        skipped: 1,
        sent: 0,
        unconfirmed: 0,
      },
      rows: [
        expect.objectContaining({
          automationEventId: badEvent.id,
          status: 'CANCELLED',
          result: 'SKIPPED',
          reasonCode: 'MISSING_EVENT_DESTINATION',
          whatsappSent: false,
        }),
      ],
    });
    expect(retired.status).toBe('CANCELLED');
    expect(retired.cancelledAt).not.toBeNull();
    expect(retired.processedAt).not.toBeNull();
    expect(provider).not.toHaveBeenCalled();

    const secondResponse = await rolloutRequest(app, {
      liveSend: true,
      limit: 1,
    });
    const eligible = await controlClient.automationEvent.findUnique({
      where: { id: eligibleEvent.id },
      select: { status: true, providerMessageId: true },
    });

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.rows).toEqual([
      expect.objectContaining({
        automationEventId: eligibleEvent.id,
        result: 'SENT',
        status: 'SENT',
        whatsappSent: true,
      }),
    ]);
    expect(eligible).toEqual({
      status: 'SENT',
      providerMessageId: `wamid.rollout.${runToken}.starvation`,
    });
    expect(provider).toHaveBeenCalledTimes(1);
  });

  test('serializes STOP ahead of rollout provider dispatch', async () => {
    process.env.WHATSAPP_LIVE_SEND_ENABLED = 'true';
    process.env.WHATSAPP_ROLLOUT_WORKER_ENABLED = 'true';
    const watermark = new Date(Date.now() - 30 * 60_000);
    process.env.WHATSAPP_LESSON1_ROLLOUT_WATERMARK = watermark.toISOString();
    const fixtureUser = await createUser(5);
    const fixtureEvent = await createEvent(fixtureUser, { createdAt: watermark });
    const entered = deferred();
    const release = deferred();
    const provider = jest.fn(() => {
      throw new Error('Rollout provider must not run after STOP.');
    });
    const app = makeApp(provider);
    const destination = fixtureUser.whatsapp_number_normalized;
    const heldLock = lockClient.$transaction(async (tx) => {
      await acquireWhatsAppDestinationLock(tx, destination);
      entered.resolve();
      await release.promise;
    }, { timeout: 30_000 });

    try {
      await entered.promise;
      const stopRequest = postStop(app, destination);
      await waitFor(async () => {
        const rows = await controlClient.$queryRaw`
          SELECT count(*)::int AS count
          FROM pg_locks
          WHERE locktype = 'advisory' AND NOT granted
        `;
        return Number(rows[0].count) > 0;
      }, 'Expected STOP to wait for the held destination lock.');

      const rolloutPromise = rolloutRequest(app, { liveSend: true });
      await waitFor(async () => {
        const event = await controlClient.automationEvent.findUnique({
          where: { id: fixtureEvent.id },
          select: { status: true },
        });
        return event?.status === 'SENDING';
      }, 'Expected rollout to commit PENDING -> SENDING.');
      expect(provider).not.toHaveBeenCalled();

      release.resolve();
      const [stopResponse, rolloutResponse] = await Promise.all([
        stopRequest,
        rolloutPromise,
      ]);
      const event = await controlClient.automationEvent.findUnique({
        where: { id: fixtureEvent.id },
        select: { status: true, providerMessageId: true },
      });

      expect(stopResponse.status).toBe(200);
      expect(rolloutResponse.status).toBe(200);
      expect(rolloutResponse.body.rows[0]).toMatchObject({
        automationEventId: fixtureEvent.id,
        status: 'CANCELLED',
        result: 'SKIPPED',
        reasonCode: 'CONSENT_FALSE',
        whatsappSent: false,
      });
      expect(event).toEqual({ status: 'CANCELLED', providerMessageId: null });
      expect(provider).not.toHaveBeenCalled();
    } finally {
      release.resolve();
      await heldLock;
    }
  });
});