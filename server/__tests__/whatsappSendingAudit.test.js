/**
 * Read-only operator audit coverage for SENDING reminder events.
 *
 * Prisma and the provider are mocked. The route must use only count/findMany
 * and must never invoke a write, transaction, or provider call.
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
  $transaction: jest.fn(),
  automationEvent: {
    count: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  whatsAppMessageEvent: {
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

const SECRET = 'test-automation-secret-sending-audit';
const AUTH = { Authorization: `Bearer ${SECRET}` };
const UUID_SENDING = '11111111-1111-4111-8111-111111111111';
const UUID_PENDING = '22222222-2222-4222-8222-222222222222';
const UUID_SENT = '33333333-3333-4333-8333-333333333333';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/automation', automationRouter);
  return app;
}

function makeRow(overrides = {}) {
  return {
    id: UUID_SENDING,
    userId: 42,
    eventType: 'LESSON1_SIGNUP_REMINDER',
    status: 'SENDING',
    createdAt: new Date('2026-08-23T00:00:00.000Z'),
    scheduledAt: new Date('2026-08-23T01:00:00.000Z'),
    processedAt: new Date('2026-08-23T02:00:00.000Z'),
    sentAt: null,
    providerMessageId: null,
    destinationNumberNormalized: '+919999999999',
    whatsappEvents: [],
    ...overrides,
  };
}

beforeEach(() => {
  process.env.AUTOMATION_SECRET = SECRET;
  jest.clearAllMocks();
  mockPrisma.automationEvent.count.mockResolvedValue(0);
  mockPrisma.automationEvent.findMany.mockResolvedValue([]);
});

afterEach(() => {
  delete process.env.AUTOMATION_SECRET;
});

describe('GET /api/automation/sending-audit', () => {
  test('requires the existing automation bearer authentication', async () => {
    const response = await request(makeApp())
      .get('/api/automation/sending-audit');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      ok: false,
      error: 'UNAUTHORIZED',
    });
    expect(mockPrisma.automationEvent.count).not.toHaveBeenCalled();
    expect(mockPrisma.automationEvent.findMany).not.toHaveBeenCalled();
  });

  test('excludes non-SENDING statuses and other event types', async () => {
    const dataset = [
      makeRow(),
      makeRow({
        id: UUID_PENDING,
        status: 'PENDING',
      }),
      makeRow({
        id: UUID_SENT,
        status: 'SENT',
      }),
      makeRow({
        id: '44444444-4444-4444-8444-444444444444',
        eventType: 'OTHER_EVENT',
      }),
    ];
    const matches = dataset.filter(
      (row) =>
        row.status === 'SENDING' &&
        row.eventType === 'LESSON1_SIGNUP_REMINDER',
    );
    mockPrisma.automationEvent.count.mockResolvedValue(matches.length);
    mockPrisma.automationEvent.findMany.mockImplementation(({ where }) =>
      Promise.resolve(
        where.processedAt === null ? [] : matches,
      ),
    );

    const response = await request(makeApp())
      .get('/api/automation/sending-audit')
      .set(AUTH);

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
    expect(response.body.rows).toHaveLength(1);
    expect(response.body.rows[0].id).toBe(UUID_SENDING);
    expect(mockPrisma.automationEvent.count).toHaveBeenCalledWith({
      where: {
        status: 'SENDING',
        eventType: 'LESSON1_SIGNUP_REMINDER',
      },
    });
  });

  test('supports safe age filtering and labels the createdAt fallback', async () => {
    const processedAt = new Date('2026-08-20T00:00:00.000Z');
    const createdAtFallback = new Date('2026-08-21T00:00:00.000Z');
    const malformed = makeRow({
      id: UUID_PENDING,
      processedAt: null,
      createdAt: createdAtFallback,
    });
    const missingAnchor = makeRow({
      id: UUID_SENT,
      processedAt: null,
      createdAt: null,
    });
    mockPrisma.automationEvent.count.mockResolvedValue(3);
    mockPrisma.automationEvent.findMany.mockImplementation(({ where }) =>
      Promise.resolve(
        where.processedAt === null
          ? [malformed, missingAnchor]
          : [makeRow({ processedAt })],
      ),
    );

    const response = await request(makeApp())
      .get('/api/automation/sending-audit')
      .query({ olderThanMinutes: '60', limit: '3' })
      .set(AUTH);

    expect(response.status).toBe(200);
    expect(response.body.filters).toMatchObject({
      olderThanMinutes: 60,
      limit: 3,
    });
    expect(response.body.rows[0].ageBasis).toBe('processedAt');
    expect(response.body.rows[1].ageBasis).toBe('createdAt-fallback');
    expect(response.body.rows[1].ageHours).toBeGreaterThan(0);
    expect(response.body.rows[2].ageBasis).toBe('missing');
    expect(response.body.rows[2].ageHours).toBeNull();

    const countWhere =
      mockPrisma.automationEvent.count.mock.calls[0][0].where;
    expect(countWhere.status).toBe('SENDING');
    expect(countWhere.eventType).toBe('LESSON1_SIGNUP_REMINDER');
    expect(countWhere.OR).toHaveLength(2);
    expect(countWhere.OR[0]).toHaveProperty('processedAt.lte');
    expect(countWhere.OR[1]).toMatchObject({
      processedAt: null,
    });
  });

  test('returns the oldest effective anchors first under a small limit', async () => {
    const fallbackOldest = makeRow({
      id: UUID_PENDING,
      processedAt: null,
      createdAt: new Date('2026-08-20T00:00:00.000Z'),
    });
    const processedMiddle = makeRow({
      id: UUID_SENT,
      processedAt: new Date('2026-08-21T00:00:00.000Z'),
    });
    const processedNewest = makeRow({
      id: '44444444-4444-4444-8444-444444444444',
      processedAt: new Date('2026-08-22T00:00:00.000Z'),
    });
    mockPrisma.automationEvent.count.mockResolvedValue(3);
    mockPrisma.automationEvent.findMany.mockImplementation(({ where }) =>
      Promise.resolve(
        where.processedAt === null
          ? [fallbackOldest]
          : [processedMiddle, processedNewest],
      ),
    );

    const response = await request(makeApp())
      .get('/api/automation/sending-audit')
      .query({ limit: '2' })
      .set(AUTH);

    expect(response.status).toBe(200);
    expect(response.body.rows.map((row) => row.id)).toEqual([
      UUID_PENDING,
      UUID_SENT,
    ]);
    expect(response.body.hasMore).toBe(true);
    expect(mockPrisma.automationEvent.findMany).toHaveBeenCalledTimes(2);
    expect(mockPrisma.automationEvent.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        orderBy: [
          { processedAt: 'asc' },
          { id: 'asc' },
        ],
        take: 2,
      }),
    );
    expect(mockPrisma.automationEvent.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        orderBy: [
          { createdAt: 'asc' },
          { id: 'asc' },
        ],
        take: 2,
      }),
    );
  });

  test('uses a deterministic ID tie-breaker at the oldest-first limit boundary', async () => {
    const tiedAnchor = new Date('2026-08-20T00:00:00.000Z');
    mockPrisma.automationEvent.count.mockResolvedValue(4);
    mockPrisma.automationEvent.findMany.mockImplementation(({ where }) =>
      Promise.resolve(
        where.processedAt === null
          ? [
              makeRow({
                id: UUID_PENDING,
                processedAt: null,
                createdAt: tiedAnchor,
              }),
              makeRow({
                id: UUID_SENT,
                processedAt: null,
                createdAt: tiedAnchor,
              }),
            ]
          : [
              makeRow({
                id: UUID_SENDING,
                processedAt: tiedAnchor,
              }),
              makeRow({
                id: '44444444-4444-4444-8444-444444444444',
                processedAt: tiedAnchor,
              }),
            ],
      ),
    );

    const response = await request(makeApp())
      .get('/api/automation/sending-audit')
      .query({ limit: '2' })
      .set(AUTH);

    expect(response.status).toBe(200);
    expect(response.body.rows.map((row) => row.id)).toEqual([
      UUID_SENDING,
      UUID_PENDING,
    ]);
    expect(mockPrisma.automationEvent.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        orderBy: [
          { processedAt: 'asc' },
          { id: 'asc' },
        ],
      }),
    );
    expect(mockPrisma.automationEvent.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        orderBy: [
          { createdAt: 'asc' },
          { id: 'asc' },
        ],
      }),
    );
  });

  test('returns linked evidence without raw payloads, phone numbers, WhatsApp IDs, or provider free text', async () => {
    const row = makeRow({
        providerMessageId: 'wamid.top-level-secret',
        whatsappEvents: [
          {
            id: 'evidence-1',
            providerMessageId: 'wamid.evidence-secret',
            eventType: 'FAILED',
            eventTimestamp: new Date('2026-08-23T03:00:00.000Z'),
            errorCode: 131000,
            errorTitle: 'Call +919999999999 about wamid.evidence-secret',
            errorDetails: 'Recipient 919999999999 had provider failure',
            createdAt: new Date('2026-08-23T03:01:00.000Z'),
            recipientWaId: '919999999999',
            senderWaId: '918888888888',
            rawPayload: { phone: '+919999999999' },
          },
        ],
      });
    mockPrisma.automationEvent.count.mockResolvedValue(1);
    mockPrisma.automationEvent.findMany.mockImplementation(({ where }) =>
      Promise.resolve(where.processedAt === null ? [] : [row]),
    );

    const response = await request(makeApp())
      .get('/api/automation/sending-audit')
      .set(AUTH);

    expect(response.status).toBe(200);
    expect(response.body.rows[0]).toMatchObject({
      destination: '[masked]',
      providerMessageIdPresent: true,
      evidence: {
        count: 1,
        events: [
          {
            id: 'evidence-1',
            eventType: 'FAILED',
            errorCode: 131000,
            providerMessageIdPresent: true,
          },
        ],
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('wamid.');
    expect(JSON.stringify(response.body)).not.toContain('919999999999');
    expect(JSON.stringify(response.body)).not.toContain('rawPayload');
    expect(JSON.stringify(response.body)).not.toContain('recipientWaId');
    expect(JSON.stringify(response.body)).not.toContain('senderWaId');
    expect(JSON.stringify(response.body)).not.toContain('errorTitle');
    expect(JSON.stringify(response.body)).not.toContain('errorDetails');

    const select =
      mockPrisma.automationEvent.findMany.mock.calls[0][0].select
        .whatsappEvents.select;
    expect(select).not.toHaveProperty('errorTitle');
    expect(select).not.toHaveProperty('errorDetails');
  });

  test('supports an exact event lookup and performs no writes or provider calls', async () => {
    mockPrisma.automationEvent.count.mockResolvedValue(1);
    mockPrisma.automationEvent.findMany.mockImplementation(({ where }) =>
      Promise.resolve(where.processedAt === null ? [] : [makeRow()]),
    );

    const response = await request(makeApp())
      .get('/api/automation/sending-audit')
      .query({ automationEventId: UUID_SENDING, limit: '1' })
      .set(AUTH);

    expect(response.status).toBe(200);
    expect(response.body.rows).toHaveLength(1);

    const where = mockPrisma.automationEvent.count.mock.calls[0][0].where;
    expect(where).toMatchObject({
      id: UUID_SENDING,
      status: 'SENDING',
      eventType: 'LESSON1_SIGNUP_REMINDER',
    });

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
    expect(mockPrisma.automationEvent.create).not.toHaveBeenCalled();
    expect(mockPrisma.automationEvent.update).not.toHaveBeenCalled();
    expect(mockPrisma.automationEvent.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.automationEvent.delete).not.toHaveBeenCalled();
    expect(mockPrisma.automationEvent.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.whatsAppMessageEvent.create).not.toHaveBeenCalled();
    expect(mockPrisma.whatsAppMessageEvent.update).not.toHaveBeenCalled();
    expect(mockPrisma.whatsAppMessageEvent.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.whatsAppMessageEvent.delete).not.toHaveBeenCalled();
    expect(mockPrisma.whatsAppMessageEvent.deleteMany).not.toHaveBeenCalled();
  });

  test('rejects unsafe parameters and hides database failures', async () => {
    const invalid = await request(makeApp())
      .get('/api/automation/sending-audit')
      .query({
        limit: '101',
        unknown: 'value',
      })
      .set(AUTH);

    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toBe('UNKNOWN_QUERY_FIELDS');
    expect(mockPrisma.automationEvent.findMany).not.toHaveBeenCalled();

    mockPrisma.automationEvent.count.mockRejectedValue(
      new Error('connection string should not be returned'),
    );

    const failed = await request(makeApp())
      .get('/api/automation/sending-audit')
      .set(AUTH);

    expect(failed.status).toBe(500);
    expect(failed.body).toEqual({
      ok: false,
      error: 'INTERNAL_ERROR',
    });
    expect(JSON.stringify(failed.body)).not.toContain('connection string');
  });
});