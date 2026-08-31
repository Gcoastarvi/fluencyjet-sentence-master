import { jest } from '@jest/globals';
import express from 'express';
import crypto from 'crypto';
import request from 'supertest';

const mockPrisma = {
  $executeRaw: jest.fn(),
  $transaction: jest.fn(),
  automationEvent: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  whatsAppMessageEvent: {
    create: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  whatsAppPhoneSuppression: {
    findUnique: jest.fn(),
  },
  spokenEnglishPurchase: {
    findFirst: jest.fn(),
  },
};

jest.unstable_mockModule('../db/client.js', () => ({
  default: mockPrisma,
}));

const { default: webhookWhatsAppRouter } =
  await import('../routes/webhookWhatsApp.js');

function makeApp() {
  const app = express();
  app.use('/api/webhooks', webhookWhatsAppRouter);
  app.use(express.json());
  return app;
}

function signature(rawBody, secret) {
  return (
    'sha256=' +
    crypto
      .createHmac('sha256', secret)
      .update(Buffer.from(rawBody, 'utf8'))
      .digest('hex')
  );
}

async function sendPayload(payload) {
  const secret = 'status-test-secret';
  process.env.META_APP_SECRET = secret;

  const rawBody = JSON.stringify(payload);

  return request(makeApp())
    .post('/api/webhooks/whatsapp')
    .set('Content-Type', 'application/json')
    .set('X-Hub-Signature-256', signature(rawBody, secret))
    .send(rawBody);
}

function statusPayload(status) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'test-waba',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              statuses: [status],
            },
          },
        ],
      },
    ],
  };
}

describe('WhatsApp webhook outbound status processing', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma.$transaction.mockImplementation(
      async (callback) => callback(mockPrisma),
    );
    mockPrisma.$executeRaw.mockResolvedValue(1);
    mockPrisma.automationEvent.findUnique.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      userId: 42,
      productKey: 'sentence_master',
      eventType: 'CHECKOUT_HELP_REMINDER',
      status: 'SENT',
      providerMessageId: 'wamid.STATUS123',
      destinationNumberNormalized: '+919842882773',
    });
    mockPrisma.automationEvent.findFirst.mockResolvedValue(null);
    mockPrisma.automationEvent.create.mockResolvedValue({
      id: 'any-questions-event',
    });

    mockPrisma.whatsAppMessageEvent.create.mockImplementation(
      async ({ data }) => ({
        id: 'event-test-id',
        ...data,
      }),
    );
    mockPrisma.user.findUnique.mockResolvedValue({
      whatsapp_number_normalized: '+919842882773',
      whatsapp_consent: true,
      whatsapp_opted_out_at: null,
      has_access: false,
    });
    mockPrisma.user.findMany.mockResolvedValue([
      {
        whatsapp_opted_out_at: null,
        has_access: false,
      },
    ]);
    mockPrisma.whatsAppPhoneSuppression.findUnique.mockResolvedValue(null);
    mockPrisma.spokenEnglishPurchase.findFirst.mockResolvedValue(null);
  });

  test('records SENT and links it by providerMessageId', async () => {
    const status = {
      id: 'wamid.STATUS123',
      status: 'sent',
      timestamp: '1787043600',
      recipient_id: '919842882773',
    };

    const res = await sendPayload(statusPayload(status));

    expect(res.status).toBe(200);

    expect(mockPrisma.automationEvent.findUnique).toHaveBeenCalledWith({
      where: {
        providerMessageId: 'wamid.STATUS123',
      },
      select: {
        id: true,
        userId: true,
        productKey: true,
        eventType: true,
        status: true,
        providerMessageId: true,
        destinationNumberNormalized: true,
      },
    });

    expect(mockPrisma.whatsAppMessageEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        automationEventId:
          '11111111-1111-4111-8111-111111111111',
        providerMessageId: 'wamid.STATUS123',
        eventType: 'SENT',
        recipientWaId: '919842882773',
        senderWaId: null,
        eventTimestamp: expect.any(Date),
        errorCode: null,
        errorTitle: null,
        errorDetails: null,
        rawPayload: status,
        dedupKey: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    });
    expect(mockPrisma.automationEvent.create).not.toHaveBeenCalled();
  });

  test('records DELIVERED and schedules one follow-up at delivery plus 24 hours', async () => {
    const deliveredAt = new Date(1787043610 * 1000);
    const res = await sendPayload(
      statusPayload({
        id: 'wamid.STATUS123',
        status: 'delivered',
        timestamp: '1787043610',
        recipient_id: '919842882773',
      }),
    );

    expect(res.status).toBe(200);

    expect(mockPrisma.whatsAppMessageEvent.create)
      .toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'DELIVERED',
        }),
      });
    expect(mockPrisma.automationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 42,
        productKey: 'sentence_master',
        eventType: 'ANY_QUESTIONS_REMINDER',
        status: 'PENDING',
        sourceAutomationEventId:
          '11111111-1111-4111-8111-111111111111',
        destinationNumberNormalized: '+919842882773',
        scheduledAt: new Date(
          deliveredAt.getTime() + 24 * 60 * 60 * 1000,
        ),
        payload: expect.objectContaining({
          sourceAutomationEventId:
            '11111111-1111-4111-8111-111111111111',
          deliveryEvidenceEventId: 'event-test-id',
          anchorSource: 'provider-delivered-webhook',
          anchorDeliveredAt: deliveredAt.toISOString(),
        }),
      }),
    });
  });

  test('persists DELIVERED without scheduling when checkout help is not internally SENT', async () => {
    mockPrisma.automationEvent.findUnique.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      userId: 42,
      productKey: 'sentence_master',
      eventType: 'CHECKOUT_HELP_REMINDER',
      status: 'SENDING',
      providerMessageId: 'wamid.STATUS123',
      destinationNumberNormalized: '+919842882773',
    });

    const res = await sendPayload(
      statusPayload({
        id: 'wamid.STATUS123',
        status: 'delivered',
        timestamp: '1787043610',
        recipient_id: '919842882773',
      }),
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.whatsAppMessageEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'DELIVERED',
      }),
    });
    expect(mockPrisma.automationEvent.create).not.toHaveBeenCalled();
  });

  test('records READ without scheduling a follow-up', async () => {
    const res = await sendPayload(
      statusPayload({
        id: 'wamid.STATUS123',
        status: 'read',
        timestamp: '1787043620',
        recipient_id: '919842882773',
      }),
    );

    expect(res.status).toBe(200);

    expect(mockPrisma.whatsAppMessageEvent.create)
      .toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'READ',
        }),
      });
    expect(mockPrisma.automationEvent.create).not.toHaveBeenCalled();
  });

  test('records FAILED with Meta error details', async () => {
    const status = {
      id: 'wamid.FAILED123',
      status: 'failed',
      timestamp: '1787043630',
      recipient_id: '919842882773',
      errors: [
        {
          code: 131049,
          title: 'Message failed',
          message: 'Message could not be delivered',
          error_data: {
            details: 'Test failure details',
          },
        },
      ],
    };

    const res = await sendPayload(statusPayload(status));

    expect(res.status).toBe(200);

    expect(mockPrisma.whatsAppMessageEvent.create)
      .toHaveBeenCalledWith({
        data: expect.objectContaining({
          providerMessageId: 'wamid.FAILED123',
          eventType: 'FAILED',
          errorCode: 131049,
          errorTitle: 'Message failed',
          errorDetails: 'Test failure details',
        }),
      });
    expect(mockPrisma.automationEvent.create).not.toHaveBeenCalled();
  });

  test('unknown wamid is still recorded as an unlinked event', async () => {
    mockPrisma.automationEvent.findUnique.mockResolvedValue(null);

    const res = await sendPayload(
      statusPayload({
        id: 'wamid.UNKNOWN123',
        status: 'sent',
        timestamp: '1787043640',
        recipient_id: '919842882773',
      }),
    );

    expect(res.status).toBe(200);

    expect(mockPrisma.whatsAppMessageEvent.create)
      .toHaveBeenCalledWith({
        data: expect.objectContaining({
          automationEventId: null,
          providerMessageId: 'wamid.UNKNOWN123',
          eventType: 'SENT',
        }),
      });
  });

  test('duplicate webhook retry is acknowledged with HTTP 200', async () => {
    const duplicate = new Error('duplicate');
    duplicate.code = 'P2002';

    mockPrisma.whatsAppMessageEvent.create
      .mockRejectedValue(duplicate);

    const res = await sendPayload(
      statusPayload({
        id: 'wamid.DUPLICATE123',
        status: 'delivered',
        timestamp: '1787043650',
        recipient_id: '919842882773',
      }),
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.automationEvent.create).not.toHaveBeenCalled();
  });

  test('duplicate DELIVERED and later READ cannot create another follow-up', async () => {
    const delivered = {
      id: 'wamid.STATUS123',
      status: 'delivered',
      timestamp: '1787043650',
      recipient_id: '919842882773',
    };

    const first = await sendPayload(statusPayload(delivered));
    const duplicate = new Error('duplicate');
    duplicate.code = 'P2002';
    mockPrisma.whatsAppMessageEvent.create.mockRejectedValueOnce(duplicate);
    const replay = await sendPayload(statusPayload(delivered));
    const read = await sendPayload(statusPayload({
      ...delivered,
      status: 'read',
      timestamp: '1787043660',
    }));

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(read.status).toBe(200);
    expect(mockPrisma.automationEvent.create).toHaveBeenCalledTimes(1);
  });

  test('unexpected database failure returns 500 for Meta retry', async () => {
    mockPrisma.whatsAppMessageEvent.create
      .mockRejectedValue(new Error('database unavailable'));

    const res = await sendPayload(
      statusPayload({
        id: 'wamid.DBFAIL123',
        status: 'sent',
        timestamp: '1787043660',
        recipient_id: '919842882773',
      }),
    );

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      ok: false,
      error: 'WEBHOOK_PROCESSING_FAILED',
    });
  });

  test('unsupported status is ignored safely', async () => {
    const res = await sendPayload(
      statusPayload({
        id: 'wamid.UNKNOWNSTATUS',
        status: 'unsupported_future_status',
        timestamp: '1787043670',
      }),
    );

    expect(res.status).toBe(200);

    expect(mockPrisma.automationEvent.findUnique)
      .not.toHaveBeenCalled();

    expect(mockPrisma.whatsAppMessageEvent.create)
      .not.toHaveBeenCalled();
  });
});
