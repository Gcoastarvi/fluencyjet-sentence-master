import { jest } from '@jest/globals';
import express from 'express';
import crypto from 'crypto';
import request from 'supertest';

const mockPrisma = {
  $transaction: jest.fn(),
  $executeRaw: jest.fn(),

  user: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },

  automationEvent: {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },

  whatsAppMessageEvent: {
    create: jest.fn(),
  },

  whatsAppPhoneSuppression: {
    upsert: jest.fn(),
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
  const secret = 'inbound-test-secret';
  process.env.META_APP_SECRET = secret;

  const rawBody = JSON.stringify(payload);

  return request(makeApp())
    .post('/api/webhooks/whatsapp')
    .set('Content-Type', 'application/json')
    .set('X-Hub-Signature-256', signature(rawBody, secret))
    .send(rawBody);
}

function inboundTextPayload({
  body = 'Hello',
  from = '919876543210',
  id = 'wamid.INBOUND123',
} = {}) {
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
              metadata: {
                display_phone_number: '919999999999',
                phone_number_id: '1234567890123456',
              },
              messages: [
                {
                  from,
                  id,
                  timestamp: '1787043600',
                  type: 'text',
                  text: {
                    body,
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe('WhatsApp webhook inbound message processing', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma.$transaction.mockImplementation(
      async (callback) => callback(mockPrisma),
    );
    mockPrisma.$executeRaw.mockResolvedValue(1);

    mockPrisma.whatsAppMessageEvent.create.mockResolvedValue({
      id: 'inbound-event-id',
    });

    mockPrisma.whatsAppPhoneSuppression.upsert.mockResolvedValue({
      phoneNumberNormalized: '+919876543210',
    });

    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.automationEvent.updateMany.mockResolvedValue({ count: 1 });
  });

  test('records ordinary inbound text without changing user state', async () => {
    const message = {
      from: '919876543210',
      id: 'wamid.INBOUND_HELLO',
      timestamp: '1787043600',
      type: 'text',
      text: {
        body: 'Hello',
      },
    };

    const payload = inboundTextPayload({
      body: message.text.body,
      from: message.from,
      id: message.id,
    });

    const res = await sendPayload(payload);

    expect(res.status).toBe(200);

    expect(mockPrisma.whatsAppMessageEvent.create)
      .toHaveBeenCalledWith({
        data: expect.objectContaining({
          automationEventId: null,
          providerMessageId: 'wamid.INBOUND_HELLO',
          eventType: 'INBOUND_TEXT',
          senderWaId: '919876543210',
          senderNumberNormalized: '+919876543210',
          inboundClassification: 'OTHER',
          inboundCommand: null,
          eventTimestamp: expect.any(Date),
          errorCode: null,
          errorTitle: null,
          errorDetails: null,
          rawPayload: message,
          dedupKey: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      });

    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.automationEvent.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.whatsAppPhoneSuppression.upsert).not.toHaveBeenCalled();
  });

  test('STOP opts out one matched user and cancels only pending Lesson 1 reminders', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 4201,
      },
    ]);

    const res = await sendPayload(
      inboundTextPayload({
        body: ' STOP ',
        from: '919876543210',
        id: 'wamid.INBOUND_STOP',
      }),
    );

    expect(res.status).toBe(200);

    expect(mockPrisma.user.findMany).toHaveBeenCalled();

    expect(mockPrisma.whatsAppMessageEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        senderNumberNormalized: '+919876543210',
        inboundClassification: 'OPT_OUT',
        inboundCommand: 'STOP',
      }),
    });

    expect(mockPrisma.whatsAppPhoneSuppression.upsert)
      .toHaveBeenCalledWith({
        where: {
          phoneNumberNormalized: '+919876543210',
        },
        create: {
          phoneNumberNormalized: '+919876543210',
          isOptedOut: true,
          optedOutAt: expect.any(Date),
          optOutCommand: 'STOP',
          sourceEventId: 'inbound-event-id',
        },
        update: {
          isOptedOut: true,
          optedOutAt: expect.any(Date),
          optOutCommand: 'STOP',
          sourceEventId: 'inbound-event-id',
          clearedAt: null,
          clearanceSource: null,
          clearanceReason: null,
          clearedByUserId: null,
        },
      });

    const userLookup =
      mockPrisma.user.findMany.mock.calls[0][0];

    expect(userLookup.where.whatsapp_number_normalized)
      .toBe('+919876543210');

    expect(userLookup.take).toBeUndefined();

    expect(mockPrisma.user.updateMany)
      .toHaveBeenCalledWith({
        where: {
          id: {
            in: [4201],
          },
        },
        data: {
          whatsapp_consent: false,
          whatsapp_opted_out_at: expect.any(Date),
        },
      });

    expect(mockPrisma.automationEvent.updateMany)
      .toHaveBeenCalledWith({
        where: {
          userId: {
            in: [4201],
          },
          eventType: {
            in: [
              'LESSON1_SIGNUP_REMINDER',
              'LESSON1_WATCH_REMINDER',
              'LEARNING_PATH_DISCOVERY_REMINDER',
             'CHECKOUT_HELP_REMINDER',
             'ANY_QUESTIONS_REMINDER',
            ],
          },
          status: 'PENDING',
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: expect.any(Date),
          processedAt: expect.any(Date),
        },
      });
  });

  test('new STOP reactivates suppression and clears stale clearance metadata', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    const res = await sendPayload(
      inboundTextPayload({
        body: 'STOP',
        from: '919876543210',
        id: 'wamid.INBOUND_REACTIVATE',
      }),
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.whatsAppPhoneSuppression.upsert)
      .toHaveBeenCalledWith(expect.objectContaining({
        where: {
          phoneNumberNormalized: '+919876543210',
        },
        update: {
          isOptedOut: true,
          optedOutAt: expect.any(Date),
          optOutCommand: 'STOP',
          sourceEventId: 'inbound-event-id',
          clearedAt: null,
          clearanceSource: null,
          clearanceReason: null,
          clearedByUserId: null,
        },
      }));
  });

  test('unknown sender is recorded without mutating any user', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    const res = await sendPayload(
      inboundTextPayload({
        body: 'STOP',
        from: '919111111111',
        id: 'wamid.INBOUND_UNKNOWN',
      }),
    );

    expect(res.status).toBe(200);

    expect(mockPrisma.whatsAppMessageEvent.create)
      .toHaveBeenCalled();

    expect(mockPrisma.whatsAppPhoneSuppression.upsert)
      .toHaveBeenCalledWith(expect.objectContaining({
        where: {
          phoneNumberNormalized: '+919111111111',
        },
        create: expect.objectContaining({
          phoneNumberNormalized: '+919111111111',
          sourceEventId: 'inbound-event-id',
        }),
      }));

    expect(mockPrisma.user.findMany)
      .toHaveBeenCalled();

    expect(mockPrisma.user.updateMany)
      .not.toHaveBeenCalled();

    expect(mockPrisma.automationEvent.updateMany)
      .not.toHaveBeenCalled();
  });

  test('formatting-equivalent sender is stored and suppressed under one canonical destination', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 4201 }]);

    const res = await sendPayload(
      inboundTextPayload({
        body: 'STOP',
        from: '+91 98765 43210',
        id: 'wamid.INBOUND_FORMATTED',
      }),
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.whatsAppMessageEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        senderWaId: '+91 98765 43210',
        senderNumberNormalized: '+919876543210',
        inboundClassification: 'OPT_OUT',
        inboundCommand: 'STOP',
      }),
    });
    expect(mockPrisma.whatsAppPhoneSuppression.upsert)
      .toHaveBeenCalledWith(expect.objectContaining({
        where: {
          phoneNumberNormalized: '+919876543210',
        },
      }));
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: {
        whatsapp_number_normalized: '+919876543210',
      },
      select: {
        id: true,
      },
    });
  });

  test('STOP never relabels an already-SENDING provider attempt as unsent', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 4201 }]);

    const res = await sendPayload(
      inboundTextPayload({
        body: 'STOP',
        id: 'wamid.INBOUND_STOP_SENDING',
      }),
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.automationEvent.updateMany).toHaveBeenCalledWith({
      where: {
        userId: {
          in: [4201],
        },
        eventType: {
          in: [
            'LESSON1_SIGNUP_REMINDER',
            'LESSON1_WATCH_REMINDER',
            'LEARNING_PATH_DISCOVERY_REMINDER',
            'CHECKOUT_HELP_REMINDER',
            'ANY_QUESTIONS_REMINDER',
          ],
        },
        status: 'PENDING',
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: expect.any(Date),
        processedAt: expect.any(Date),
      },
    });
  });

  test('STOP opts out all accounts sharing the matched WhatsApp number', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 4201 },
      { id: 4202 },
      { id: 4203 },
    ]);

    const res = await sendPayload(
      inboundTextPayload({
        body: 'STOP',
        id: 'wamid.INBOUND_DUPLICATE_USERS',
      }),
    );

    expect(res.status).toBe(200);

    expect(mockPrisma.whatsAppMessageEvent.create)
      .toHaveBeenCalled();

    expect(mockPrisma.user.updateMany)
      .toHaveBeenCalledWith({
        where: {
          id: {
            in: [4201, 4202, 4203],
          },
        },
        data: {
          whatsapp_consent: false,
          whatsapp_opted_out_at: expect.any(Date),
        },
      });

    expect(mockPrisma.automationEvent.updateMany)
      .toHaveBeenCalledWith({
        where: {
          userId: {
            in: [4201, 4202, 4203],
          },
          eventType: {
            in: [
              'LESSON1_SIGNUP_REMINDER',
              'LESSON1_WATCH_REMINDER',
              'LEARNING_PATH_DISCOVERY_REMINDER',
              'CHECKOUT_HELP_REMINDER',
              'ANY_QUESTIONS_REMINDER',
            ],
          },
          status: 'PENDING',
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: expect.any(Date),
          processedAt: expect.any(Date),
        },
      });
  });

  test.each([
    'stop',
    '  STOP   ',
    'unsubscribe',
    'cancel',
    'cancel all',
    'stop   all',
    'unsubscribe all',
  ])('recognizes opt-out command: %s', async (body) => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 4201 },
    ]);

    const res = await sendPayload(
      inboundTextPayload({
        body,
        id: `wamid.CMD.${body.replace(/\s+/g, '_')}`,
      }),
    );

    expect(res.status).toBe(200);

    expect(mockPrisma.user.updateMany)
      .toHaveBeenCalledWith({
        where: {
          id: {
            in: [4201],
          },
        },
        data: {
          whatsapp_consent: false,
          whatsapp_opted_out_at: expect.any(Date),
        },
      });
  });

  test('non-exact opt-out sentence is recorded but does not mutate user', async () => {
    const res = await sendPayload(
      inboundTextPayload({
        body: 'Please stop messaging me',
        id: 'wamid.INBOUND_NOT_EXACT',
      }),
    );

    expect(res.status).toBe(200);

    expect(mockPrisma.whatsAppMessageEvent.create)
      .toHaveBeenCalled();

    expect(mockPrisma.user.findMany)
      .not.toHaveBeenCalled();

    expect(mockPrisma.user.updateMany)
      .not.toHaveBeenCalled();

    expect(mockPrisma.automationEvent.updateMany)
      .not.toHaveBeenCalled();

    expect(mockPrisma.whatsAppPhoneSuppression.upsert)
      .not.toHaveBeenCalled();
  });

  test('duplicate inbound Meta message is acknowledged without repeating mutations', async () => {
    const duplicate = new Error('duplicate');
    duplicate.code = 'P2002';

    mockPrisma.whatsAppMessageEvent.create
      .mockRejectedValue(duplicate);

    const res = await sendPayload(
      inboundTextPayload({
        body: 'STOP',
        id: 'wamid.INBOUND_DUPLICATE',
      }),
    );

    expect(res.status).toBe(200);

    expect(mockPrisma.user.findMany)
      .not.toHaveBeenCalled();

    expect(mockPrisma.user.updateMany)
      .not.toHaveBeenCalled();

    expect(mockPrisma.automationEvent.updateMany)
      .not.toHaveBeenCalled();
  });

  test('unexpected transaction failure returns 500 so Meta can retry', async () => {
    mockPrisma.$transaction
      .mockRejectedValueOnce(new Error('database unavailable'));

    const res = await sendPayload(
      inboundTextPayload({
        body: 'STOP',
        id: 'wamid.INBOUND_DBFAIL',
      }),
    );

    expect(res.status).toBe(500);

    expect(res.body).toEqual({
      ok: false,
      error: 'WEBHOOK_PROCESSING_FAILED',
    });
  });

  test('non-text inbound message is ignored safely', async () => {
    const payload = inboundTextPayload({
      id: 'wamid.INBOUND_IMAGE',
    });

    const message =
      payload.entry[0].changes[0].value.messages[0];

    message.type = 'image';
    delete message.text;
    message.image = {
      id: 'test-image-id',
    };

    const res = await sendPayload(payload);

    expect(res.status).toBe(200);

    expect(mockPrisma.$transaction)
      .not.toHaveBeenCalled();

    expect(mockPrisma.whatsAppMessageEvent.create)
      .not.toHaveBeenCalled();

    expect(mockPrisma.user.updateMany)
      .not.toHaveBeenCalled();

    expect(mockPrisma.automationEvent.updateMany)
      .not.toHaveBeenCalled();
  });

});
