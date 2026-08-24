/**
 * Focused read-only monitoring route coverage. The route must validate before
 * Prisma access and use only aggregate/findMany reads after validation.
 */
import {
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
  $queryRaw: jest.fn(),
  automationEvent: {
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  whatsAppMessageEvent: {
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  automationReconciliationJournal: {
    count: jest.fn(),
    findMany: jest.fn(),
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

const SECRET = 'test-automation-secret-sending-monitor';
const AUTH = { Authorization: `Bearer ${SECRET}` };

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/automation', automationRouter);
  return app;
}

function makeHistoryRow(overrides = {}) {
  return {
    id: 'journal-1',
    automationEventId: 'event-1',
    createdAt: new Date('2026-08-24T11:00:00.000Z'),
    action: 'QUARANTINE',
    decision: 'APPLIED',
    priorStatus: 'SENDING',
    resultingStatus: 'CANCELLED',
    reasonCode: 'OUTCOME_UNKNOWN',
    evidenceStatus: null,
    ...overrides,
  };
}

beforeEach(() => {
  process.env.AUTOMATION_SECRET = SECRET;
  jest.clearAllMocks();

  mockPrisma.$queryRaw
    .mockResolvedValueOnce([
      { bucket: 'due', count: 4n },
      { bucket: 'scheduledFuture', count: 5n },
      { bucket: 'unscheduled', count: 1n },
    ])
    .mockResolvedValueOnce([
      { bucket: 'under15Minutes', count: 1n },
      { bucket: 'minutes15To1Hour', count: 1n },
      { bucket: 'hours1To6', count: 1n },
      { bucket: 'hours6To24', count: 0n },
      { bucket: 'days1To7', count: 0n },
      { bucket: 'over7Days', count: 0n },
    ])
    .mockResolvedValueOnce([{
      observedInWindow: 5n,
      linkedToAutomationEvent: 4n,
      unlinked: 1n,
      missingTimestamp: 1n,
    }])
    .mockResolvedValueOnce([{
      markSentApplied: 2n,
      markSentRejected: 1n,
      quarantineApplied: 3n,
      quarantineRejected: 2n,
    }])
    .mockResolvedValueOnce([
      makeHistoryRow({ id: 'journal-3' }),
      makeHistoryRow({
        id: 'journal-2',
        createdAt: new Date('2026-08-24T10:00:00.000Z'),
        action: 'MARK_SENT',
        resultingStatus: 'SENT',
        reasonCode: 'MATCHING_SUCCESS_EVIDENCE',
        evidenceStatus: 'SENT',
      }),
      makeHistoryRow({
        id: 'journal-1',
        createdAt: new Date('2026-08-24T09:00:00.000Z'),
      }),
    ]);
});

afterEach(() => {
  delete process.env.AUTOMATION_SECRET;
});

describe('GET /api/automation/sending-monitor', () => {
  test('rejects unauthenticated requests before any Prisma access', async () => {
    const response = await request(makeApp())
      .get('/api/automation/sending-monitor');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      ok: false,
      error: 'UNAUTHORIZED',
    });
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  test.each([
    ['unknown field', { unexpected: 'value' }],
    ['array window', { windowMinutes: ['60', '61'] }],
    ['malformed window', { windowMinutes: 'not-a-number' }],
    ['out-of-range window', { windowMinutes: '525601' }],
    ['out-of-range history', { historyLimit: '101' }],
  ])('rejects %s before any Prisma access', async (_label, query) => {
    const response = await request(makeApp())
      .get('/api/automation/sending-monitor')
      .query(query)
      .set(AUTH);

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(
      /UNKNOWN_QUERY_FIELDS|INVALID_QUERY_PARAMETERS/,
    );
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  test('returns bounded metrics, pending breakdown, age buckets, failures, and history', async () => {
    const response = await request(makeApp())
      .get('/api/automation/sending-monitor')
      .query({ windowMinutes: '60', historyLimit: '2' })
      .set(AUTH);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      window: {
        minutes: 60,
        providerFailedWebhookEventsBasis: 'createdAt',
        reconciliationJournalBasis: 'createdAt',
      },
      current: {
        pending: {
          total: 10,
          due: 4,
          scheduledFuture: 5,
          unscheduled: 1,
        },
        sending: {
          total: 3,
          ageBasis: 'processedAt-or-createdAt',
          buckets: {
            under15Minutes: 1,
            minutes15To1Hour: 1,
            hours1To6: 1,
            hours6To24: 0,
            days1To7: 0,
            over7Days: 0,
            missingAge: 0,
          },
        },
      },
      providerFailedWebhookEvents: {
        observedInWindow: 5,
        linkedToAutomationEvent: 4,
        unlinked: 1,
        missingTimestamp: 1,
      },
      reconciliation: {
        MARK_SENT: {
          totalJournalEntries: 3,
          applied: 2,
          rejected: 1,
        },
        QUARANTINE: {
          totalJournalEntries: 5,
          applied: 3,
          rejected: 2,
        },
      },
      recentReconciliationsHasMore: true,
    });
    expect(response.body.recentReconciliations).toHaveLength(2);
    expect(response.body.recentReconciliations.map((row) => row.journalId))
      .toEqual(['journal-3', 'journal-2']);

    const serialized = JSON.stringify(response.body);
    for (const sensitiveValue of [
      'phone',
      'userId',
      'email',
      'name',
      'wamid',
      'evidenceEventId',
      'requestHash',
      'idempotencyKey',
      'rawPayload',
      'provider free text',
    ]) {
      expect(serialized.toLowerCase()).not.toContain(sensitiveValue.toLowerCase());
    }

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(5);
    const queryTexts = mockPrisma.$queryRaw.mock.calls
      .map(([strings]) => strings.join('?'));
    expect(queryTexts[0]).toContain('FROM "AutomationEvent"');
    expect(queryTexts[0]).toContain('"status" = \'PENDING\'');
    expect(queryTexts[1]).toContain('FROM "AutomationEvent"');
    expect(queryTexts[1]).toContain('"status" = \'SENDING\'');
    expect(queryTexts[2]).toContain('FROM "WhatsAppMessageEvent"');
    expect(queryTexts[3]).toContain('FROM "AutomationReconciliationJournal"');
    expect(queryTexts[4]).toContain('ORDER BY j."createdAt" DESC, j."id" DESC');
    expect(queryTexts[4]).toContain('LIMIT ?');
    expect(mockPrisma.automationEvent.count).not.toHaveBeenCalled();
    expect(mockPrisma.whatsAppMessageEvent.count).not.toHaveBeenCalled();
    expect(mockPrisma.automationReconciliationJournal.count)
      .not.toHaveBeenCalled();
    expect(mockPrisma.automationReconciliationJournal.findMany)
      .not.toHaveBeenCalled();
    expect(mockPrisma.automationEvent.create).not.toHaveBeenCalled();
    expect(mockPrisma.automationEvent.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.automationEvent.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.automationReconciliationJournal.create)
      .not.toHaveBeenCalled();
    expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
  });

  test('uses one generated timestamp and non-overlapping chronological age boundaries', async () => {
    const response = await request(makeApp())
      .get('/api/automation/sending-monitor')
      .query({ historyLimit: '0' })
      .set(AUTH);

    expect(response.status).toBe(200);
    expect(response.body.generatedAt).toEqual(expect.any(String));
    expect(response.body.window.since).toEqual(expect.any(String));

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(4);
    const sendingQueryArguments = mockPrisma.$queryRaw.mock.calls[1];
    expect(sendingQueryArguments[1]).toEqual(
      new Date(new Date(response.body.generatedAt).getTime() - 15 * 60_000),
    );
    expect(sendingQueryArguments[3]).toEqual(
      new Date(new Date(response.body.generatedAt).getTime() - 60 * 60_000),
    );
    expect(sendingQueryArguments[4]).toEqual(
      new Date(new Date(response.body.generatedAt).getTime() - 15 * 60_000),
    );
  });

  test('returns a generic error for database failures without exposing details', async () => {
    mockPrisma.$queryRaw.mockReset().mockRejectedValue(
      new Error('connection string and SQL must remain private'),
    );

    const response = await request(makeApp())
      .get('/api/automation/sending-monitor')
      .set(AUTH);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      ok: false,
      error: 'INTERNAL_ERROR',
    });
    expect(JSON.stringify(response.body)).not.toContain('connection string');
    expect(JSON.stringify(response.body)).not.toContain('SQL');
    expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
  });
});