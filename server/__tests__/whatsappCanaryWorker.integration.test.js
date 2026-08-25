/**
 * PostgreSQL coverage for the manual Phase 14B canary worker.
 * All application clients use TEST_DATABASE_URL and the provider is mocked.
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
import { normalizeWhatsAppNumber } from '../lib/whatsappNumber.js';

jest.setTimeout(45_000);

function requiredTestDatabaseUrl() {
  const value = String(process.env.TEST_DATABASE_URL || '').trim();
  if (!value) {
    throw new Error(
      'TEST_DATABASE_URL is required for canary worker integration tests.',
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

function verifyIsolatedTarget(testDatabaseUrl) {
  const productionDatabaseUrl = String(process.env.DATABASE_URL || '').trim();
  if (!productionDatabaseUrl) {
    throw new Error(
      'DATABASE_URL is required only to verify TEST_DATABASE_URL isolation.',
    );
  }
  if (
    targetFingerprint(testDatabaseUrl) ===
    targetFingerprint(productionDatabaseUrl)
  ) {
    throw new Error('TEST_DATABASE_URL must not target DATABASE_URL.');
  }
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
const liveClient = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});
const webhookClient = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});
const lockClient = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});
const defaultProvider = jest.fn(() => {
  throw new Error('The default provider must never run in canary tests.');
});

jest.unstable_mockModule('../db/client.js', () => ({
  default: webhookClient,
}));
jest.unstable_mockModule('../services/whatsappProvider.js', () => ({
  sendWhatsAppTemplate: defaultProvider,
}));

const { createCanaryReminderHandler } =
  await import('../routes/automationProcessor.js');
const { default: webhookRouter } =
  await import('../routes/webhookWhatsApp.js');

const originalEnvironment = {
  automationSecret: process.env.AUTOMATION_SECRET,
  metaAppSecret: process.env.META_APP_SECRET,
  webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
  liveSendEnabled: process.env.WHATSAPP_LIVE_SEND_ENABLED,
  canaryEnabled: process.env.WHATSAPP_CANARY_WORKER_ENABLED,
  liveTestNumber: process.env.WHATSAPP_LIVE_TEST_NUMBER,
  templateName: process.env.WHATSAPP_LESSON1_TEMPLATE_NAME,
  templateLanguage: process.env.WHATSAPP_LESSON1_TEMPLATE_LANGUAGE,
};

const automationSecret = 'canary-worker-integration-secret';
const metaAppSecret = 'canary-worker-meta-secret';
const testNumber = '+919999999999';
const runToken = crypto.randomInt(100_000_000, 999_999_999).toString();
const testUserIds = new Set();
const testEventIds = new Set();
const testInboundMessageIds = new Set();
const testNumbers = new Set();

function makeApp(provider = jest.fn()) {
  const app = express();
  app.use('/api/webhooks', webhookRouter);
  app.use(express.json());
  app.post(
    '/api/automation/process-due-reminder-canary',
    createCanaryReminderHandler({
      database: liveClient,
      sendTemplate: provider,
      isLiveSendEnabled: () => true,
      isCanaryWorkerEnabled: () => true,
    }),
  );
  return app;
}

function canaryRequest(app, body = { liveSend: true }) {
  return request(app)
    .post('/api/automation/process-due-reminder-canary')
    .set('Authorization', `Bearer ${automationSecret}`)
    .send(body)
    .then((response) => response);
}

function numberFor(index) {
  const number = `+1997${runToken}${index}`;
  testNumbers.add(number);
  return number;
}

async function createUser(index, {
  number = numberFor(index),
  name = `Canary Integration User ${index}`,
  consent = true,
  hasAccess = false,
  optedOutAt = null,
} = {}) {
  testNumbers.add(number);
  const user = await controlClient.user.create({
    data: {
      name,
      email: `canary-${runToken}-${index}@example.test`,
      password: 'not-a-real-password',
      whatsapp_number: number,
      whatsapp_number_normalized: number,
      whatsapp_consent: consent,
      whatsapp_consent_at: consent ? new Date() : null,
      whatsapp_opted_out_at: optedOutAt,
      has_access: hasAccess,
    },
  });
  testUserIds.add(user.id);
  return user;
}

async function createEvent(user, {
  scheduledAt = new Date(Date.now() - 60_000),
  destinationNumberNormalized = user.whatsapp_number_normalized,
} = {}) {
  const event = await controlClient.automationEvent.create({
    data: {
      id: crypto.randomUUID(),
      userId: user.id,
      eventType: 'LESSON1_SIGNUP_REMINDER',
      status: 'PENDING',
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

async function snapshot() {
  const [events, users, suppressions, messages] = await Promise.all([
    controlClient.automationEvent.findMany({
      where: { id: { in: [...testEventIds] } },
      orderBy: { id: 'asc' },
    }),
    controlClient.user.findMany({
      where: { id: { in: [...testUserIds] } },
      orderBy: { id: 'asc' },
    }),
    controlClient.whatsAppPhoneSuppression.findMany({
      where: { phoneNumberNormalized: { in: [...testNumbers] } },
      orderBy: { phoneNumberNormalized: 'asc' },
    }),
    controlClient.whatsAppMessageEvent.findMany({
      where: { providerMessageId: { startsWith: `wamid.canary.${runToken}` } },
      orderBy: { id: 'asc' },
    }),
  ]);
  return { events, users, suppressions, messages };
}

async function cleanup() {
  const eventIds = [...testEventIds];
  const userIds = [...testUserIds];
  const numbers = [...testNumbers];
  const messageIds = [...testInboundMessageIds];

  if (messageIds.length) {
    await controlClient.whatsAppMessageEvent.deleteMany({
      where: { providerMessageId: { in: messageIds } },
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
  testInboundMessageIds.clear();
  testNumbers.clear();
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

function stopPayload(number, providerMessageId) {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'canary-test-waba',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '199900000000',
            phone_number_id: 'canary-test-phone',
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
  };
}

function postStop(app, number) {
  const providerMessageId = `wamid.canary.${runToken}.${testInboundMessageIds.size}`;
  testInboundMessageIds.add(providerMessageId);
  const rawBody = JSON.stringify(stopPayload(number, providerMessageId));
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
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'canary-verify-token';
  process.env.WHATSAPP_LIVE_SEND_ENABLED = 'false';
  process.env.WHATSAPP_CANARY_WORKER_ENABLED = 'true';
  process.env.WHATSAPP_LIVE_TEST_NUMBER = '99999 99999';
  process.env.WHATSAPP_LESSON1_TEMPLATE_NAME = 'canary_template';
  process.env.WHATSAPP_LESSON1_TEMPLATE_LANGUAGE = 'en';
  await Promise.all([
    controlClient.$connect(),
    liveClient.$connect(),
    webhookClient.$connect(),
    lockClient.$connect(),
  ]);
});

afterEach(async () => {
  await cleanup();
  jest.clearAllMocks();
});

afterAll(async () => {
  await cleanup();
  await Promise.all([
    controlClient.$disconnect(),
    liveClient.$disconnect(),
    webhookClient.$disconnect(),
    lockClient.$disconnect(),
  ]);

  for (const [name, value] of Object.entries({
    AUTOMATION_SECRET: originalEnvironment.automationSecret,
    META_APP_SECRET: originalEnvironment.metaAppSecret,
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: originalEnvironment.webhookVerifyToken,
    WHATSAPP_LIVE_SEND_ENABLED: originalEnvironment.liveSendEnabled,
    WHATSAPP_CANARY_WORKER_ENABLED: originalEnvironment.canaryEnabled,
    WHATSAPP_LIVE_TEST_NUMBER: originalEnvironment.liveTestNumber,
    WHATSAPP_LESSON1_TEMPLATE_NAME: originalEnvironment.templateName,
    WHATSAPP_LESSON1_TEMPLATE_LANGUAGE: originalEnvironment.templateLanguage,
  })) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe('manual canary worker PostgreSQL integration', () => {
  test('bounds the scan, skips legacy rows without mutation, and sends once', async () => {
    const provider = jest.fn().mockResolvedValue({
      provider: 'mocked-provider',
      messageId: 'wamid.canary.success',
    });
    const app = makeApp(provider);
    const legacyUser = await createUser(1, {
      number: numberFor(1),
      consent: false,
    });
    const targetUser = await createUser(2, {
      number: testNumber,
    });
    const legacyEvent = await createEvent(legacyUser, {
      scheduledAt: new Date(Date.UTC(2000, 0, 1)),
    });
    const firstTarget = await createEvent(targetUser, {
      scheduledAt: new Date(Date.UTC(2000, 0, 2)),
    });
    const secondTarget = await createEvent(targetUser, {
      scheduledAt: new Date(Date.UTC(2000, 0, 3)),
    });

    const before = await snapshot();
    const response = await canaryRequest(app);
    const after = await snapshot();

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      scanLimit: 10,
      counts: {
        examined: 2,
        skipped: 1,
        sent: 1,
        unconfirmed: 0,
      },
    });
    expect(response.body.rows.map((row) => row.automationEventId)).toEqual([
      legacyEvent.id,
      firstTarget.id,
    ]);
    expect(response.body.rows[0]).toMatchObject({
      status: 'PENDING',
      result: 'SKIPPED',
      reasonCode: 'CONSENT_FALSE',
      destination: '[masked]',
    });
    expect(response.body.rows[1]).toMatchObject({
      status: 'SENT',
      result: 'SENT',
      reasonCode: null,
      destination: '[masked]',
    });
    expect(provider).toHaveBeenCalledTimes(1);
    expect(provider).toHaveBeenCalledWith(
      expect.objectContaining({
        to: normalizeWhatsAppNumber(testNumber),
      }),
    );

    const legacyAfter = after.events.find((event) => event.id === legacyEvent.id);
    const firstTargetAfter =
      after.events.find((event) => event.id === firstTarget.id);
    const secondTargetAfter =
      after.events.find((event) => event.id === secondTarget.id);
    expect(legacyAfter).toMatchObject({ status: 'PENDING' });
    expect(firstTargetAfter).toMatchObject({
      status: 'SENT',
      providerMessageId: 'wamid.canary.success',
    });
    expect(secondTargetAfter).toMatchObject({ status: 'PENDING' });
    expect(after.users).toEqual(before.users);
    expect(after.suppressions).toEqual(before.suppressions);

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain(targetUser.name);
    expect(serialized).not.toContain(targetUser.email);
    expect(serialized).not.toContain(testNumber);
    expect(serialized).not.toContain('wamid.canary.success');
    expect(serialized).not.toContain('providerMessageId');
    expect(serialized).not.toContain('rawProviderPayload');
  });

  test('keeps uncertainty in SENDING and does not automatically retry it', async () => {
    const provider = jest.fn();
    const providerError = new Error('provider details stay private');
    providerError.code = 'CANARY_PROVIDER_FAILURE';
    provider.mockRejectedValue(providerError);
    const app = makeApp(provider);
    const user = await createUser(3, { number: testNumber });
    const event = await createEvent(user);

    const firstResponse = await canaryRequest(app);
    const firstState = await controlClient.automationEvent.findUnique({
      where: { id: event.id },
      select: { status: true, providerMessageId: true },
    });
    const secondResponse = await canaryRequest(app);
    const secondState = await controlClient.automationEvent.findUnique({
      where: { id: event.id },
      select: { status: true, providerMessageId: true },
    });

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body.rows[0]).toMatchObject({
      status: 'SENDING',
      result: 'UNCONFIRMED',
      reasonCode: 'WHATSAPP_SEND_UNCONFIRMED',
      whatsappSent: null,
    });
    expect(firstState).toEqual({ status: 'SENDING', providerMessageId: null });
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.counts.examined).toBe(0);
    expect(secondResponse.body.rows).toEqual([]);
    expect(secondState).toEqual(firstState);
    expect(provider).toHaveBeenCalledTimes(1);
    const serialized = JSON.stringify(firstResponse.body);
    expect(serialized).not.toContain('provider details stay private');
    expect(serialized).not.toContain('CANARY_PROVIDER_FAILURE');
  });

  test('serializes STOP ahead of canary provider dispatch', async () => {
    const fixtureUser = await createUser(4, { number: testNumber });
    const fixtureEvent = await createEvent(fixtureUser);
    const entered = deferred();
    const release = deferred();
    const provider = jest.fn(() => {
      throw new Error('Canary provider must not run after STOP.');
    });
    const app = makeApp(provider);
    const heldLock = lockClient.$transaction(async (tx) => {
      await acquireWhatsAppDestinationLock(tx, testNumber);
      entered.resolve();
      await release.promise;
    }, { timeout: 30_000 });

    try {
      await entered.promise;
      const stopRequest = postStop(app, testNumber);
      await waitFor(async () => {
        const rows = await controlClient.$queryRaw`
          SELECT count(*)::int AS count
          FROM pg_locks
          WHERE locktype = 'advisory' AND NOT granted
        `;
        return Number(rows[0].count) > 0;
      }, 'Expected STOP to wait for the held destination lock.');

      const canaryRequestPromise = canaryRequest(app);
      await waitFor(async () => {
        const event = await controlClient.automationEvent.findUnique({
          where: { id: fixtureEvent.id },
          select: { status: true },
        });
        return event?.status === 'SENDING';
      }, 'Expected canary to commit PENDING -> SENDING.');
      expect(provider).not.toHaveBeenCalled();

      release.resolve();
      const [stopResponse, canaryResponse] = await Promise.all([
        stopRequest,
        canaryRequestPromise,
      ]);

      expect(stopResponse.status).toBe(200);
      expect(canaryResponse.status).toBe(200);
      expect(canaryResponse.body.rows[0]).toMatchObject({
        status: 'CANCELLED',
        result: 'SKIPPED',
        reasonCode: 'CONSENT_FALSE',
        whatsappSent: false,
      });
      expect(provider).not.toHaveBeenCalled();

      const [event, suppression, user] = await Promise.all([
        controlClient.automationEvent.findUnique({
          where: { id: fixtureEvent.id },
          select: { status: true, providerMessageId: true },
        }),
        controlClient.whatsAppPhoneSuppression.findUnique({
          where: { phoneNumberNormalized: testNumber },
          select: { isOptedOut: true },
        }),
        controlClient.user.findUnique({
          where: { id: fixtureUser.id },
          select: { whatsapp_consent: true },
        }),
      ]);
      expect(event).toEqual({ status: 'CANCELLED', providerMessageId: null });
      expect(suppression).toEqual({ isOptedOut: true });
      expect(user).toEqual({ whatsapp_consent: false });
    } finally {
      release.resolve();
      await heldLock;
    }
  });
});