/**
 * Real PostgreSQL coverage for operator reconciliation. Every client is
 * constructed from TEST_DATABASE_URL; DATABASE_URL is used only for a
 * sanitized target comparison before any test write.
 */
import crypto from 'crypto';
import express from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import {
  afterAll,
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
  if (!value) throw new Error('TEST_DATABASE_URL is required for reconciliation integration tests.');
  return value;
}

function targetFingerprint(connectionString) {
  const url = new URL(connectionString);
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        protocol: url.protocol,
        host: url.hostname.toLowerCase(),
        port: url.port || '5432',
        database: decodeURIComponent(url.pathname).replace(/^\/+/, ''),
      }),
    )
    .digest('hex');
}

function verifyIsolatedTarget(testDatabaseUrl) {
  const productionDatabaseUrl = String(process.env.DATABASE_URL || '').trim();
  if (!productionDatabaseUrl) {
    throw new Error('DATABASE_URL is required only to verify TEST_DATABASE_URL isolation.');
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

async function expectPending(promise, timeoutMilliseconds = 300) {
  let timer;
  try {
    const done = await Promise.race([
      promise.then(() => true, () => true),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMilliseconds);
      }),
    ]);
    expect(done).toBe(false);
  } finally {
    clearTimeout(timer);
  }
}

const testDatabaseUrl = requiredTestDatabaseUrl();
verifyIsolatedTarget(testDatabaseUrl);

const controlClient = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});
const routeClient = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});
const liveClient = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});
const lockClient = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});
const reconciliationProvider = jest.fn();

jest.unstable_mockModule('../db/client.js', () => ({
  default: routeClient,
}));
jest.unstable_mockModule('../services/whatsappProvider.js', () => ({
  sendWhatsAppTemplate: reconciliationProvider,
}));

const { default: automationRouter, createLiveReminderHandler } =
  await import('../routes/automationProcessor.js');
const { default: webhookWhatsAppRouter } =
  await import('../routes/webhookWhatsApp.js');

const originalEnvironment = {
  automationSecret: process.env.AUTOMATION_SECRET,
  metaAppSecret: process.env.META_APP_SECRET,
  liveSendEnabled: process.env.WHATSAPP_LIVE_SEND_ENABLED,
  liveTestNumber: process.env.WHATSAPP_LIVE_TEST_NUMBER,
  templateName: process.env.WHATSAPP_LESSON1_TEMPLATE_NAME,
  templateLanguage: process.env.WHATSAPP_LESSON1_TEMPLATE_LANGUAGE,
};
const automationSecret = 'reconciliation-integration-secret';
const metaAppSecret = 'reconciliation-meta-secret';
const runToken = crypto.randomInt(1_000_000_000, 9_999_999_999).toString();
const testEventIds = new Set();
const testUserIds = new Set();
const testEvidenceIds = new Set();
const testNumbers = new Set();

function restoreEnvironment(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function makeApp({ liveDatabase = liveClient, sendTemplate = reconciliationProvider } = {}) {
  const app = express();
  app.use('/api/webhooks', webhookWhatsAppRouter);
  app.use(express.json());
  app.use('/api/automation', automationRouter);
  app.post(
    '/live-test',
    createLiveReminderHandler({
      database: liveDatabase,
      sendTemplate,
      isLiveSendEnabled: () => true,
    }),
  );
  return app;
}

async function createFixture(index, {
  status = 'SENDING',
  providerMessageId = `wamid.reconciliation.${runToken}.${index}`,
  eventType = 'LESSON1_SIGNUP_REMINDER',
  destinationNumber = null,
} = {}) {
  const number = destinationNumber || `+1997${runToken}${index}`;
  testNumbers.add(number);
  const user = await controlClient.user.create({
    data: {
      name: 'Reconciliation Test',
      email: `reconciliation-${runToken}-${index}@example.test`,
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
      eventType,
      productKey: 'sentence_master',
      status,
      destinationNumberNormalized: number,
      scheduledAt: new Date(Date.now() - 1_000),
      processedAt: status === 'SENDING' ? new Date() : null,
      providerMessageId: status === 'SENDING' ? providerMessageId : null,
      payload: { integration: true },
    },
  });
  testEventIds.add(event.id);
  return { number, user, event };
}

async function createEvidence(event, type, {
  eventTimestamp = new Date(Date.now() - 1_000),
  createdAt,
} = {}) {
  const evidence = await controlClient.whatsAppMessageEvent.create({
    data: {
      automationEventId: event.id,
      providerMessageId: event.providerMessageId,
      eventType: type,
      eventTimestamp,
      ...(createdAt ? { createdAt } : {}),
      dedupKey: crypto.randomBytes(32).toString('hex'),
    },
  });
  testEvidenceIds.add(evidence.id);
  return evidence;
}

function postReconciliation(app, eventId, action, reasonCode, key) {
  const body = { automationEventId: eventId, action };
  if (reasonCode !== undefined) body.reasonCode = reasonCode;
  return request(app)
    .post('/api/automation/reconcile-sending')
    .set('Authorization', `Bearer ${automationSecret}`)
    .set('Idempotency-Key', key)
    .send(body);
}

function getSendingMonitor(app, query = {}) {
  return request(app)
    .get('/api/automation/sending-monitor')
    .query(query)
    .set('Authorization', `Bearer ${automationSecret}`);
}

async function expectPlanUsesIndexes(indexNames, statement) {
  const planRows = await controlClient.$queryRawUnsafe(
    `EXPLAIN (FORMAT JSON) ${statement}`,
  );
  const plan = JSON.stringify(planRows);
  indexNames.forEach((indexName) => expect(plan).toContain(indexName));
}

function webhookSignature(rawBody) {
  return `sha256=${crypto
    .createHmac('sha256', metaAppSecret)
    .update(Buffer.from(rawBody, 'utf8'))
    .digest('hex')}`;
}

async function postStop(app, number) {
  const rawBody = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        value: {
          metadata: { display_phone_number: '199700000000' },
          messages: [{
            from: number.slice(1),
            id: `wamid.stop.${crypto.randomUUID()}`,
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
    .set('X-Hub-Signature-256', webhookSignature(rawBody))
    .send(rawBody);
}

async function cleanup() {
  const eventIds = [...testEventIds];
  const evidenceIds = [...testEvidenceIds];
  const userIds = [...testUserIds];
  const numbers = [...testNumbers];
  if (eventIds.length) {
    await controlClient.automationReconciliationJournal.deleteMany({
      where: { automationEventId: { in: eventIds } },
    });
  }
  if (evidenceIds.length) {
    await controlClient.whatsAppMessageEvent.deleteMany({
      where: { id: { in: evidenceIds } },
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
    await controlClient.automationEvent.deleteMany({
      where: { userId: { in: userIds } },
    });
  }
  if (userIds.length) {
    await controlClient.user.deleteMany({ where: { id: { in: userIds } } });
  }
}

beforeAll(async () => {
  process.env.AUTOMATION_SECRET = automationSecret;
  process.env.META_APP_SECRET = metaAppSecret;
  process.env.WHATSAPP_LIVE_SEND_ENABLED = 'false';
  process.env.WHATSAPP_LESSON1_TEMPLATE_NAME = 'integration_template';
  process.env.WHATSAPP_LESSON1_TEMPLATE_LANGUAGE = 'en';
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await Promise.all([
    controlClient.$disconnect(),
    routeClient.$disconnect(),
    liveClient.$disconnect(),
    lockClient.$disconnect(),
  ]);
  restoreEnvironment('AUTOMATION_SECRET', originalEnvironment.automationSecret);
  restoreEnvironment('META_APP_SECRET', originalEnvironment.metaAppSecret);
  restoreEnvironment('WHATSAPP_LIVE_SEND_ENABLED', originalEnvironment.liveSendEnabled);
  restoreEnvironment('WHATSAPP_LIVE_TEST_NUMBER', originalEnvironment.liveTestNumber);
  restoreEnvironment('WHATSAPP_LESSON1_TEMPLATE_NAME', originalEnvironment.templateName);
  restoreEnvironment('WHATSAPP_LESSON1_TEMPLATE_LANGUAGE', originalEnvironment.templateLanguage);
});

describe('WhatsApp reconciliation PostgreSQL integration', () => {
  test('marks only linked success evidence SENT and writes an atomic journal', async () => {
    const fixture = await createFixture(1);
    const evidence = await createEvidence(fixture.event, 'SENT');
    const response = await postReconciliation(
      makeApp(),
      fixture.event.id,
      'MARK_SENT',
      undefined,
      'mark-sent-1',
    );

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain(fixture.number);
    expect(JSON.stringify(response.body)).not.toContain(
      fixture.event.providerMessageId,
    );
    expect(reconciliationProvider).not.toHaveBeenCalled();

    const event = await controlClient.automationEvent.findUnique({
      where: { id: fixture.event.id },
    });
    const journal = await controlClient.automationReconciliationJournal.findUnique({
      where: {
        automationEventId_idempotencyKey: {
          automationEventId: fixture.event.id,
          idempotencyKey: 'mark-sent-1',
        },
      },
    });
    expect(event?.status).toBe('SENT');
    expect(event?.sentAt?.toISOString()).toBe(evidence.eventTimestamp.toISOString());
    expect(journal).toMatchObject({
      action: 'MARK_SENT',
      decision: 'APPLIED',
      priorStatus: 'SENDING',
      resultingStatus: 'SENT',
      evidenceEventId: evidence.id,
      evidenceStatus: 'SENT',
      authMethod: 'AUTOMATION_BEARER',
    });
  });

  test('creates exactly one 24-hour follow-up after direct and reconciled checkout-help SENT transitions', async () => {
    const direct = await createFixture(8, {
      status: 'PENDING',
      providerMessageId: null,
      eventType: 'CHECKOUT_HELP_REMINDER',
    });
    process.env.WHATSAPP_LIVE_TEST_NUMBER = direct.number;
    reconciliationProvider.mockResolvedValueOnce({
      provider: 'test',
      messageId: `wamid.checkout.direct.${runToken}`,
    });

    const directResponse = await request(makeApp())
      .post('/live-test')
      .set('Authorization', `Bearer ${automationSecret}`)
      .send({ liveSend: true, automationEventId: direct.event.id });

    expect({
      status: directResponse.status,
      body: directResponse.body,
    }).toEqual({
      status: 200,
      body: expect.objectContaining({ result: 'SENT' }),
    });
    const directSent = await controlClient.automationEvent.findUnique({
      where: { id: direct.event.id },
    });
    const directFollowUps = await controlClient.automationEvent.findMany({
      where: {
        userId: direct.user.id,
        productKey: 'sentence_master',
        eventType: 'ANY_QUESTIONS_REMINDER',
      },
    });
    directFollowUps.forEach((event) => testEventIds.add(event.id));
    expect(directFollowUps).toHaveLength(1);
    expect(directFollowUps[0].destinationNumberNormalized).toBe(direct.number);
    expect(directFollowUps[0].scheduledAt.toISOString()).toBe(
      new Date(directSent.sentAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    );

    const reconciled = await createFixture(9, {
      eventType: 'CHECKOUT_HELP_REMINDER',
    });
    const evidence = await createEvidence(reconciled.event, 'SENT');
    const reconciledResponse = await postReconciliation(
      makeApp(),
      reconciled.event.id,
      'MARK_SENT',
      undefined,
      'checkout-reconciled-9',
    );
    const replayResponse = await postReconciliation(
      makeApp(),
      reconciled.event.id,
      'MARK_SENT',
      undefined,
      'checkout-reconciled-9',
    );

    expect(reconciledResponse.status).toBe(200);
    expect(replayResponse.status).toBe(200);
    const reconciledFollowUps = await controlClient.automationEvent.findMany({
      where: {
        userId: reconciled.user.id,
        productKey: 'sentence_master',
        eventType: 'ANY_QUESTIONS_REMINDER',
      },
    });
    reconciledFollowUps.forEach((event) => testEventIds.add(event.id));
    expect(reconciledFollowUps).toHaveLength(1);
    expect(reconciledFollowUps[0].scheduledAt.toISOString()).toBe(
      new Date(
        evidence.eventTimestamp.getTime() + 24 * 60 * 60 * 1000,
      ).toISOString(),
    );
    expect(reconciliationProvider).toHaveBeenCalledTimes(1);
  });

  test('uses persisted evidence creation time when checkout-help provider timestamps are missing', async () => {
    const checkout = await createFixture(11, {
      eventType: 'CHECKOUT_HELP_REMINDER',
    });
    const firstObservedAt = new Date(Date.now() - 10 * 60_000);
    const laterObservedAt = new Date(Date.now() - 5 * 60_000);
    const firstEvidence = await createEvidence(checkout.event, 'DELIVERED', {
      eventTimestamp: null,
      createdAt: firstObservedAt,
    });
    await createEvidence(checkout.event, 'READ', {
      eventTimestamp: null,
      createdAt: laterObservedAt,
    });

    const firstResponse = await postReconciliation(
      makeApp(),
      checkout.event.id,
      'MARK_SENT',
      undefined,
      'checkout-created-at-anchor-11',
    );
    const replayResponse = await postReconciliation(
      makeApp(),
      checkout.event.id,
      'MARK_SENT',
      undefined,
      'checkout-created-at-anchor-11-replay',
    );

    expect(firstResponse.status).toBe(200);
    expect(replayResponse.status).toBe(200);

    const finalEvent = await controlClient.automationEvent.findUnique({
      where: { id: checkout.event.id },
    });
    expect(finalEvent?.status).toBe('SENT');
    expect(finalEvent?.sentAt?.toISOString()).toBe(
      firstEvidence.createdAt.toISOString(),
    );

    const followUps = await controlClient.automationEvent.findMany({
      where: {
        userId: checkout.user.id,
        productKey: 'sentence_master',
        eventType: 'ANY_QUESTIONS_REMINDER',
        sourceAutomationEventId: checkout.event.id,
      },
    });
    followUps.forEach((event) => testEventIds.add(event.id));
    expect(followUps).toHaveLength(1);
    expect(followUps[0].scheduledAt.toISOString()).toBe(
      new Date(
        firstEvidence.createdAt.getTime() + 24 * 60 * 60 * 1000,
      ).toISOString(),
    );
    expect(followUps[0].payload).toMatchObject({
      anchorSentAt: firstEvidence.createdAt.toISOString(),
    });
  });

  test('preserves provider correlation when dependent follow-up finalization rolls back, then reconciles without resend', async () => {
    reconciliationProvider.mockClear();
    const checkout = await createFixture(10, {
      status: 'PENDING',
      providerMessageId: null,
      eventType: 'CHECKOUT_HELP_REMINDER',
      destinationNumber: `+188${runToken}7`,
    });
    const blockingFollowUp = await controlClient.automationEvent.create({
      data: {
        userId: checkout.user.id,
        productKey: 'sentence_master',
        eventType: 'ANY_QUESTIONS_REMINDER',
        status: 'PENDING',
        sourceAutomationEventId: crypto.randomUUID(),
        destinationNumberNormalized: checkout.number,
        scheduledAt: new Date(Date.now() + 60_000),
      },
    });
    testEventIds.add(blockingFollowUp.id);
    process.env.WHATSAPP_LIVE_TEST_NUMBER = checkout.number;
    const providerMessageId = `wamid.checkout.rollback.${runToken}`;
    reconciliationProvider.mockResolvedValueOnce({
      provider: 'test',
      messageId: providerMessageId,
    });

    const failedFinalization = await request(makeApp())
      .post('/live-test')
      .set('Authorization', `Bearer ${automationSecret}`)
      .send({ liveSend: true, automationEventId: checkout.event.id });

    expect(failedFinalization.status).toBe(500);
    expect(failedFinalization.body).toMatchObject({
      error: 'SEND_FINALIZE_FAILED',
      whatsappSent: true,
      providerMessageId,
    });
    const uncertain = await controlClient.automationEvent.findUnique({
      where: { id: checkout.event.id },
    });
    expect(uncertain).toMatchObject({
      status: 'SENDING',
      providerMessageId,
      sentAt: null,
    });

    await controlClient.automationEvent.update({
      where: { id: blockingFollowUp.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        processedAt: new Date(),
      },
    });
    const evidence = await createEvidence(uncertain, 'SENT');
    const reconciled = await postReconciliation(
      makeApp(),
      checkout.event.id,
      'MARK_SENT',
      undefined,
      'checkout-rollback-reconciled-10',
    );

    expect(reconciled.status).toBe(200);
    const finalEvent = await controlClient.automationEvent.findUnique({
      where: { id: checkout.event.id },
    });
    expect(finalEvent.status).toBe('SENT');
    expect(finalEvent.sentAt.toISOString()).toBe(
      evidence.eventTimestamp.toISOString(),
    );
    const recoveredFollowUps = await controlClient.automationEvent.findMany({
      where: {
        userId: checkout.user.id,
        eventType: 'ANY_QUESTIONS_REMINDER',
        sourceAutomationEventId: checkout.event.id,
      },
    });
    recoveredFollowUps.forEach((event) => testEventIds.add(event.id));
    expect(recoveredFollowUps).toHaveLength(1);
    expect(recoveredFollowUps[0].scheduledAt.toISOString()).toBe(
      new Date(
        evidence.eventTimestamp.getTime() + 24 * 60 * 60 * 1000,
      ).toISOString(),
    );
    expect(reconciliationProvider).toHaveBeenCalledTimes(1);
  });

  test('is idempotent, rejects conflicting action, and rolls back failed journal/state transactions', async () => {
    const fixture = await createFixture(2);
    await createEvidence(fixture.event, 'FAILED');
    const app = makeApp();

    const first = await postReconciliation(
      app,
      fixture.event.id,
      'QUARANTINE',
      'FAILED_EVIDENCE',
      'quarantine-2',
    );
    const replay = await postReconciliation(
      app,
      fixture.event.id,
      'QUARANTINE',
      'FAILED_EVIDENCE',
      'quarantine-2',
    );
    const conflict = await postReconciliation(
      app,
      fixture.event.id,
      'MARK_SENT',
      undefined,
      'quarantine-2',
    );

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(conflict.status).toBe(409);
    expect(conflict.body.error).toBe('IDEMPOTENCY_KEY_REUSED');

    const rollbackFixture = await createFixture(3);
    await expect(
      controlClient.$transaction(async (tx) => {
        await tx.automationEvent.updateMany({
          where: { id: rollbackFixture.event.id, status: 'SENDING' },
          data: { status: 'SENT' },
        });
        await tx.automationReconciliationJournal.create({
          data: {
            automationEventId: rollbackFixture.event.id,
            idempotencyKey: 'rollback-3',
            requestHash: 'a'.repeat(64),
            action: 'MARK_SENT',
            decision: 'APPLIED',
            priorStatus: 'SENDING',
            resultingStatus: 'SENT',
            reasonCode: 'MATCHING_SUCCESS_EVIDENCE',
            evidenceEventId: crypto.randomUUID(),
            authMethod: 'AUTOMATION_BEARER',
          },
        });
      }),
    ).rejects.toBeDefined();
    const rolledBack = await controlClient.automationEvent.findUnique({
      where: { id: rollbackFixture.event.id },
    });
    expect(rolledBack?.status).toBe('SENDING');
  });

  test('serializes STOP and reconciliation, while a quarantined claim prevents live provider dispatch', async () => {
    const stopFixture = await createFixture(4);
    const app = makeApp();
    const stop = await postStop(app, stopFixture.number);
    expect(stop.status).toBe(200);
    const afterStop = await controlClient.automationEvent.findUnique({
      where: { id: stopFixture.event.id },
    });
    expect(afterStop?.status).toBe('SENDING');

    const quarantine = await postReconciliation(
      app,
      stopFixture.event.id,
      'QUARANTINE',
      'OUTCOME_UNKNOWN',
      'stop-quarantine-4',
    );
    expect(quarantine.status).toBe(200);

    const liveFixture = await createFixture(5, {
      status: 'PENDING',
      providerMessageId: null,
    });
    const transactionReached = deferred();
    const releaseTransaction = deferred();
    const delayedDatabase = new Proxy(liveClient, {
      get(target, property, receiver) {
        if (property === '$transaction') {
          return async (...args) => {
            transactionReached.resolve();
            await releaseTransaction.promise;
            return target.$transaction(...args);
          };
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const liveProvider = jest.fn(async () => ({
      provider: 'test',
      messageId: `wamid.live.${liveFixture.event.id}`,
    }));
    const raceApp = makeApp({
      liveDatabase: delayedDatabase,
      sendTemplate: liveProvider,
    });
    process.env.WHATSAPP_LIVE_TEST_NUMBER = liveFixture.number;
    const liveRequest = request(raceApp)
      .post('/live-test')
      .set('Authorization', `Bearer ${automationSecret}`)
      .send({ liveSend: true, automationEventId: liveFixture.event.id })
      .then((response) => response);
    await transactionReached.promise;

    const quarantined = await postReconciliation(
      raceApp,
      liveFixture.event.id,
      'QUARANTINE',
      'OUTCOME_UNKNOWN',
      'live-race-5',
    );
    expect(quarantined.status).toBe(200);
    releaseTransaction.resolve();
    const liveResponse = await liveRequest;
    expect(liveResponse.status).toBe(200);
    expect(liveResponse.body.result).toBe('ALREADY_PROCESSED');
    expect(liveProvider).not.toHaveBeenCalled();
  });

  test('different destinations remain independent and advisory locks release after rollback', async () => {
    const held = await createFixture(6);
    const independent = await createFixture(7);
    const entered = deferred();
    const release = deferred();
    const heldLock = lockClient.$transaction(async (tx) => {
      await acquireWhatsAppDestinationLock(tx, held.number);
      entered.resolve();
      await release.promise;
      throw new Error('intentional lock rollback');
    });
    await entered.promise;

    const heldRequest = postReconciliation(
      makeApp(),
      held.event.id,
      'QUARANTINE',
      'OUTCOME_UNKNOWN',
      'held-6',
    );
    await expectPending(heldRequest);
    const independentResponse = await postReconciliation(
      makeApp(),
      independent.event.id,
      'QUARANTINE',
      'OUTCOME_UNKNOWN',
      'independent-7',
    );
    expect(independentResponse.status).toBe(200);
    release.resolve();
    await expect(heldLock).rejects.toThrow('intentional lock rollback');
    expect((await heldRequest).status).toBe(200);
  });

  test('reports bounded sanitized metrics and history without changing monitored records', async () => {
    await cleanup();
    reconciliationProvider.mockClear();
    const app = makeApp();
    const baseline = await getSendingMonitor(app, {
      windowMinutes: '60',
      historyLimit: '0',
    });
    expect(baseline.status).toBe(200);

    const due = await createFixture(20, {
      status: 'PENDING',
      providerMessageId: null,
    });
    const scheduledFuture = await createFixture(21, {
      status: 'PENDING',
      providerMessageId: null,
    });
    const unscheduled = await createFixture(22, {
      status: 'PENDING',
      providerMessageId: null,
    });
    await controlClient.automationEvent.update({
      where: { id: due.event.id },
      data: { scheduledAt: new Date(Date.now() - 5 * 60_000) },
    });
    await controlClient.automationEvent.update({
      where: { id: scheduledFuture.event.id },
      data: { scheduledAt: new Date(Date.now() + 5 * 60_000) },
    });
    await controlClient.automationEvent.update({
      where: { id: unscheduled.event.id },
      data: { scheduledAt: null },
    });

    const sendingFixtures = await Promise.all([
      createFixture(23),
      createFixture(24),
      createFixture(25),
      createFixture(26),
      createFixture(27),
      createFixture(28),
    ]);
    const ageAnchors = [
      new Date(Date.now() - 5 * 60_000),
      new Date(Date.now() - 30 * 60_000),
      new Date(Date.now() - 2 * 60 * 60_000),
      new Date(Date.now() - 12 * 60 * 60_000),
      new Date(Date.now() - 2 * 24 * 60 * 60_000),
      new Date(Date.now() - 8 * 24 * 60 * 60_000),
    ];
    await Promise.all(
      sendingFixtures.map((fixture, index) =>
        controlClient.automationEvent.update({
          where: { id: fixture.event.id },
          data: { processedAt: ageAnchors[index] },
        }),
      ),
    );

    const linkedFailure = await createEvidence(sendingFixtures[0].event, 'FAILED');
    const unlinkedFailure = await controlClient.whatsAppMessageEvent.create({
      data: {
        providerMessageId: `wamid.monitor.unlinked.${runToken}`,
        eventType: 'FAILED',
        eventTimestamp: null,
        dedupKey: crypto.randomBytes(32).toString('hex'),
      },
    });
    testEvidenceIds.add(unlinkedFailure.id);

    const journalCreatedAt = [
      new Date(Date.now() - 10_000),
      new Date(Date.now() - 20_000),
      new Date(Date.now() - 30_000),
      new Date(Date.now() - 40_000),
    ];
    const journalRows = [
      {
        action: 'MARK_SENT',
        decision: 'APPLIED',
        priorStatus: 'SENDING',
        resultingStatus: 'SENT',
        reasonCode: 'MATCHING_SUCCESS_EVIDENCE',
        evidenceStatus: 'SENT',
      },
      {
        action: 'MARK_SENT',
        decision: 'REJECTED',
        priorStatus: 'SENDING',
        resultingStatus: 'SENDING',
        reasonCode: 'SUCCESS_EVIDENCE_REQUIRED',
        evidenceStatus: null,
      },
      {
        action: 'QUARANTINE',
        decision: 'APPLIED',
        priorStatus: 'SENDING',
        resultingStatus: 'CANCELLED',
        reasonCode: 'OUTCOME_UNKNOWN',
        evidenceStatus: null,
      },
      {
        action: 'QUARANTINE',
        decision: 'REJECTED',
        priorStatus: 'SENDING',
        resultingStatus: 'SENDING',
        reasonCode: 'SUCCESS_EVIDENCE_PRESENT',
        evidenceStatus: 'READ',
      },
    ];
    const createdJournals = await Promise.all(
      journalRows.map((row, index) =>
        controlClient.automationReconciliationJournal.create({
          data: {
            automationEventId: sendingFixtures[0].event.id,
            idempotencyKey: `monitor-journal-${runToken}-${index}`,
            requestHash: crypto
              .createHash('sha256')
              .update(`monitor-journal-${runToken}-${index}`)
              .digest('hex'),
            ...row,
            authMethod: 'AUTOMATION_BEARER',
            createdAt: journalCreatedAt[index],
          },
        }),
      ),
    );

    const monitoredIds = [
      due.event.id,
      scheduledFuture.event.id,
      unscheduled.event.id,
      ...sendingFixtures.map((fixture) => fixture.event.id),
    ];
    const before = await controlClient.automationEvent.findMany({
      where: { id: { in: monitoredIds } },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        processedAt: true,
        cancelledAt: true,
        sentAt: true,
        providerMessageId: true,
      },
      orderBy: { id: 'asc' },
    });
    const journalCountBefore =
      await controlClient.automationReconciliationJournal.count({
        where: { id: { in: createdJournals.map((journal) => journal.id) } },
      });

    const response = await getSendingMonitor(app, {
      windowMinutes: '60',
      historyLimit: '4',
    });

    expect(response.status).toBe(200);
    expect(response.body.current.pending).toMatchObject({
      total: baseline.body.current.pending.total + 3,
      due: baseline.body.current.pending.due + 1,
      scheduledFuture: baseline.body.current.pending.scheduledFuture + 1,
      unscheduled: baseline.body.current.pending.unscheduled + 1,
    });
    expect(response.body.current.sending.total)
      .toBeGreaterThanOrEqual(baseline.body.current.sending.total + 6);
    expect(response.body.current.sending.buckets).toMatchObject({
      under15Minutes:
        baseline.body.current.sending.buckets.under15Minutes + 1,
      minutes15To1Hour:
        baseline.body.current.sending.buckets.minutes15To1Hour + 1,
      hours1To6: baseline.body.current.sending.buckets.hours1To6 + 1,
      hours6To24: baseline.body.current.sending.buckets.hours6To24 + 1,
      days1To7: baseline.body.current.sending.buckets.days1To7 + 1,
      over7Days: baseline.body.current.sending.buckets.over7Days + 1,
    });
    expect(response.body.providerFailedWebhookEvents).toMatchObject({
      observedInWindow:
        baseline.body.providerFailedWebhookEvents.observedInWindow + 2,
      linkedToAutomationEvent:
        baseline.body.providerFailedWebhookEvents.linkedToAutomationEvent + 1,
      unlinked: baseline.body.providerFailedWebhookEvents.unlinked + 1,
      missingTimestamp:
        baseline.body.providerFailedWebhookEvents.missingTimestamp + 1,
    });
    expect(response.body.reconciliation.MARK_SENT).toMatchObject({
      applied: baseline.body.reconciliation.MARK_SENT.applied + 1,
      rejected: baseline.body.reconciliation.MARK_SENT.rejected + 1,
    });
    expect(response.body.reconciliation.QUARANTINE).toMatchObject({
      applied: baseline.body.reconciliation.QUARANTINE.applied + 1,
      rejected: baseline.body.reconciliation.QUARANTINE.rejected + 1,
    });
    expect(response.body.recentReconciliations).toHaveLength(4);
    expect(response.body.recentReconciliations.map((row) => row.journalId))
      .toEqual(createdJournals.map((journal) => journal.id));

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain(sendingFixtures[0].number);
    expect(serialized).not.toContain(sendingFixtures[0].event.providerMessageId);
    expect(serialized).not.toContain(linkedFailure.id);
    expect(serialized).not.toContain('requestHash');
    expect(serialized).not.toContain('idempotencyKey');
    expect(serialized).not.toContain('rawPayload');

    const after = await controlClient.automationEvent.findMany({
      where: { id: { in: monitoredIds } },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        processedAt: true,
        cancelledAt: true,
        sentAt: true,
        providerMessageId: true,
      },
      orderBy: { id: 'asc' },
    });
    const journalCountAfter =
      await controlClient.automationReconciliationJournal.count({
        where: { id: { in: createdJournals.map((journal) => journal.id) } },
      });
    expect(after).toEqual(before);
    expect(journalCountAfter).toBe(journalCountBefore);
    expect(reconciliationProvider).not.toHaveBeenCalled();
  });

  test('uses the dedicated monitor indexes for bounded status, window, and history access', async () => {
    const createdAtFallback = await createFixture(99001);
    await controlClient.automationEvent.update({
      where: { id: createdAtFallback.event.id },
      data: {
        processedAt: null,
        createdAt: new Date(),
      },
    });
    const staleFallbackUsers = Array.from({ length: 128 }, (_value, index) => {
      const fixtureIndex = 99100 + index;
      const number = `+1997${runToken}${fixtureIndex}`;
      testNumbers.add(number);
      return {
        number,
        email: `reconciliation-${runToken}-${fixtureIndex}@example.test`,
      };
    });
    await controlClient.user.createMany({
      data: staleFallbackUsers.map(({ number, email }) => ({
        name: 'Reconciliation Test',
        email,
        password: 'not-a-real-password',
        whatsapp_number: number,
        whatsapp_number_normalized: number,
        whatsapp_consent: true,
        whatsapp_consent_at: new Date(),
        has_access: false,
      })),
    });
    const staleFallbackUserRows = await controlClient.user.findMany({
      where: { email: { in: staleFallbackUsers.map(({ email }) => email) } },
      select: { id: true },
    });
    staleFallbackUserRows.forEach(({ id }) => testUserIds.add(id));
    const staleCreatedAt = new Date(Date.now() - 2 * 60 * 60_000);
    const staleFallbackEvents = staleFallbackUserRows.map(({ id }, index) => ({
      id: crypto.randomUUID(),
      userId: id,
      eventType: 'LESSON1_SIGNUP_REMINDER',
      status: 'SENDING',
      destinationNumberNormalized: staleFallbackUsers[index].number,
      scheduledAt: staleCreatedAt,
      processedAt: null,
      createdAt: staleCreatedAt,
      payload: { integration: true },
    }));
    await controlClient.automationEvent.createMany({ data: staleFallbackEvents });
    staleFallbackEvents.forEach(({ id }) => testEventIds.add(id));
    await controlClient.automationEvent.updateMany({
      where: { id: { in: staleFallbackEvents.slice(0, 64).map(({ id }) => id) } },
      data: {
        status: 'PENDING',
        scheduledAt: new Date(Date.now() + 2 * 60 * 60_000),
      },
    });
    const unrelatedEvents = Array.from({ length: 1024 }, () => ({
      id: crypto.randomUUID(),
      userId: createdAtFallback.user.id,
      eventType: 'DAY3_WEBINAR',
      status: 'SENT',
      createdAt: staleCreatedAt,
      payload: { integration: true },
    }));
    await controlClient.automationEvent.createMany({ data: unrelatedEvents });
    unrelatedEvents.forEach(({ id }) => testEventIds.add(id));
    const unrelatedWebhookEvents = Array.from({ length: 1024 }, (_value, index) => ({
      id: crypto.randomUUID(),
      providerMessageId: `wamid.monitor.noise.${runToken}.${index}`,
      eventType: 'SENT',
      dedupKey: crypto.randomBytes(32).toString('hex'),
      createdAt: new Date(),
    }));
    await controlClient.whatsAppMessageEvent.createMany({
      data: unrelatedWebhookEvents,
    });
    unrelatedWebhookEvents.forEach(({ id }) => testEvidenceIds.add(id));
    const historicalFailures = Array.from({ length: 128 }, (_value, index) => ({
      id: crypto.randomUUID(),
      providerMessageId: `wamid.monitor.history.${runToken}.${index}`,
      eventType: 'FAILED',
      eventTimestamp: new Date(Date.now() - 2 * 24 * 60 * 60_000),
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60_000),
      dedupKey: crypto.randomBytes(32).toString('hex'),
    }));
    await controlClient.whatsAppMessageEvent.createMany({
      data: historicalFailures,
    });
    for (const row of historicalFailures) testEvidenceIds.add(row.id);
    const journalRows = Array.from({ length: 1028 }, (_value, index) => ({
      id: crypto.randomUUID(),
      automationEventId: createdAtFallback.event.id,
      idempotencyKey: `monitor-plan-${runToken}-${index}`,
      requestHash: crypto.randomBytes(32).toString('hex'),
      action: 'QUARANTINE',
      decision: 'REJECTED',
      priorStatus: 'SENDING',
      resultingStatus: 'SENDING',
      reasonCode: 'OUTCOME_UNKNOWN',
      authMethod: 'AUTOMATION_BEARER',
      createdAt: new Date(
        Date.now() - (index < 1024 ? 2 * 24 * 60 * 60_000 : index * 1_000),
      ),
    }));
    await controlClient.automationReconciliationJournal.createMany({
      data: journalRows,
    });
    await controlClient.$executeRawUnsafe('ANALYZE "AutomationEvent"');
    await controlClient.$executeRawUnsafe('ANALYZE "WhatsAppMessageEvent"');
    await controlClient.$executeRawUnsafe('ANALYZE "AutomationReconciliationJournal"');

    const partialIndexRows = await controlClient.$queryRaw`
      SELECT indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'AutomationEvent_eventType_status_createdAt_idx'
    `;
    expect(partialIndexRows).toHaveLength(1);
    expect(partialIndexRows[0].indexdef).toContain(
      'WHERE ("processedAt" IS NULL)',
    );

    await expectPlanUsesIndexes(
      ['AutomationEvent_eventType_status_scheduledAt_idx'],
      `
        SELECT 'due' AS "bucket", COUNT(*) AS "count"
        FROM "AutomationEvent"
        WHERE "eventType" = 'LESSON1_SIGNUP_REMINDER'
          AND "status" = 'PENDING'
          AND "scheduledAt" IS NOT NULL
          AND "scheduledAt" <= NOW()
        UNION ALL
        SELECT 'scheduledFuture' AS "bucket", COUNT(*) AS "count"
        FROM "AutomationEvent"
        WHERE "eventType" = 'LESSON1_SIGNUP_REMINDER'
          AND "status" = 'PENDING'
          AND "scheduledAt" > NOW()
        UNION ALL
        SELECT 'unscheduled' AS "bucket", COUNT(*) AS "count"
        FROM "AutomationEvent"
        WHERE "eventType" = 'LESSON1_SIGNUP_REMINDER'
          AND "status" = 'PENDING'
          AND "scheduledAt" IS NULL
      `,
    );
    await expectPlanUsesIndexes(
      [
        'AutomationEvent_eventType_status_processedAt_idx',
        'AutomationEvent_eventType_status_createdAt_idx',
      ],
      `
        SELECT 'under15Minutes' AS "bucket", COUNT(*) AS "count"
        FROM "AutomationEvent"
        WHERE "eventType" = 'LESSON1_SIGNUP_REMINDER'
          AND "status" = 'SENDING'
          AND "processedAt" > NOW() - INTERVAL '15 minutes'
        UNION ALL
        SELECT 'under15Minutes' AS "bucket", COUNT(*) AS "count"
        FROM "AutomationEvent"
        WHERE "eventType" = 'LESSON1_SIGNUP_REMINDER'
          AND "status" = 'SENDING'
          AND "processedAt" IS NULL
          AND "createdAt" > NOW() - INTERVAL '15 minutes'
      `,
    );
    await expectPlanUsesIndexes(
      ['WhatsAppMessageEvent_eventType_createdAt_idx'],
      `
        SELECT
          COUNT(*) AS "observedInWindow",
          COUNT(*) FILTER (
            WHERE "automationEventId" IS NOT NULL
          ) AS "linkedToAutomationEvent",
          COUNT(*) FILTER (
            WHERE "automationEventId" IS NULL
          ) AS "unlinked",
          COUNT(*) FILTER (
            WHERE "eventTimestamp" IS NULL
          ) AS "missingTimestamp"
        FROM "WhatsAppMessageEvent"
        WHERE "eventType" = 'FAILED'
          AND "createdAt" >= NOW() - INTERVAL '60 minutes'
      `,
    );
    await expectPlanUsesIndexes(
      ['AutomationReconciliationJournal_createdAt_id_idx'],
      `
        SELECT
          j."id",
          j."automationEventId",
          j."createdAt",
          j."action",
          j."decision",
          j."priorStatus",
          j."resultingStatus",
          j."reasonCode",
          j."evidenceStatus"
        FROM "AutomationReconciliationJournal" j
        INNER JOIN "AutomationEvent" ae
          ON ae."id" = j."automationEventId"
        WHERE j."createdAt" >= NOW() - INTERVAL '60 minutes'
          AND ae."eventType" = 'LESSON1_SIGNUP_REMINDER'
        ORDER BY j."createdAt" DESC, j."id" DESC
        LIMIT 11
      `,
    );
    expect(reconciliationProvider).not.toHaveBeenCalled();
  });
});