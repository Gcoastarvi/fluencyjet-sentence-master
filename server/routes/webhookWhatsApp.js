import express from 'express';
import crypto from 'crypto';
import prisma from '../db/client.js';
import { normalizeWhatsAppWaId } from '../lib/whatsappNumber.js';
import { acquireWhatsAppDestinationLock } from '../lib/whatsappDestinationLock.js';
import {
  WHATSAPP_REMINDER_EVENT_TYPES,
  scheduleAnyQuestionsAfterCheckoutHelpDelivered,
} from '../lib/whatsappJourney.js';

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


const TRACKED_STATUS_TYPES = new Set([
  'sent',
  'delivered',
  'read',
  'failed',
]);

function safeText(value, maxLength) {
  if (value === undefined || value === null) return null;

  const text = String(value).trim();
  if (!text) return null;

  return text.slice(0, maxLength);
}

function parseMetaTimestamp(value) {
  const seconds = Number(value);

  if (!Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  const date = new Date(seconds * 1000);

  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeMetaError(status) {
  const error =
    Array.isArray(status?.errors) && status.errors.length > 0
      ? status.errors[0]
      : null;

  if (!error) {
    return {
      errorCode: null,
      errorTitle: null,
      errorDetails: null,
    };
  }

  const numericCode = Number(error.code);

  return {
    errorCode: Number.isInteger(numericCode) ? numericCode : null,
    errorTitle: safeText(error.title, 255),
    errorDetails:
      safeText(error?.error_data?.details, 5000) ||
      safeText(error.message, 5000),
  };
}

function makeStatusDedupKey({
  providerMessageId,
  eventType,
  timestamp,
  recipientWaId,
  errorCode,
  errorTitle,
  errorDetails,
}) {
  const canonical = JSON.stringify({
    providerMessageId,
    eventType,
    timestamp: String(timestamp ?? ''),
    recipientWaId: recipientWaId || null,
    errorCode,
    errorTitle,
    errorDetails,
  });

  return crypto
    .createHash('sha256')
    .update(canonical)
    .digest('hex');
}


const OPT_OUT_COMMANDS = new Set([
  'STOP',
  'UNSUBSCRIBE',
  'CANCEL',
  'CANCEL ALL',
  'STOP ALL',
  'UNSUBSCRIBE ALL',
]);

function normalizeInboundCommand(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function makeInboundDedupKey({
  providerMessageId,
  senderWaId,
}) {
  const canonical = JSON.stringify({
    providerMessageId,
    eventType: 'INBOUND_TEXT',
    senderWaId,
  });

  return crypto
    .createHash('sha256')
    .update(canonical)
    .digest('hex');
}

async function processStatusEvents(payload) {
  const summary = {
    processed: 0,
    duplicates: 0,
    unlinked: 0,
    skipped: 0,
  };

  const entries = Array.isArray(payload?.entry) ? payload.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];

    for (const change of changes) {
      const statuses = Array.isArray(change?.value?.statuses)
        ? change.value.statuses
        : [];

      for (const status of statuses) {
        const providerMessageId = safeText(status?.id, 255);
        const rawStatus = safeText(status?.status, 50)?.toLowerCase();

        if (
          !providerMessageId ||
          !rawStatus ||
          !TRACKED_STATUS_TYPES.has(rawStatus)
        ) {
          summary.skipped += 1;
          continue;
        }

        const eventType = rawStatus.toUpperCase();
        const recipientWaId = safeText(status?.recipient_id, 30);
        const eventTimestamp = parseMetaTimestamp(status?.timestamp);

        const {
          errorCode,
          errorTitle,
          errorDetails,
        } = normalizeMetaError(status);

        const dedupKey = makeStatusDedupKey({
          providerMessageId,
          eventType,
          timestamp: status?.timestamp,
          recipientWaId,
          errorCode,
          errorTitle,
          errorDetails,
        });

        try {
          const result = await prisma.$transaction(async (transaction) => {
            const automationEvent =
              await transaction.automationEvent.findUnique({
                where: {
                  providerMessageId,
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

            const persistedStatusEvent =
              await transaction.whatsAppMessageEvent.create({
                data: {
                  automationEventId: automationEvent?.id || null,
                  providerMessageId,
                  eventType,
                  recipientWaId,
                  senderWaId: null,
                  eventTimestamp,
                  errorCode,
                  errorTitle,
                  errorDetails,
                  rawPayload: status,
                  dedupKey,
                },
              });

            if (eventType === 'DELIVERED' && automationEvent) {
              await scheduleAnyQuestionsAfterCheckoutHelpDelivered({
                transaction,
                checkoutHelpEvent: automationEvent,
                deliveryEvent: persistedStatusEvent,
              });
            }

            return { linked: Boolean(automationEvent) };
          }, {
            maxWait: 10_000,
            timeout: 30_000,
          });

          summary.processed += 1;

          if (!result.linked) {
            summary.unlinked += 1;
          }
        } catch (error) {
          if (error?.code === 'P2002') {
            summary.duplicates += 1;
            continue;
          }

          throw error;
        }
      }
    }
  }

  return summary;
}


async function processInboundMessages(payload) {
  const summary = {
    processed: 0,
    duplicates: 0,
    optOuts: 0,
    unknownSenders: 0,
    skipped: 0,
  };

  const entries = Array.isArray(payload?.entry) ? payload.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];

    for (const change of changes) {
      const value = change?.value;
      const messages = Array.isArray(value?.messages)
        ? value.messages
        : [];

      const recipientWaId =
        safeText(value?.metadata?.display_phone_number, 30);

      for (const message of messages) {
        const providerMessageId = safeText(message?.id, 255);
        const senderWaId = safeText(message?.from, 30);
        const messageType = safeText(message?.type, 50)?.toLowerCase();

        if (
          !providerMessageId ||
          !senderWaId ||
          messageType !== 'text'
        ) {
          summary.skipped += 1;
          continue;
        }

        const eventTimestamp =
          parseMetaTimestamp(message?.timestamp);

        const command =
          normalizeInboundCommand(message?.text?.body);

        const isOptOut =
          OPT_OUT_COMMANDS.has(command);
        const normalizedSender =
          normalizeWhatsAppWaId(senderWaId);

        const dedupKey = makeInboundDedupKey({
          providerMessageId,
          senderWaId,
        });

        try {
          const outcome = await prisma.$transaction(async (tx) => {
            const inboundEvent =
              await tx.whatsAppMessageEvent.create({
                data: {
                  automationEventId: null,
                  providerMessageId,
                  eventType: 'INBOUND_TEXT',
                  recipientWaId,
                  senderWaId,
                  senderNumberNormalized: normalizedSender,
                  inboundClassification: isOptOut ? 'OPT_OUT' : 'OTHER',
                  inboundCommand: isOptOut ? command : null,
                  eventTimestamp,
                  errorCode: null,
                  errorTitle: null,
                  errorDetails: null,
                  rawPayload: message,
                  dedupKey,
                },
              });

            if (!isOptOut) {
              return 'RECORDED';
            }

            if (!normalizedSender) {
              return 'UNKNOWN';
            }

            // Serialize STOP with the reminder claim/final-gate/provider
            // critical section for this destination. This is deliberately
            // before the durable-suppression write, including for a sender
            // that has no matching local User row.
            await acquireWhatsAppDestinationLock(tx, normalizedSender);

            const now = new Date();

            await tx.whatsAppPhoneSuppression.upsert({
              where: {
                phoneNumberNormalized: normalizedSender,
              },
              create: {
                phoneNumberNormalized: normalizedSender,
                isOptedOut: true,
                optedOutAt: now,
                optOutCommand: command,
                sourceEventId: inboundEvent.id,
              },
              update: {
                isOptedOut: true,
                optedOutAt: now,
                optOutCommand: command,
                sourceEventId: inboundEvent.id,
                clearedAt: null,
                clearanceSource: null,
                clearanceReason: null,
                clearedByUserId: null,
              },
            });

            const users = await tx.user.findMany({
              where: {
                whatsapp_number_normalized: normalizedSender,
              },
              select: {
                id: true,
              },
            });

            if (users.length === 0) {
              return 'UNKNOWN';
            }

            const userIds = [
              ...new Set(
                users
                  .map((user) => user.id)
                  .filter((id) => Number.isInteger(id)),
              ),
            ];

            if (userIds.length === 0) {
              return 'UNKNOWN';
            }

            await tx.user.updateMany({
              where: {
                id: {
                  in: userIds,
                },
              },
              data: {
                whatsapp_consent: false,
                whatsapp_opted_out_at: now,
              },
            });

            await tx.automationEvent.updateMany({
              where: {
                userId: {
                  in: userIds,
                },
                eventType: {
                  in: WHATSAPP_REMINDER_EVENT_TYPES,
                },
                status: 'PENDING',
              },
              data: {
                status: 'CANCELLED',
                cancelledAt: now,
                processedAt: now,
              },
            });

            return 'OPT_OUT';
          }, {
            maxWait: 10_000,
            timeout: 30_000,
          });

          summary.processed += 1;

          if (outcome === 'OPT_OUT') {
            summary.optOuts += 1;
          } else if (outcome === 'UNKNOWN') {
            summary.unknownSenders += 1;
          }
        } catch (error) {
          if (error?.code === 'P2002') {
            summary.duplicates += 1;
            continue;
          }

          throw error;
        }
      }
    }
  }

  return summary;
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
  async (req, res) => {
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

    let statusSummary;

    try {
      statusSummary = await processStatusEvents(payload);
    } catch (error) {
      console.error(
        '[webhook/whatsapp] Status processing failed:',
        error?.message || error,
      );

      return res.status(500).json({
        ok: false,
        error: 'WEBHOOK_PROCESSING_FAILED',
      });
    }

    let inboundSummary;

    try {
      inboundSummary = await processInboundMessages(payload);
    } catch (error) {
      console.error(
        '[webhook/whatsapp] Inbound processing failed:',
        error?.message || error,
      );

      return res.status(500).json({
        ok: false,
        error: 'WEBHOOK_PROCESSING_FAILED',
      });
    }

    console.log(
      `[webhook/whatsapp] Authenticated webhook received entries=${entryCount} ` +
        `statusesProcessed=${statusSummary.processed} ` +
        `statusDuplicates=${statusSummary.duplicates} ` +
        `unlinked=${statusSummary.unlinked} ` +
        `inboundProcessed=${inboundSummary.processed} ` +
        `inboundDuplicates=${inboundSummary.duplicates} ` +
        `optOuts=${inboundSummary.optOuts} ` +
        `unknownSenders=${inboundSummary.unknownSenders} ` +
        `inboundSkipped=${inboundSummary.skipped}`,
    );

    return res.status(200).json({
      ok: true,
      authenticated: true,
    });
  },
);

export default router;
