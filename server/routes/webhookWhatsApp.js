import express from 'express';
import crypto from 'crypto';

const router = express.Router();

const POISON_VALUES = new Set([
  '',
  'undefined',
  'null',
  'changeme',
  'change-me',
  'your_secret_here',
  'your_verify_token_here',
]);

function requiredSecret(name) {
  const value = String(process.env[name] || '').trim();

  if (!value || POISON_VALUES.has(value.toLowerCase())) {
    return null;
  }

  return value;
}

function timingSafeStringEqual(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!Buffer.isBuffer(rawBody)) {
    return false;
  }

  const match = /^sha256=([a-fA-F0-9]{64})$/.exec(
    String(signatureHeader || '').trim(),
  );

  if (!match) {
    return false;
  }

  const suppliedDigest = Buffer.from(match[1], 'hex');

  const expectedDigest = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest();

  if (suppliedDigest.length !== expectedDigest.length) {
    return false;
  }

  return crypto.timingSafeEqual(suppliedDigest, expectedDigest);
}

/**
 * GET /api/webhooks/whatsapp
 *
 * Meta webhook verification handshake.
 */
router.get('/whatsapp', (req, res) => {
  const verifyToken = requiredSecret('WHATSAPP_WEBHOOK_VERIFY_TOKEN');

  if (!verifyToken) {
    console.error(
      '[webhook/whatsapp] WHATSAPP_WEBHOOK_VERIFY_TOKEN not configured',
    );

    return res.status(500).send('Webhook not configured');
  }

  const mode = String(req.query['hub.mode'] || '');
  const suppliedToken = String(req.query['hub.verify_token'] || '');
  const challenge = String(req.query['hub.challenge'] || '');

  if (
    mode === 'subscribe' &&
    challenge &&
    timingSafeStringEqual(suppliedToken, verifyToken)
  ) {
    console.log('[webhook/whatsapp] Verification challenge accepted');
    return res.status(200).send(challenge);
  }

  console.warn('[webhook/whatsapp] Verification challenge rejected');
  return res.status(403).send('Forbidden');
});

/**
 * POST /api/webhooks/whatsapp
 *
 * IMPORTANT:
 * This route must be mounted BEFORE global express.json().
 * express.raw() preserves the exact request bytes needed for
 * Meta X-Hub-Signature-256 verification.
 *
 * Phase 5A only verifies authenticity and parses the payload.
 * Status/inbound processing is intentionally added later.
 */
router.post(
  '/whatsapp',
  express.raw({ type: 'application/json', limit: '1mb' }),
  (req, res) => {
    const appSecret = requiredSecret('META_APP_SECRET');

    if (!appSecret) {
      console.error('[webhook/whatsapp] META_APP_SECRET not configured');

      return res.status(500).json({
        ok: false,
        error: 'WEBHOOK_NOT_CONFIGURED',
      });
    }

    const rawBody = req.body;
    const signature = req.headers['x-hub-signature-256'];

    if (!verifyMetaSignature(rawBody, signature, appSecret)) {
      console.warn('[webhook/whatsapp] Invalid signature rejected');

      return res.status(401).json({
        ok: false,
        error: 'INVALID_SIGNATURE',
      });
    }

    let payload;

    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      console.warn(
        '[webhook/whatsapp] Valid signature but body is invalid JSON',
      );

      return res.status(400).json({
        ok: false,
        error: 'INVALID_JSON',
      });
    }

    const entryCount = Array.isArray(payload?.entry)
      ? payload.entry.length
      : 0;

    console.log(
      `[webhook/whatsapp] Authenticated webhook received entries=${entryCount}`,
    );

    return res.status(200).json({
      ok: true,
      authenticated: true,
    });
  },
);

export default router;
