/**
 * PostgreSQL coverage for the read-only due-reminder preview. Every route
 * client uses TEST_DATABASE_URL; DATABASE_URL is read only for the sanitized
 * same-target rejection before any test writes.
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

jest.setTimeout(45_000);

function requiredTestDatabaseUrl() {
  const value = String(process.env.TEST_DATABASE_URL || '').trim();
  if (!value) {
    throw new Error(
      'TEST_DATABASE_URL is required for due-reminder preview integration tests.',
    );
  }
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

const testDatabaseUrl = requiredTestDatabaseUrl();
verifyIsolatedTarget(testDatabaseUrl);

const controlClient = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});
const routeClient = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});
const previewProvider = jest.fn();

jest.unstable_mockModule('../db/client.js', () => ({
  default: routeClient,
}));
jest.unstable_mockModule('../services/whatsappProvider.js', () => ({
  sendWhatsAppTemplate: previewProvider,
}));

const { default: automationRouter } =
  await import('../routes/automationProcessor.js');

const originalAutomationSecret = process.env.AUTOMATION_SECRET;
const originalTemplateName = process.env.WHATSAPP_LESSON1_TEMPLATE_NAME;
const originalTemplateLanguage = process.env.WHATSAPP_LESSON1_TEMPLATE_LANGUAGE;
const automationSecret = 'due-reminder-preview-integration-secret';
const runToken = crypto.randomInt(100_000_000, 999_999_999).toString();
const testEventIds = new Set();
const testUserIds = new Set();
const testNumbers = new Set();

function restoreEnvironment(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function numberFor(index) {
  const number = `+1996${runToken}${index}`;
  testNumbers.add(number);
  return number;
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/automation', automationRouter);
  return app;
}

function previewRequest(app, query = {}) {
  return request(app)
    .get('/api/automation/due-reminder-preview')
    .query(query)
    .set('Authorization', `Bearer ${automationSecret}`);
}

async function createUser(index, {
  number = numberFor(index),
  name = `Preview User ${index}`,
  consent = true,
  hasAccess = false,
  optedOutAt = null,
} = {}) {
  const user = await controlClient.user.create({
    data: {
      name,
      email: `due-preview-${runToken}-${index}@example.test`,
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

async function createEvent(index, user, {
  destinationNumberNormalized = user.whatsapp_number_normalized,
  scheduledAt,
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
        privateUserEmail: user.email,
        rawProviderPayload: `private-${runToken}-${index}`,
      },
    },
  });
  testEventIds.add(event.id);
  return event;
}

async function snapshotMonitoredRows() {
  const [events, users, suppressions, progress] = await Promise.all([
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
    controlClient.lessonModeProgress.findMany({
      where: { userId: { in: [...testUserIds].map(String) } },
      orderBy: { id: 'asc' },
    }),
  ]);

  return { events, users, suppressions, progress };
}

async function cleanup() {
  const eventIds = [...testEventIds];
  const userIds = [...testUserIds];
  const numbers = [...testNumbers];

  if (userIds.length) {
    await controlClient.lessonModeProgress.deleteMany({
      where: { userId: { in: userIds.map(String) } },
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
}

beforeAll(async () => {
  process.env.AUTOMATION_SECRET = automationSecret;
  process.env.WHATSAPP_LESSON1_TEMPLATE_NAME = 'due_preview_template';
  process.env.WHATSAPP_LESSON1_TEMPLATE_LANGUAGE = 'en';
  await Promise.all([
    controlClient.$connect(),
    routeClient.$connect(),
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
    routeClient.$disconnect(),
  ]);
  restoreEnvironment('AUTOMATION_SECRET', originalAutomationSecret);
  restoreEnvironment('WHATSAPP_LESSON1_TEMPLATE_NAME', originalTemplateName);
  restoreEnvironment(
    'WHATSAPP_LESSON1_TEMPLATE_LANGUAGE',
    originalTemplateLanguage,
  );
});

describe('due-reminder preview PostgreSQL integration', () => {
  test('uses only the isolated target, preserves records, and classifies due rows safely', async () => {
    const app = makeApp();
    const routeTransaction = jest.spyOn(routeClient, '$transaction');
    const routeEventUpdate = jest.spyOn(routeClient.automationEvent, 'updateMany');

    const baseTime = Date.UTC(2000, 0, 1, 0, 0, 0);
    const scheduledAt = (offset) => new Date(baseTime + offset);
    const previewFixtures = [];

    const eligibleUser = await createUser(1);
    previewFixtures.push(await createEvent(1, eligibleUser, {
      scheduledAt: scheduledAt(1_000),
    }));

    const consentFalseUser = await createUser(2, { consent: false });
    previewFixtures.push(await createEvent(2, consentFalseUser, {
      scheduledAt: scheduledAt(2_000),
    }));

    const userAccess = await createUser(3, { hasAccess: true });
    previewFixtures.push(await createEvent(3, userAccess, {
      scheduledAt: scheduledAt(3_000),
    }));

    const suppressedUser = await createUser(4);
    await controlClient.whatsAppPhoneSuppression.create({
      data: {
        phoneNumberNormalized: suppressedUser.whatsapp_number_normalized,
        isOptedOut: true,
        optedOutAt: new Date(),
      },
    });
    previewFixtures.push(await createEvent(4, suppressedUser, {
      scheduledAt: scheduledAt(4_000),
    }));

    const sharedOptOutOwner = await createUser(5);
    await createUser(6, {
      number: sharedOptOutOwner.whatsapp_number_normalized,
      optedOutAt: new Date(),
    });
    previewFixtures.push(await createEvent(5, sharedOptOutOwner, {
      scheduledAt: scheduledAt(5_000),
    }));

    const sharedAccessOwner = await createUser(7);
    await createUser(8, {
      number: sharedAccessOwner.whatsapp_number_normalized,
      hasAccess: true,
    });
    previewFixtures.push(await createEvent(6, sharedAccessOwner, {
      scheduledAt: scheduledAt(6_000),
    }));

    const changedOwner = await createUser(9);
    const priorDestination = numberFor(10);
    previewFixtures.push(await createEvent(7, changedOwner, {
      destinationNumberNormalized: priorDestination,
      scheduledAt: scheduledAt(7_000),
    }));

    const invalidDestinationUser = await createUser(11);
    previewFixtures.push(await createEvent(8, invalidDestinationUser, {
      destinationNumberNormalized: 'not-a-number',
      scheduledAt: scheduledAt(8_000),
    }));

    const missingDestinationUser = await createUser(12);
    previewFixtures.push(await createEvent(9, missingDestinationUser, {
      destinationNumberNormalized: null,
      scheduledAt: scheduledAt(9_000),
    }));

    const lessonCompleteUser = await createUser(13);
    await controlClient.lessonModeProgress.create({
      data: {
        userId: String(lessonCompleteUser.id),
        lessonId: 1,
        mode: 'reorder',
        completed: 10,
        total: 10,
      },
    });
    previewFixtures.push(await createEvent(10, lessonCompleteUser, {
      scheduledAt: scheduledAt(10_000),
    }));

    const before = await snapshotMonitoredRows();
    const response = await previewRequest(app, { limit: '10' });
    const after = await snapshotMonitoredRows();

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      preview: 'LESSON1_SIGNUP_REMINDER',
      limit: 10,
      counts: {
        examined: 10,
        eligible: 1,
        excluded: 9,
        exclusionReasons: {
          CONSENT_FALSE: 1,
          USER_HAS_ACCESS: 1,
          PHONE_SUPPRESSED: 1,
          PHONE_OPTED_OUT: 1,
          PHONE_HAS_ACCESS: 1,
          PHONE_IDENTITY_CHANGED: 1,
          INVALID_EVENT_DESTINATION: 1,
          MISSING_EVENT_DESTINATION: 1,
          LESSON1_COMPLETE: 1,
        },
      },
    });

    const expectedIds = [...previewFixtures]
      .sort((left, right) => {
        const timeDifference =
          left.scheduledAt.getTime() - right.scheduledAt.getTime();
        return timeDifference || left.id.localeCompare(right.id);
      })
      .map((event) => event.id);
    expect(response.body.rows.map((row) => row.automationEventId)).toEqual(
      expectedIds,
    );
    expect(
      response.body.rows.every(
        (row) =>
          row.destination === '[masked]' || row.destination === null,
      ),
    ).toBe(true);

    const serialized = JSON.stringify(response.body);
    for (const sensitiveValue of [
      eligibleUser.name,
      eligibleUser.email,
      eligibleUser.whatsapp_number_normalized,
      suppressedUser.whatsapp_number_normalized,
      'privateUserEmail',
      'rawProviderPayload',
      'providerMessageId',
      'userId',
    ]) {
      expect(serialized).not.toContain(sensitiveValue);
    }

    expect(after).toEqual(before);
    expect(routeTransaction).not.toHaveBeenCalled();
    expect(routeEventUpdate).not.toHaveBeenCalled();
    expect(previewProvider).not.toHaveBeenCalled();

    routeTransaction.mockRestore();
    routeEventUpdate.mockRestore();
  });

  test('rejects malformed preview requests before route database reads', async () => {
    const app = makeApp();
    const findManySpy = jest.spyOn(routeClient.automationEvent, 'findMany');

    const invalid = await previewRequest(app, { limit: ['1', '2'] });
    const unknown = await previewRequest(app, { extra: 'nope' });

    expect(invalid.status).toBe(400);
    expect(unknown.status).toBe(400);
    expect(findManySpy).not.toHaveBeenCalled();
    expect(previewProvider).not.toHaveBeenCalled();

    findManySpy.mockRestore();
  });

  test('fails closed for missing template configuration without reading or changing due rows', async () => {
    const app = makeApp();
    const user = await createUser(20);
    await createEvent(20, user, {
      scheduledAt: new Date(Date.UTC(2000, 0, 1)),
    });
    const before = await snapshotMonitoredRows();
    const findManySpy = jest.spyOn(routeClient.automationEvent, 'findMany');
    const configuredTemplateName = process.env.WHATSAPP_LESSON1_TEMPLATE_NAME;

    delete process.env.WHATSAPP_LESSON1_TEMPLATE_NAME;
    try {
      const response = await previewRequest(app);
      const after = await snapshotMonitoredRows();

      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        ok: false,
        error: 'WHATSAPP_TEMPLATE_NOT_CONFIGURED',
      });
      expect(findManySpy).not.toHaveBeenCalled();
      expect(after).toEqual(before);
      expect(previewProvider).not.toHaveBeenCalled();
    } finally {
      restoreEnvironment(
        'WHATSAPP_LESSON1_TEMPLATE_NAME',
        configuredTemplateName,
      );
      findManySpy.mockRestore();
    }
  });
});