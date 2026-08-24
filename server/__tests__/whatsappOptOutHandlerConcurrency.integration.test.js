/**
 * Real PostgreSQL end-to-end coverage for the production STOP webhook and
 * live reminder handler. It connects only to TEST_DATABASE_URL; DATABASE_URL
 * is read solely for a sanitized pre-write target comparison.
 */
import crypto from 'crypto';
import express from 'express';
import request from 'supertest';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { acquireWhatsAppDestinationLock } from '../lib/whatsappDestinationLock.js';

jest.setTimeout(45_000);

function requiredTestDatabaseUrl() {
  const value = String(process.env.TEST_DATABASE_URL || '').trim();

  if (!value) {
    throw new Error(
      'TEST_DATABASE_URL is required for WhatsApp handler concurrency tests.',
    );
  }

  return value;
}

function targetFingerprint(connectionString) {
  const parsed = new URL(connectionString);
  const targetIdentity = JSON.stringify({
    protocol: parsed.protocol,
    host: parsed.hostname.toLowerCase(),
    port: parsed.port || '5432',
    database: decodeURIComponent(parsed.pathname).replace(/^\/+/, ''),
  });

  return crypto
    .createHash('sha256')
    .update(targetIdentity)
    .digest('hex')
    .slice(0, 16);
}

function verifyIsolatedTarget(testDatabaseUrl) {
  const productionDatabaseUrl = String(process.env.DATABASE_URL || '').trim();

  if (!productionDatabaseUrl) {
    throw new Error(
      'DATABASE_URL is required only to verify TEST_DATABASE_URL is isolated.',
    );
  }

  const testFingerprint = targetFingerprint(testDatabaseUrl);
  const productionFingerprint = targetFingerprint(productionDatabaseUrl);

  if (testFingerprint === productionFingerprint) {
    throw new Error(
      'TEST_DATABASE_URL must target a different host/database than DATABASE_URL.',
    );
  }

  return {
    sameTarget: false,
    testFingerprint,
    productionFingerprint,
  };
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

function pause(milliseconds = 40) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function expectPending(promise, timeoutMilliseconds = 400) {
  let timer;

  try {
    const settled = await Promise.race([
      promise.then(
        () => true,
        () => true,
      ),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMilliseconds);
      }),
    ]);

    expect(settled).toBe(false);
  } finally {
    clearTimeout(timer);
  }
}

async function expectCompletesBefore(
  promise,
  timeoutMilliseconds,
  message,
) {
  let timer;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMilliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function waitFor(condition, message, timeoutMilliseconds = 6_000) {
  const deadline = Date.now() + timeoutMilliseconds;

  while (Date.now() < deadline) {
    if (await condition()) return;
    await pause();
  }

  throw new Error(message);
}

const testDatabaseUrl = requiredTestDatabaseUrl();
const targetProof = verifyIsolatedTarget(testDatabaseUrl);

// These pools are intentionally independent so the actual webhook and actual
// live handler can block independently while controlClient observes test state.
const controlClient = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});
const webhookClient = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});
const liveClient = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});
const lockClient = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});

// The production webhook imports this client. Mocking the module before the
// dynamic route imports makes its actual route code use only TEST_DATABASE_URL.
jest.unstable_mockModule('../db/client.js', () => ({
  default: webhookClient,
}));
jest.unstable_mockModule('../services/whatsappProvider.js', () => ({
  sendWhatsAppTemplate: jest.fn(() => {
    throw new Error('The real provider must never run in concurrency tests.');
  }),
}));

const { default: webhookWhatsAppRouter } =
  await import('../routes/webhookWhatsApp.js');
const { createLiveReminderHandler } =
  await import('../routes/automationProcessor.js');

const originalEnvironment = {
  automationSecret: process.env.AUTOMATION_SECRET,
  metaAppSecret: process.env.META_APP_SECRET,
  liveSendEnabled: process.env.WHATSAPP_LIVE_SEND_ENABLED,
  liveTestNumber: process.env.WHATSAPP_LIVE_TEST_NUMBER,
  templateName: process.env.WHATSAPP_LESSON1_TEMPLATE_NAME,
  templateLanguage: process.env.WHATSAPP_LESSON1_TEMPLATE_LANGUAGE,
};

const automationSecret = 'task12-handler-concurrency-secret';
const metaAppSecret = 'task12-handler-concurrency-meta-secret';
const runToken = crypto.randomInt(1_000_000_000, 9_999_999_999).toString();
const runPrefix = `+1998${runToken}`;
const testNumbers = new Set();
const testUserIds = new Set();
const testEventIds = new Set();
const testInboundMessageIds = new Set();

function numberFor(index) {
  const number = `${runPrefix}${index}`;
  testNumbers.add(number);
  return number;
}

function makeApp(provider, { providerDispatchTimeoutMs } = {}) {
  const app = express();

  // The webhook must be mounted before JSON parsing to preserve its signed raw
  // body. The live handler is the exact production handler with only its
  // database, provider, and kill-switch dependencies injected for this test.
  app.use('/api/webhooks', webhookWhatsAppRouter);
  app.use(express.json());
  app.post(
    '/api/automation/process-due-reminder-live',
    createLiveReminderHandler({
      database: liveClient,
      sendTemplate: provider,
      providerDispatchTimeoutMs,
      // The process environment remains false. This test-only dependency
      // proves the handler path without turning on the operational switch.
      isLiveSendEnabled: () => true,
    }),
  );

  return app;
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
    entry: [
      {
        id: 'task12-test-waba',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '199800000000',
                phone_number_id: 'task12-test-phone-id',
              },
              messages: [
                {
                  from: number.slice(1),
                  id: providerMessageId,
                  timestamp: '1787043600',
                  type: 'text',
                  text: { body: 'STOP' },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

async function postStop(app, number, suffix) {
  const providerMessageId = `wamid.task12.${runToken}.${suffix}`;
  testInboundMessageIds.add(providerMessageId);
  const rawBody = JSON.stringify(stopPayload(number, providerMessageId));

  return request(app)
    .post('/api/webhooks/whatsapp')
    .set('Content-Type', 'application/json')
    .set('X-Hub-Signature-256', signPayload(rawBody))
    .send(rawBody)
    .then((response) => response);
}

async function postLiveReminder(app, fixture) {
  process.env.WHATSAPP_LIVE_TEST_NUMBER = fixture.number;

  return request(app)
    .post('/api/automation/process-due-reminder-live')
    .set('Authorization', `Bearer ${automationSecret}`)
    .send({
      liveSend: true,
      automationEventId: fixture.event.id,
    })
    .then((response) => response);
}

async function createFixture(index) {
  const number = numberFor(index);
  const user = await controlClient.user.create({
    data: {
      name: 'Task Twelve Test',
      email: `task12-${runToken}-${index}@example.test`,
      password: 'not-a-real-password',
      whatsapp_number: number,
      whatsapp_number_normalized: number,
      whatsapp_consent: true,
      whatsapp_consent_at: new Date(),
      has_access: false,
    },
  });
  testUserIds.add(user.id);

  const event = await controlClient.automationEvent.create({
    data: {
      id: crypto.randomUUID(),
      userId: user.id,
      eventType: 'LESSON1_SIGNUP_REMINDER',
      status: 'PENDING',
      scheduledAt: new Date(Date.now() - 1_000),
      destinationNumberNormalized: number,
      payload: { source: 'task12-handler-concurrency' },
    },
  });
  testEventIds.add(event.id);

  return { number, user, event };
}

async function waitForAdvisoryWaiter() {
  await waitFor(
    async () => {
      const rows = await controlClient.$queryRaw`
        SELECT count(*)::int AS count
        FROM pg_locks
        WHERE locktype = 'advisory' AND NOT granted
      `;
      return Number(rows[0].count) > 0;
    },
    'Expected the production handler to wait for the destination advisory lock.',
  );
}

async function waitForSending(eventId) {
  await waitFor(
    async () => {
      const event = await controlClient.automationEvent.findUnique({
        where: { id: eventId },
        select: { status: true },
      });
      return event?.status === 'SENDING';
    },
    'Expected the live handler to commit PENDING -> SENDING before its lock wait.',
  );
}

async function cleanupTestRows() {
  const numbers = [...testNumbers];
  const eventIds = [...testEventIds];
  const userIds = [...testUserIds];
  const inboundMessageIds = [...testInboundMessageIds];

  if (numbers.length > 0) {
    await controlClient.whatsAppPhoneSuppression.deleteMany({
      where: { phoneNumberNormalized: { in: numbers } },
    });
  }

  if (inboundMessageIds.length > 0) {
    await controlClient.whatsAppMessageEvent.deleteMany({
      where: { providerMessageId: { in: inboundMessageIds } },
    });
  }

  if (eventIds.length > 0) {
    await controlClient.automationEvent.deleteMany({
      where: { id: { in: eventIds } },
    });
  }

  if (userIds.length > 0) {
    await controlClient.user.deleteMany({
      where: { id: { in: userIds } },
    });
  }
}

function restoreEnvironment(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe('WhatsApp STOP/live-handler PostgreSQL concurrency', () => {
  beforeAll(async () => {
    process.env.AUTOMATION_SECRET = automationSecret;
    process.env.META_APP_SECRET = metaAppSecret;
    process.env.WHATSAPP_LIVE_SEND_ENABLED = 'false';
    process.env.WHATSAPP_LESSON1_TEMPLATE_NAME = 'task12_test_template';
    process.env.WHATSAPP_LESSON1_TEMPLATE_LANGUAGE = 'en';

    await Promise.all([
      controlClient.$connect(),
      webhookClient.$connect(),
      liveClient.$connect(),
      lockClient.$connect(),
    ]);
  });

  afterEach(async () => {
    await cleanupTestRows();
  });

  afterAll(async () => {
    await cleanupTestRows();
    await Promise.all([
      controlClient.$disconnect(),
      webhookClient.$disconnect(),
      liveClient.$disconnect(),
      lockClient.$disconnect(),
    ]);

    restoreEnvironment('AUTOMATION_SECRET', originalEnvironment.automationSecret);
    restoreEnvironment('META_APP_SECRET', originalEnvironment.metaAppSecret);
    restoreEnvironment(
      'WHATSAPP_LIVE_SEND_ENABLED',
      originalEnvironment.liveSendEnabled,
    );
    restoreEnvironment(
      'WHATSAPP_LIVE_TEST_NUMBER',
      originalEnvironment.liveTestNumber,
    );
    restoreEnvironment(
      'WHATSAPP_LESSON1_TEMPLATE_NAME',
      originalEnvironment.templateName,
    );
    restoreEnvironment(
      'WHATSAPP_LESSON1_TEMPLATE_LANGUAGE',
      originalEnvironment.templateLanguage,
    );
  });

  test('preflight proves the handler suite is isolated and live sends stay disabled', () => {
    expect(targetProof.sameTarget).toBe(false);
    expect(process.env.WHATSAPP_LIVE_SEND_ENABLED).toBe('false');

    console.info(
      `[whatsapp-handler-concurrency] sameTarget=false ` +
      `testFingerprint=${targetProof.testFingerprint} ` +
      `productionFingerprint=${targetProof.productionFingerprint}`,
    );
  });

  test('actual STOP webhook wins and the actual live handler cancels without provider dispatch', async () => {
    const fixture = await createFixture(1);
    const entered = deferred();
    const release = deferred();
    const provider = jest.fn();
    const app = makeApp(provider);

    const heldLock = lockClient.$transaction(
      async (tx) => {
        await acquireWhatsAppDestinationLock(tx, fixture.number);
        entered.resolve();
        await release.promise;
      },
      { timeout: 30_000 },
    );

    try {
      await entered.promise;

      const stopRequest = postStop(app, fixture.number, 'stop-wins');
      await waitForAdvisoryWaiter();

      const liveRequest = postLiveReminder(app, fixture);
      await waitForSending(fixture.event.id);
      expect(provider).not.toHaveBeenCalled();

      release.resolve();
      const [stopResponse, liveResponse] = await Promise.all([
        stopRequest,
        liveRequest,
      ]);

      expect(stopResponse.status).toBe(200);
      expect(liveResponse.status).toBe(200);
      expect(liveResponse.body).toMatchObject({
        result: 'CANCELLED',
        skipReason: 'CONSENT_FALSE',
        whatsappSent: false,
      });
      expect(provider).not.toHaveBeenCalled();

      const [event, suppression] = await Promise.all([
        controlClient.automationEvent.findUnique({
          where: { id: fixture.event.id },
          select: { status: true, providerMessageId: true },
        }),
        controlClient.whatsAppPhoneSuppression.findUnique({
          where: { phoneNumberNormalized: fixture.number },
          select: { isOptedOut: true },
        }),
      ]);
      expect(event).toMatchObject({
        status: 'CANCELLED',
        providerMessageId: null,
      });
      expect(suppression?.isOptedOut).toBe(true);
    } finally {
      release.resolve();
      await heldLock;
    }
  });

  test('actual live handler wins, then the actual STOP webhook waits through provider resolution', async () => {
    const fixture = await createFixture(2);
    const providerEntered = deferred();
    const releaseProvider = deferred();
    const provider = jest.fn(async ({ automationEventId }) => {
      providerEntered.resolve();
      await releaseProvider.promise;
      return {
        provider: 'mocked-provider',
        messageId: `wamid.task12.${automationEventId}`,
      };
    });
    const app = makeApp(provider);

    try {
      const liveRequest = postLiveReminder(app, fixture);
      await providerEntered.promise;

      const stopRequest = postStop(app, fixture.number, 'send-wins');
      await expectPending(stopRequest);

      releaseProvider.resolve();
      const [liveResponse, stopResponse] = await Promise.all([
        liveRequest,
        stopRequest,
      ]);

      expect(liveResponse.status).toBe(200);
      expect(liveResponse.body).toMatchObject({
        result: 'SENT',
        whatsappSent: true,
      });
      expect(stopResponse.status).toBe(200);
      expect(provider).toHaveBeenCalledTimes(1);

      const [event, suppression, user] = await Promise.all([
        controlClient.automationEvent.findUnique({
          where: { id: fixture.event.id },
          select: { status: true, providerMessageId: true },
        }),
        controlClient.whatsAppPhoneSuppression.findUnique({
          where: { phoneNumberNormalized: fixture.number },
          select: { isOptedOut: true },
        }),
        controlClient.user.findUnique({
          where: { id: fixture.user.id },
          select: { whatsapp_consent: true },
        }),
      ]);

      expect(event?.status).toBe('SENT');
      expect(event?.providerMessageId).toContain('wamid.task12.');
      expect(suppression?.isOptedOut).toBe(true);
      expect(user?.whatsapp_consent).toBe(false);
    } finally {
      releaseProvider.resolve();
    }
  });

  test('different destinations do not block the actual STOP webhook', async () => {
    const heldFixture = await createFixture(3);
    const independentFixture = await createFixture(4);
    const providerEntered = deferred();
    const releaseProvider = deferred();
    const provider = jest.fn(async ({ automationEventId }) => {
      providerEntered.resolve();
      await releaseProvider.promise;
      return {
        provider: 'mocked-provider',
        messageId: `wamid.task12.${automationEventId}`,
      };
    });
    const app = makeApp(provider);

    try {
      const heldLiveRequest = postLiveReminder(app, heldFixture);
      await providerEntered.promise;

      const independentStop = postStop(
        app,
        independentFixture.number,
        'independent-stop',
      );
      const independentResponse = await expectCompletesBefore(
        independentStop,
        6_000,
        'STOP for a different destination was blocked by the live send lock.',
      );
      expect(independentResponse.status).toBe(200);
      expect(provider).toHaveBeenCalledTimes(1);

      releaseProvider.resolve();
      const heldLiveResponse = await heldLiveRequest;
      expect(heldLiveResponse.status).toBe(200);
    } finally {
      releaseProvider.resolve();
    }
  });

  test('an advisory-lock rollback releases the actual live handler path', async () => {
    const fixture = await createFixture(5);
    const entered = deferred();
    const failedTransaction = lockClient.$transaction(async (tx) => {
      await acquireWhatsAppDestinationLock(tx, fixture.number);
      entered.resolve();
      throw new Error('intentional advisory-lock rollback');
    });

    await entered.promise;
    await expect(failedTransaction).rejects.toThrow(
      'intentional advisory-lock rollback',
    );

    const provider = jest.fn(async ({ automationEventId }) => ({
      provider: 'mocked-provider',
      messageId: `wamid.task12.${automationEventId}`,
    }));
    const response = await postLiveReminder(makeApp(provider), fixture);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      result: 'SENT',
      whatsappSent: true,
    });
    expect(provider).toHaveBeenCalledTimes(1);
  });

  test('STOP waits until an abortable provider deadline settles before the lock releases', async () => {
    const fixture = await createFixture(6);
    const providerEntered = deferred();
    const providerAborted = deferred();
    const provider = jest.fn(({ signal }) => {
      providerEntered.resolve();

      return new Promise((_, reject) => {
        signal.addEventListener(
          'abort',
          () => {
            const error = new Error('mocked provider deadline');
            error.code = 'WHATSAPP_PROVIDER_TIMEOUT';
            providerAborted.resolve();
            reject(error);
          },
          { once: true },
        );
      });
    });
    const app = makeApp(provider, { providerDispatchTimeoutMs: 100 });

    const liveRequest = postLiveReminder(app, fixture);
    await providerEntered.promise;

    const stopRequest = postStop(app, fixture.number, 'provider-timeout');
    await expectPending(stopRequest, 50);

    const liveResponse = await liveRequest;
    await providerAborted.promise;
    const stopResponse = await stopRequest;

    expect(liveResponse.status).toBe(502);
    expect(liveResponse.body).toMatchObject({
      error: 'WHATSAPP_SEND_UNCONFIRMED',
      existingStatus: 'SENDING',
      whatsappSent: null,
    });
    expect(stopResponse.status).toBe(200);

    const event = await controlClient.automationEvent.findUnique({
      where: { id: fixture.event.id },
      select: { status: true },
    });
    expect(event?.status).toBe('SENDING');
  });
});