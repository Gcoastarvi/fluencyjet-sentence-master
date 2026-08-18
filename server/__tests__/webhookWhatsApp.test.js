import express from 'express';
import crypto from 'crypto';
import request from 'supertest';

import webhookWhatsAppRouter from '../routes/webhookWhatsApp.js';

function makeApp() {
  const app = express();

  // Must match production ordering:
  // webhook router BEFORE global JSON parsing.
  app.use('/api/webhooks', webhookWhatsAppRouter);
  app.use(express.json());

  return app;
}

function metaSignature(rawBody, secret) {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(Buffer.from(rawBody, 'utf8'))
    .digest('hex');

  return `sha256=${digest}`;
}

describe('WhatsApp webhook security shell', () => {
  const originalVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  const originalAppSecret = process.env.META_APP_SECRET;

  afterEach(() => {
    if (originalVerifyToken === undefined) {
      delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    } else {
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = originalVerifyToken;
    }

    if (originalAppSecret === undefined) {
      delete process.env.META_APP_SECRET;
    } else {
      process.env.META_APP_SECRET = originalAppSecret;
    }
  });

  test('GET returns 500 when verify token is not configured', async () => {
    delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

    const app = makeApp();

    const res = await request(app)
      .get('/api/webhooks/whatsapp')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'anything',
        'hub.challenge': '12345',
      });

    expect(res.status).toBe(500);
    expect(res.text).toBe('Webhook not configured');
  });

  test('GET rejects incorrect verify token', async () => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'correct-test-token';

    const app = makeApp();

    const res = await request(app)
      .get('/api/webhooks/whatsapp')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong-test-token',
        'hub.challenge': '12345',
      });

    expect(res.status).toBe(403);
    expect(res.text).toBe('Forbidden');
  });

  test('GET rejects incorrect hub.mode', async () => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'correct-test-token';

    const app = makeApp();

    const res = await request(app)
      .get('/api/webhooks/whatsapp')
      .query({
        'hub.mode': 'wrong-mode',
        'hub.verify_token': 'correct-test-token',
        'hub.challenge': '12345',
      });

    expect(res.status).toBe(403);
  });

  test('GET returns Meta challenge for valid verification request', async () => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'correct-test-token';

    const app = makeApp();

    const res = await request(app)
      .get('/api/webhooks/whatsapp')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'correct-test-token',
        'hub.challenge': '987654321',
      });

    expect(res.status).toBe(200);
    expect(res.text).toBe('987654321');
  });

  test('POST returns 500 when Meta app secret is not configured', async () => {
    delete process.env.META_APP_SECRET;

    const rawBody = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [],
    });

    const app = makeApp();

    const res = await request(app)
      .post('/api/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', 'sha256=' + '0'.repeat(64))
      .send(rawBody);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      ok: false,
      error: 'WEBHOOK_NOT_CONFIGURED',
    });
  });

  test('POST rejects missing signature', async () => {
    process.env.META_APP_SECRET = 'test-meta-app-secret';

    const rawBody = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [],
    });

    const app = makeApp();

    const res = await request(app)
      .post('/api/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .send(rawBody);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      ok: false,
      error: 'INVALID_SIGNATURE',
    });
  });

  test('POST rejects invalid signature', async () => {
    process.env.META_APP_SECRET = 'test-meta-app-secret';

    const rawBody = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [],
    });

    const app = makeApp();

    const res = await request(app)
      .post('/api/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', 'sha256=' + 'a'.repeat(64))
      .send(rawBody);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      ok: false,
      error: 'INVALID_SIGNATURE',
    });
  });

  test('POST accepts correctly signed raw JSON body', async () => {
    const secret = 'test-meta-app-secret';
    process.env.META_APP_SECRET = secret;

    const rawBody = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'test-waba-id',
          changes: [],
        },
      ],
    });

    const app = makeApp();

    const res = await request(app)
      .post('/api/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', metaSignature(rawBody, secret))
      .send(rawBody);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      authenticated: true,
    });
  });

  test('POST rejects invalid JSON even when signature is valid', async () => {
    const secret = 'test-meta-app-secret';
    process.env.META_APP_SECRET = secret;

    const rawBody = '{"object":"whatsapp_business_account",BROKEN';

    const app = makeApp();

    const res = await request(app)
      .post('/api/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', metaSignature(rawBody, secret))
      .send(rawBody);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      ok: false,
      error: 'INVALID_JSON',
    });
  });
});
