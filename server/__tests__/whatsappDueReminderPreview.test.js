/**
 * Focused coverage for the strictly read-only due-reminder preview.
 * The preview must validate before Prisma access and never claim, cancel,
 * send, lock, or otherwise mutate reminder state.
 */
import {
  afterAll,
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
  $executeRaw: jest.fn(),
  $transaction: jest.fn(),
  automationEvent: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  whatsAppPhoneSuppression: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  lessonModeProgress: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
};
const mockSendWhatsAppTemplate = jest.fn();

jest.unstable_mockModule('../db/client.js', () => ({
  default: mockPrisma,
}));
jest.unstable_mockModule('../services/whatsappProvider.js', () => ({
  sendWhatsAppTemplate: mockSendWhatsAppTemplate,
}));

const { default: automationRouter } =
  await import('../routes/automationProcessor.js');

const SECRET = 'test-automation-secret-due-preview';
const AUTH = { Authorization: `Bearer ${SECRET}` };
const originalAutomationSecret = process.env.AUTOMATION_SECRET;
const originalTemplateName = process.env.WHATSAPP_LESSON1_TEMPLATE_NAME;
const originalTemplateLanguage = process.env.WHATSAPP_LESSON1_TEMPLATE_LANGUAGE;

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/automation', automationRouter);
  return app;
}

function makeEvent(id, userId, scheduledAt, destinationNumberNormalized) {
  return {
    id,
    userId,
    eventType: 'LESSON1_SIGNUP_REMINDER',
    status: 'PENDING',
    scheduledAt,
    destinationNumberNormalized,
  };
}

function configureEligibilityData({
  users,
  suppressedDestinations = new Set(),
  lessonProgress = new Map(),
}) {
  mockPrisma.user.findUnique.mockImplementation(async ({ where }) => {
    return users.get(where.id) || null;
  });
  mockPrisma.whatsAppPhoneSuppression.findUnique.mockImplementation(
    async ({ where }) => {
      return suppressedDestinations.has(where.phoneNumberNormalized)
        ? { isOptedOut: true }
        : null;
    },
  );
  mockPrisma.user.findFirst.mockImplementation(async ({ where }) => {
    const user = users.get(where.id);
    return user?.whatsapp_number_normalized === where.whatsapp_number_normalized
      ? { id: user.id }
      : null;
  });
  mockPrisma.user.findMany.mockImplementation(async ({ where }) => {
    return [...users.values()]
      .filter(
        (user) =>
          user.whatsapp_number_normalized ===
          where.whatsapp_number_normalized,
      )
      .map((user) => ({
        has_access: user.has_access,
        whatsapp_opted_out_at: user.whatsapp_opted_out_at,
      }));
  });
  mockPrisma.lessonModeProgress.findUnique.mockImplementation(
    async ({ where }) => lessonProgress.get(String(where.userId_lessonId_mode.userId)) || null,
  );
}

beforeEach(() => {
  process.env.AUTOMATION_SECRET = SECRET;
  process.env.WHATSAPP_LESSON1_TEMPLATE_NAME = 'due_preview_template';
  process.env.WHATSAPP_LESSON1_TEMPLATE_LANGUAGE = 'en';
  jest.clearAllMocks();
});

afterEach(() => {
  if (originalAutomationSecret === undefined) {
    delete process.env.AUTOMATION_SECRET;
  } else {
    process.env.AUTOMATION_SECRET = originalAutomationSecret;
  }
});

afterAll(() => {
  if (originalTemplateName === undefined) {
    delete process.env.WHATSAPP_LESSON1_TEMPLATE_NAME;
  } else {
    process.env.WHATSAPP_LESSON1_TEMPLATE_NAME = originalTemplateName;
  }
  if (originalTemplateLanguage === undefined) {
    delete process.env.WHATSAPP_LESSON1_TEMPLATE_LANGUAGE;
  } else {
    process.env.WHATSAPP_LESSON1_TEMPLATE_LANGUAGE = originalTemplateLanguage;
  }
});

describe('GET /api/automation/due-reminder-preview', () => {
  test('rejects unauthenticated requests before any Prisma access', async () => {
    const response = await request(makeApp())
      .get('/api/automation/due-reminder-preview');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      ok: false,
      error: 'UNAUTHORIZED',
    });
    expect(mockPrisma.automationEvent.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  test.each([
    ['unknown field', { unexpected: 'value' }],
    ['array limit', { limit: ['1', '2'] }],
    ['array automation event ID', {
      automationEventId: [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ],
    }],
    ['malformed limit', { limit: 'not-a-number' }],
    ['malformed automation event ID', { automationEventId: 'not-a-uuid' }],
    ['non-v4 automation event ID', {
      automationEventId: '11111111-1111-1111-8111-111111111111',
    }],
    ['zero limit', { limit: '0' }],
    ['out-of-range limit', { limit: '11' }],
  ])('rejects %s before any Prisma access', async (_label, query) => {
    const response = await request(makeApp())
      .get('/api/automation/due-reminder-preview')
      .query(query)
      .set(AUTH);

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(
      /UNKNOWN_QUERY_FIELDS|INVALID_QUERY_PARAMETERS|INVALID_AUTOMATION_EVENT_ID/,
    );
    expect(mockPrisma.automationEvent.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  test('targets one exact due event without exposing private fields or writing', async () => {
    const targetId = '11111111-1111-4111-8111-111111111111';
    const destination = '+919876543210';
    const scheduledAt = new Date(Date.now() - 1_000);
    const targetEvent = makeEvent(
      targetId,
      1,
      scheduledAt,
      destination,
    );
    mockPrisma.automationEvent.findMany.mockResolvedValue([targetEvent]);
    configureEligibilityData({
      users: new Map([[
        1,
        {
          id: 1,
          name: 'Private Target',
          email: 'private-target@example.test',
          whatsapp_consent: true,
          has_access: false,
          whatsapp_number_normalized: destination,
          whatsapp_opted_out_at: null,
        },
      ]]),
    });

    const response = await request(makeApp())
      .get('/api/automation/due-reminder-preview')
      .query({ automationEventId: targetId })
      .set(AUTH);

    expect(response.status).toBe(200);
    expect(response.body.counts).toMatchObject({
      examined: 1,
      eligible: 1,
      excluded: 0,
    });
    expect(response.body.rows).toHaveLength(1);
    expect(response.body.rows[0]).toMatchObject({
      automationEventId: targetId,
      destination: '[masked]',
      eligibility: {
        decision: 'ELIGIBLE',
        reasonCode: null,
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('Private Target');
    expect(JSON.stringify(response.body)).not.toContain(
      'private-target@example.test',
    );
    expect(JSON.stringify(response.body)).not.toContain(destination);
    expect(mockPrisma.automationEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: targetId,
          eventType: 'LESSON1_SIGNUP_REMINDER',
          status: 'PENDING',
          scheduledAt: { lte: expect.any(Date) },
        },
        orderBy: [
          { scheduledAt: 'asc' },
          { id: 'asc' },
        ],
        take: 10,
      }),
    );
    expect(mockPrisma.automationEvent.create).not.toHaveBeenCalled();
    expect(mockPrisma.automationEvent.update).not.toHaveBeenCalled();
    expect(mockPrisma.automationEvent.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
  });

  test.each([
    ['not found', '33333333-3333-4333-8333-333333333333'],
    ['non-due', '44444444-4444-4444-8444-444444444444'],
    ['wrong status', '55555555-5555-4555-8555-555555555555'],
    ['wrong type', '66666666-6666-4666-8666-666666666666'],
  ])('returns an empty preview for a %s exact target', async (_label, targetId) => {
    mockPrisma.automationEvent.findMany.mockResolvedValue([]);

    const response = await request(makeApp())
      .get('/api/automation/due-reminder-preview')
      .query({ automationEventId: targetId })
      .set(AUTH);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      counts: {
        examined: 0,
        eligible: 0,
        excluded: 0,
        exclusionReasons: {},
      },
      rows: [],
    });
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
  });

  test.each([
    'WHATSAPP_LESSON1_TEMPLATE_NAME',
    'WHATSAPP_LESSON1_TEMPLATE_LANGUAGE',
  ])('fails closed before Prisma access when %s is missing', async (name) => {
    delete process.env[name];

    const response = await request(makeApp())
      .get('/api/automation/due-reminder-preview')
      .set(AUTH);

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      ok: false,
      error: 'WHATSAPP_TEMPLATE_NOT_CONFIGURED',
    });
    expect(mockPrisma.automationEvent.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
  });

  test('returns deterministic, bounded, privacy-safe eligibility results without writes', async () => {
    const now = Date.now();
    const destinations = {
      eligible: '+919876543210',
      consent: '+919876543211',
      access: '+919876543212',
      suppressed: '+919876543213',
      optedOut: '+919876543214',
      sharedAccess: '+919876543215',
      changed: '+919876543216',
      lessonComplete: '+919876543217',
    };
    const users = new Map([
      [1, {
        id: 1,
        name: 'Private Learner',
        email: 'private-learner@example.test',
        whatsapp_consent: true,
        has_access: false,
        whatsapp_number_normalized: destinations.eligible,
        whatsapp_opted_out_at: null,
      }],
      [2, {
        id: 2,
        name: 'Consent Learner',
        email: 'consent-learner@example.test',
        whatsapp_consent: false,
        has_access: false,
        whatsapp_number_normalized: destinations.consent,
        whatsapp_opted_out_at: null,
      }],
      [3, {
        id: 3,
        name: 'Access Learner',
        email: 'access-learner@example.test',
        whatsapp_consent: true,
        has_access: true,
        whatsapp_number_normalized: destinations.access,
        whatsapp_opted_out_at: null,
      }],
      [4, {
        id: 4,
        name: 'Suppressed Learner',
        email: 'suppressed-learner@example.test',
        whatsapp_consent: true,
        has_access: false,
        whatsapp_number_normalized: destinations.suppressed,
        whatsapp_opted_out_at: null,
      }],
      [5, {
        id: 5,
        name: 'Opted Out Owner',
        email: 'opted-out-owner@example.test',
        whatsapp_consent: true,
        has_access: false,
        whatsapp_number_normalized: destinations.optedOut,
        whatsapp_opted_out_at: null,
      }],
      [6, {
        id: 6,
        name: 'Shared Opt Out',
        email: 'shared-opt-out@example.test',
        whatsapp_consent: true,
        has_access: false,
        whatsapp_number_normalized: destinations.optedOut,
        whatsapp_opted_out_at: new Date(),
      }],
      [7, {
        id: 7,
        name: 'Changed Learner',
        email: 'changed-learner@example.test',
        whatsapp_consent: true,
        has_access: false,
        whatsapp_number_normalized: '+919999999999',
        whatsapp_opted_out_at: null,
      }],
      [8, {
        id: 8,
        name: 'Complete Learner',
        email: 'complete-learner@example.test',
        whatsapp_consent: true,
        has_access: false,
        whatsapp_number_normalized: destinations.lessonComplete,
        whatsapp_opted_out_at: null,
      }],
    ]);
    const lessonProgress = new Map([
      ['8', { completed: 10, total: 10 }],
    ]);
    const older = new Date(now - 8 * 60_000);
    const dueEvents = [
      makeEvent('event-older', 1, older, destinations.eligible),
      makeEvent('event-consent', 2, new Date(now - 7 * 60_000), destinations.consent),
      makeEvent('event-access', 3, new Date(now - 6 * 60_000), destinations.access),
      makeEvent('event-suppressed', 4, new Date(now - 5 * 60_000), destinations.suppressed),
      makeEvent('event-opted-out', 5, new Date(now - 4 * 60_000), destinations.optedOut),
      makeEvent('event-changed', 7, new Date(now - 3 * 60_000), destinations.changed),
      makeEvent('event-invalid', 8, new Date(now - 2 * 60_000), 'not-a-number'),
      makeEvent('event-complete', 8, new Date(now - 1 * 60_000), destinations.lessonComplete),
    ];

    mockPrisma.automationEvent.findMany.mockResolvedValue(dueEvents);
    configureEligibilityData({
      users,
      suppressedDestinations: new Set([destinations.suppressed]),
      lessonProgress,
    });

    const response = await request(makeApp())
      .get('/api/automation/due-reminder-preview')
      .query({ limit: '8' })
      .set(AUTH);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      preview: 'LESSON1_SIGNUP_REMINDER',
      limit: 8,
      counts: {
        examined: 8,
        eligible: 1,
        excluded: 7,
        exclusionReasons: {
          CONSENT_FALSE: 1,
          USER_HAS_ACCESS: 1,
          PHONE_SUPPRESSED: 1,
          PHONE_OPTED_OUT: 1,
          PHONE_IDENTITY_CHANGED: 1,
          INVALID_EVENT_DESTINATION: 1,
          LESSON1_COMPLETE: 1,
        },
      },
    });
    expect(response.body.rows.map((row) => row.automationEventId)).toEqual(
      dueEvents.map((event) => event.id),
    );
    expect(response.body.rows[0]).toEqual({
      automationEventId: 'event-older',
      eventType: 'LESSON1_SIGNUP_REMINDER',
      status: 'PENDING',
      scheduledAt: older.toISOString(),
      due: true,
      destination: '[masked]',
      eligibility: {
        decision: 'ELIGIBLE',
        reasonCode: null,
      },
    });

    const serialized = JSON.stringify(response.body);
    for (const sensitiveValue of [
      'Private Learner',
      'private-learner@example.test',
      '+919876543210',
      '"userId"',
      'rawPayload',
      'providerMessageId',
    ]) {
      expect(serialized).not.toContain(sensitiveValue);
    }
    expect(serialized).toContain('[masked]');

    expect(mockPrisma.automationEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          eventType: 'LESSON1_SIGNUP_REMINDER',
          status: 'PENDING',
          scheduledAt: { lte: expect.any(Date) },
        },
        orderBy: [
          { scheduledAt: 'asc' },
          { id: 'asc' },
        ],
        take: 8,
      }),
    );
    expect(mockPrisma.automationEvent.create).not.toHaveBeenCalled();
    expect(mockPrisma.automationEvent.update).not.toHaveBeenCalled();
    expect(mockPrisma.automationEvent.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.automationEvent.delete).not.toHaveBeenCalled();
    expect(mockPrisma.automationEvent.deleteMany).not.toHaveBeenCalled();
    for (const model of [
      mockPrisma.user,
      mockPrisma.whatsAppPhoneSuppression,
      mockPrisma.lessonModeProgress,
    ]) {
      expect(model.create).not.toHaveBeenCalled();
      expect(model.update).not.toHaveBeenCalled();
      expect(model.updateMany).not.toHaveBeenCalled();
      expect(model.delete).not.toHaveBeenCalled();
      expect(model.deleteMany).not.toHaveBeenCalled();
    }
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
  });

  test('classifies a missing template parameter before Lesson 1 completion', async () => {
    const destination = '+919876543210';
    mockPrisma.automationEvent.findMany.mockResolvedValue([
      makeEvent('event-missing-name', 1, new Date(Date.now() - 1_000), destination),
    ]);
    configureEligibilityData({
      users: new Map([[
        1,
        {
          id: 1,
          name: null,
          email: 'hidden@example.test',
          whatsapp_consent: true,
          has_access: false,
          whatsapp_number_normalized: destination,
          whatsapp_opted_out_at: null,
        },
      ]]),
      lessonProgress: new Map([['1', { completed: 10, total: 10 }]]),
    });

    const response = await request(makeApp())
      .get('/api/automation/due-reminder-preview')
      .set(AUTH);

    expect(response.status).toBe(200);
    expect(response.body.rows[0].eligibility).toEqual({
      decision: 'EXCLUDED',
      reasonCode: 'WHATSAPP_TEMPLATE_PARAMETER_MISSING',
    });
    expect(mockPrisma.lessonModeProgress.findUnique).not.toHaveBeenCalled();
  });

  test('enforces the hard maximum even if a database adapter returns extra rows', async () => {
    const dueEvents = Array.from({ length: 12 }, (_, index) =>
      makeEvent(
        `event-${index + 1}`,
        index + 1,
        new Date(Date.now() - (12 - index) * 1_000),
        `+9198765432${String(index).padStart(2, '0')}`,
      ),
    );
    mockPrisma.automationEvent.findMany.mockResolvedValue(dueEvents);
    configureEligibilityData({ users: new Map() });

    const response = await request(makeApp())
      .get('/api/automation/due-reminder-preview')
      .query({ limit: '10' })
      .set(AUTH);

    expect(response.status).toBe(200);
    expect(response.body.counts.examined).toBe(10);
    expect(response.body.rows).toHaveLength(10);
    expect(mockPrisma.automationEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });

  test('returns a generic error for database failures without exposing details', async () => {
    mockPrisma.automationEvent.findMany.mockRejectedValue(
      new Error('private database connection details'),
    );

    const response = await request(makeApp())
      .get('/api/automation/due-reminder-preview')
      .set(AUTH);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      ok: false,
      error: 'INTERNAL_ERROR',
    });
    expect(JSON.stringify(response.body)).not.toContain('private database');
    expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
  });
});