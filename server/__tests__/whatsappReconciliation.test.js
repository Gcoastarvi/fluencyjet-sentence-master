/**
 * Focused, provider-free coverage for single-event SENDING reconciliation.
 * The PostgreSQL behavior is covered separately; this suite verifies route
 * input, evidence gating, idempotency, privacy, and no-provider guarantees.
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import crypto from 'crypto';
import express from 'express';
import request from 'supertest';

const mockPrisma = {
  $transaction: jest.fn(),
  $executeRaw: jest.fn(),
  automationEvent: {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
  whatsAppMessageEvent: {
    findMany: jest.fn(),
  },
  automationReconciliationJournal: {
    findUnique: jest.fn(),
    create: jest.fn(),
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

const SECRET = 'test-automation-secret-reconciliation';
const AUTH = { Authorization: `Bearer ${SECRET}` };
const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const DESTINATION = '+919999999999';
const PROVIDER_ID = 'wamid.reconciliation-sensitive';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/automation', automationRouter);
  return app;
}

function makeEvent(overrides = {}) {
  return {
    id: EVENT_ID,
    eventType: 'LESSON1_SIGNUP_REMINDER',
    status: 'SENDING',
    destinationNumberNormalized: DESTINATION,
    providerMessageId: PROVIDER_ID,
    sentAt: null,
    payload: { private: 'not selected by reconciliation' },
    ...overrides,
  };
}

function makeEvidence(overrides = {}) {
  return {
    id: 'evidence-11111111-1111-4111-8111-111111111111',
    eventType: 'SENT',
    eventTimestamp: new Date('2026-08-24T10:00:00.000Z'),
    createdAt: new Date('2026-08-24T10:01:00.000Z'),
    ...overrides,
  };
}

function reconciliationRequest(body, idempotencyKey = 'reconciliation-key-1') {
  return request(makeApp())
    .post('/api/automation/reconcile-sending')
    .set(AUTH)
    .set('Idempotency-Key', idempotencyKey)
    .send(body);
}

beforeEach(() => {
  process.env.AUTOMATION_SECRET = SECRET;
  jest.clearAllMocks();
  mockPrisma.$executeRaw.mockResolvedValue(1);
  mockPrisma.$transaction.mockImplementation(
    async (callback) => callback(mockPrisma),
  );
  mockPrisma.automationReconciliationJournal.findUnique.mockResolvedValue(null);
  mockPrisma.automationReconciliationJournal.create.mockImplementation(
    async ({ data }) => ({
      id: 'journal-11111111-1111-4111-8111-111111111111',
      ...data,
      createdAt: new Date(),
    }),
  );
  mockPrisma.automationEvent.findUnique.mockResolvedValue(makeEvent());
  mockPrisma.automationEvent.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.whatsAppMessageEvent.findMany.mockResolvedValue([]);
});

afterEach(() => {
  delete process.env.AUTOMATION_SECRET;
});

describe('POST /api/automation/reconcile-sending', () => {
  test('requires existing automation bearer auth before reads or writes', async () => {
    const response = await request(makeApp())
      .post('/api/automation/reconcile-sending')
      .set('Idempotency-Key', 'reconciliation-key-1')
      .send({
        automationEventId: EVENT_ID,
        action: 'MARK_SENT',
      });

    expect(response.status).toBe(401);
    expect(mockPrisma.automationEvent.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
  });

  test('marks SENT only from linked matching provider success evidence', async () => {
    const evidence = makeEvidence();
    mockPrisma.whatsAppMessageEvent.findMany.mockResolvedValue([evidence]);

    const response = await reconciliationRequest({
      automationEventId: EVENT_ID,
      action: 'MARK_SENT',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      action: 'MARK_SENT',
      automationEventId: EVENT_ID,
      resultingStatus: 'SENT',
      reconciliationId: 'journal-11111111-1111-4111-8111-111111111111',
    });
    expect(mockPrisma.whatsAppMessageEvent.findMany).toHaveBeenCalledWith({
      where: {
        automationEventId: EVENT_ID,
        providerMessageId: PROVIDER_ID,
        eventType: {
          in: ['SENT', 'DELIVERED', 'READ', 'FAILED'],
        },
      },
      select: {
        id: true,
        eventType: true,
        eventTimestamp: true,
        createdAt: true,
      },
    });
    expect(mockPrisma.automationEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: EVENT_ID,
          eventType: 'LESSON1_SIGNUP_REMINDER',
          status: 'SENDING',
          providerMessageId: PROVIDER_ID,
        },
        data: expect.objectContaining({
          status: 'SENT',
          sentAt: evidence.eventTimestamp,
          processedAt: expect.any(Date),
        }),
      }),
    );
    expect(mockPrisma.automationReconciliationJournal.create)
      .toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'MARK_SENT',
          decision: 'APPLIED',
          priorStatus: 'SENDING',
          resultingStatus: 'SENT',
          reasonCode: 'MATCHING_SUCCESS_EVIDENCE',
          evidenceEventId: evidence.id,
          evidenceStatus: 'SENT',
          authMethod: 'AUTOMATION_BEARER',
        }),
      });
    expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
  });

  test('leaves sentAt unchanged for DELIVERED or READ-only proof', async () => {
    mockPrisma.whatsAppMessageEvent.findMany.mockResolvedValue([
      makeEvidence({
        eventType: 'DELIVERED',
        eventTimestamp: new Date('2026-08-24T10:05:00.000Z'),
      }),
    ]);

    const response = await reconciliationRequest({
      automationEventId: EVENT_ID,
      action: 'MARK_SENT',
    });

    expect(response.status).toBe(200);
    const update =
      mockPrisma.automationEvent.updateMany.mock.calls[0][0].data;
    expect(update).toMatchObject({
      status: 'SENT',
      processedAt: expect.any(Date),
    });
    expect(update).not.toHaveProperty('sentAt');
  });

  test('rejects MARK_SENT without matching linked success evidence', async () => {
    const response = await reconciliationRequest({
      automationEventId: EVENT_ID,
      action: 'MARK_SENT',
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      ok: false,
      error: 'RECONCILIATION_NOT_APPLIED',
      action: 'MARK_SENT',
      automationEventId: EVENT_ID,
      resultingStatus: 'SENDING',
    });
    expect(mockPrisma.automationEvent.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.automationReconciliationJournal.create)
      .toHaveBeenCalledWith({
        data: expect.objectContaining({
          decision: 'REJECTED',
          reasonCode: 'SUCCESS_EVIDENCE_REQUIRED',
        }),
      });
    expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
  });

  test('quarantines only failed or genuinely unknown outcomes and preserves send fields', async () => {
    const failure = makeEvidence({ eventType: 'FAILED' });
    mockPrisma.whatsAppMessageEvent.findMany.mockResolvedValue([failure]);

    const response = await reconciliationRequest({
      automationEventId: EVENT_ID,
      action: 'QUARANTINE',
      reasonCode: 'FAILED_EVIDENCE',
    });

    expect(response.status).toBe(200);
    expect(response.body.resultingStatus).toBe('CANCELLED');
    expect(mockPrisma.automationEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: 'CANCELLED',
          cancelledAt: expect.any(Date),
          processedAt: expect.any(Date),
        },
      }),
    );
    const update =
      mockPrisma.automationEvent.updateMany.mock.calls[0][0].data;
    expect(update).not.toHaveProperty('sentAt');
    expect(update).not.toHaveProperty('providerMessageId');
    expect(update).not.toHaveProperty('payload');
  });

  test('rejects QUARANTINE when matching success evidence exists', async () => {
    mockPrisma.whatsAppMessageEvent.findMany.mockResolvedValue([
      makeEvidence({ eventType: 'READ' }),
    ]);

    const response = await reconciliationRequest({
      automationEventId: EVENT_ID,
      action: 'QUARANTINE',
      reasonCode: 'OUTCOME_UNKNOWN',
    });

    expect(response.status).toBe(409);
    expect(mockPrisma.automationEvent.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.automationReconciliationJournal.create)
      .toHaveBeenCalledWith({
        data: expect.objectContaining({
          decision: 'REJECTED',
          reasonCode: 'SUCCESS_EVIDENCE_PRESENT',
          evidenceStatus: 'READ',
        }),
      });
  });

  test('replays an identical idempotent request without transaction or provider access', async () => {
    const requestHash = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          automationEventId: EVENT_ID,
          action: 'MARK_SENT',
          reasonCode: null,
        }),
      )
      .digest('hex');

    mockPrisma.automationReconciliationJournal.findUnique.mockResolvedValue({
      id: 'journal-replay',
      automationEventId: EVENT_ID,
      requestHash,
      action: 'MARK_SENT',
      decision: 'APPLIED',
      resultingStatus: 'SENT',
    });

    const response = await reconciliationRequest({
      automationEventId: EVENT_ID,
      action: 'MARK_SENT',
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      action: 'MARK_SENT',
      resultingStatus: 'SENT',
      reconciliationId: 'journal-replay',
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
  });

  test('does not expose provider identifiers, destination values, or payloads', async () => {
    mockPrisma.whatsAppMessageEvent.findMany.mockResolvedValue([
      makeEvidence({
        eventType: 'FAILED',
        id: 'evidence-sensitive',
      }),
    ]);

    const response = await reconciliationRequest({
      automationEventId: EVENT_ID,
      action: 'QUARANTINE',
      reasonCode: 'FAILED_EVIDENCE',
    });

    expect(response.status).toBe(200);
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain(PROVIDER_ID);
    expect(serialized).not.toContain(DESTINATION);
    expect(serialized).not.toContain('evidence-sensitive');
    expect(serialized).not.toContain('private');
    expect(serialized).not.toContain('Idempotency-Key');
    expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
  });
});