import { jest } from '@jest/globals';
import express from 'express';
import crypto from 'crypto';
import request from 'supertest';

const mockPrisma = {
  automationEvent: {
    findUnique: jest.fn(),
  },
  whatsAppMessageEvent: {
    create: jest.fn(),
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

    mockPrisma.automationEvent.findUnique.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
    });

    mockPrisma.whatsAppMessageEvent.create.mockResolvedValue({
      id: 'event-test-id',
    });
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
  });

  test('records DELIVERED without changing AutomationEvent state', async () => {
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
  });

  test('records READ even if no delivered event was observed', async () => {
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
