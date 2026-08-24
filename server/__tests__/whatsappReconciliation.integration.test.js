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
} = {}) {
  const number = `+1997${runToken}${index}`;
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
      eventType: 'LESSON1_SIGNUP_REMINDER',
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

async function createEvidence(event, type) {
  const evidence = await controlClient.whatsAppMessageEvent.create({
    data: {
      automationEventId: event.id,
      providerMessageId: event.providerMessageId,
      eventType: type,
      eventTimestamp: new Date(Date.now() - 1_000),
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
});