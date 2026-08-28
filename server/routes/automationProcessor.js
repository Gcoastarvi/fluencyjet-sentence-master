// server/routes/automationProcessor.js
//
// Phase 2 – DRY_RUN reminder processor (single-reminder endpoint).
// Phase 3 – Batch DRY_RUN processor (explicit-ID and discovery modes).
//
// Protected endpoints for manually evaluating due LESSON1_SIGNUP_REMINDER events.
// No WhatsApp messages are sent. No cron is used. No live sends occur.
//
import express from 'express';
import crypto from 'crypto';
import prisma from '../db/client.js';
import { sendWhatsAppTemplate } from '../services/whatsappProvider.js';
import { normalizeWhatsAppNumber } from '../lib/whatsappNumber.js';
import { acquireWhatsAppDestinationLock } from '../lib/whatsappDestinationLock.js';
import {
  ANY_QUESTIONS_REMINDER,
  CHECKOUT_HELP_REMINDER,
  LEARNING_PATH_DISCOVERY_REMINDER,
  LEARNING_PATH_EXPLORED,
  LESSON1_OPENED,
  LESSON1_SIGNUP_REMINDER,
  LESSON1_WATCH_REMINDER,
  SENTENCE_MASTER_PRODUCT_KEY,
  WHATSAPP_REMINDER_EVENT_TYPES,
  hasJourneyMilestone,
  scheduleAnyQuestionsAfterCheckoutHelpSent,
} from '../lib/whatsappJourney.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------
const POISON     = new Set(['undefined', 'null', 'false', '0', 'none', 'secret']);
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BATCH  = 10;
const MAX_SENDING_AUDIT_LIMIT = 100;
const MAX_SENDING_AUDIT_AGE_MINUTES = 525_600;
const DESTINATION_LOCK_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 30_000,
};
const PROVIDER_DISPATCH_TIMEOUT_MS = 12_000;
const RECONCILIATION_AUTH_METHOD = 'AUTOMATION_BEARER';
const RECONCILIATION_ACTIONS = new Set(['MARK_SENT', 'QUARANTINE']);
const QUARANTINE_REASON_CODES = new Set([
  'FAILED_EVIDENCE',
  'OUTCOME_UNKNOWN',
]);
const PROVIDER_SUCCESS_STATUSES = new Set(['SENT', 'DELIVERED', 'READ']);
const PROVIDER_FAILURE_STATUS = 'FAILED';
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
const DEFAULT_SENDING_MONITOR_WINDOW_MINUTES = 1_440;
const MAX_SENDING_MONITOR_WINDOW_MINUTES = 525_600;
const DEFAULT_SENDING_MONITOR_HISTORY_LIMIT = 25;
const MAX_SENDING_MONITOR_HISTORY_LIMIT = 100;
const DEFAULT_DUE_REMINDER_PREVIEW_LIMIT = 10;
const MAX_DUE_REMINDER_PREVIEW_LIMIT = 10;
const DEFAULT_ROLLOUT_CANDIDATE_LIMIT = 10;
const MAX_ROLLOUT_CANDIDATE_LIMIT = 10;
const ROLLOUT_WATERMARK_ENV_NAMES = [
  'WHATSAPP_LESSON1_ROLLOUT_WATERMARK',
  'WHATSAPP_ROLLOUT_WATERMARK',
];
const ROLLOUT_WATERMARK_ISO_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const WHATSAPP_REMINDER_EVENT_TYPE_SET =
  new Set(WHATSAPP_REMINDER_EVENT_TYPES);
const RECONCILIABLE_REMINDER_EVENT_TYPE_SET = new Set([
  LESSON1_SIGNUP_REMINDER,
  CHECKOUT_HELP_REMINDER,
  ANY_QUESTIONS_REMINDER,
]);

function getLesson1TemplateConfiguration() {
  return {
    templateName: (process.env.WHATSAPP_LESSON1_TEMPLATE_NAME || '').trim(),
    languageCode: (process.env.WHATSAPP_LESSON1_TEMPLATE_LANGUAGE || '').trim(),
  };
}

export function getReminderTemplateConfiguration(eventType) {
  const languageCode =
    (process.env.WHATSAPP_LESSON1_TEMPLATE_LANGUAGE || '').trim();

  if (eventType === LESSON1_SIGNUP_REMINDER) {
    return {
      templateName:
        (process.env.WHATSAPP_LESSON1_TEMPLATE_NAME || '').trim(),
      languageCode,
    };
  }

  if (eventType === LESSON1_WATCH_REMINDER) {
    return {
      templateName: 'fj_watch_lesson1_v1',
      languageCode,
    };
  }

  if (eventType === LEARNING_PATH_DISCOVERY_REMINDER) {
    return {
      templateName: 'fj_discover_learning_path_v1',
      languageCode,
    };
  }

  if (eventType === CHECKOUT_HELP_REMINDER) {
    return {
      templateName: 'fj_checkout_help_v1',
      languageCode,
    };
  }

  if (eventType === ANY_QUESTIONS_REMINDER) {
    return {
      templateName: 'fj_any_questions_v1',
      languageCode,
    };
  }

  return null;
}

function isWhatsAppLiveSendEnabled() {
  return (
    (process.env.WHATSAPP_LIVE_SEND_ENABLED || '').trim().toLowerCase() ===
    'true'
  );
}

async function sendTemplateWithinDestinationLock(
  sendTemplate,
  message,
  timeoutMilliseconds,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);

  try {
    return await sendTemplate({
      ...message,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function getPhoneLevelSkipReason(
  ownerUserId,
  normalizedNumber,
  { checkDurableSuppression = false, database = prisma } = {},
) {
  if (checkDurableSuppression) {
    const suppression = await database.whatsAppPhoneSuppression.findUnique({
      where: {
        phoneNumberNormalized: normalizedNumber,
      },
      select: {
        isOptedOut: true,
      },
    });

    if (suppression?.isOptedOut === true) {
      return 'PHONE_SUPPRESSED';
    }
  }

  // Re-confirm that the reminder owner still owns this canonical destination.
  // If the number changed after the first User read, fail closed.
  const ownerStillMatches = await database.user.findFirst({
    where: {
      id: ownerUserId,
      whatsapp_number_normalized: normalizedNumber,
    },
    select: {
      id: true,
    },
  });

  if (!ownerStillMatches) {
    return 'PHONE_IDENTITY_CHANGED';
  }

  const phoneUsers = await database.user.findMany({
    where: {
      whatsapp_number_normalized: normalizedNumber,
    },
    select: {
      has_access: true,
      whatsapp_opted_out_at: true,
    },
  });

  // Fail closed if the canonical identity unexpectedly resolves to no rows.
  if (phoneUsers.length === 0) {
    return 'PHONE_IDENTITY_NOT_FOUND';
  }

  // A STOP belongs to the WhatsApp destination, not only one User row.
  if (phoneUsers.some((u) => Boolean(u.whatsapp_opted_out_at))) {
    return 'PHONE_OPTED_OUT';
  }

  // Do not send a Lesson 1 acquisition reminder when any account sharing
  // this WhatsApp destination already has product access.
  if (phoneUsers.some((u) => u.has_access === true)) {
    return 'PHONE_HAS_ACCESS';
  }

  return null;
}

function getEventDestination(ae) {
  const storedDestination = ae.destinationNumberNormalized;

  if (
    typeof storedDestination !== 'string' ||
    storedDestination.trim() === ''
  ) {
    return {
      destination: null,
      skipReason: 'MISSING_EVENT_DESTINATION',
    };
  }

  const normalizedDestination = normalizeWhatsAppNumber(storedDestination);

  // The event field is a canonical snapshot. Do not silently repair a value
  // here, because that would make a mutable interpretation of the target.
  if (
    !normalizedDestination ||
    normalizedDestination !== storedDestination
  ) {
    return {
      destination: null,
      skipReason: 'INVALID_EVENT_DESTINATION',
    };
  }

  return {
    destination: normalizedDestination,
    skipReason: null,
  };
}

async function getLiveReminderEligibility(ae, database = prisma) {
  const productKey = ae.productKey || SENTENCE_MASTER_PRODUCT_KEY;

  if (
    !WHATSAPP_REMINDER_EVENT_TYPE_SET.has(ae.eventType) ||
    productKey !== SENTENCE_MASTER_PRODUCT_KEY
  ) {
    return { skipReason: 'UNSUPPORTED_REMINDER' };
  }

  const eventDestination = getEventDestination(ae);

  if (eventDestination.skipReason) {
    return eventDestination;
  }

  const user = await database.user.findUnique({
    where: { id: ae.userId },
    select: {
      id: true,
      name: true,
      email: true,
      whatsapp_consent: true,
      has_access: true,
    },
  });

  if (!user) {
    return { skipReason: 'USER_NOT_FOUND' };
  }

  if (!user.whatsapp_consent) {
    return { skipReason: 'CONSENT_FALSE' };
  }

  if (user.has_access) {
    return { skipReason: 'USER_HAS_ACCESS' };
  }

  const phoneSkipReason = await getPhoneLevelSkipReason(
    user.id,
    eventDestination.destination,
    { checkDurableSuppression: true, database },
  );

  if (phoneSkipReason) {
    return { skipReason: phoneSkipReason };
  }

  // Keep template-parameter validation ahead of business-completion
  // classification. The final locked revalidation still executes the
  // business check because the initial live path never claims a row without
  // a usable learner name.
  if (!String(user.name || '').trim()) {
    return {
      skipReason: null,
      destination: eventDestination.destination,
      user,
    };
  }

  const businessSkipReason = await getReminderBusinessSkipReason(
    {
      ...ae,
      productKey,
    },
    database,
  );

  if (businessSkipReason) {
    return { skipReason: businessSkipReason };
  }

  return {
    destination: eventDestination.destination,
    skipReason: null,
    user,
  };
}

async function isLesson1Complete(userId, database = prisma) {
  const lesson1 = await database.lessonModeProgress.findUnique({
    where: {
      userId_lessonId_mode: {
        userId: String(userId),
        lessonId: 1,
        mode: 'reorder',
      },
    },
    select: { completed: true },
  });

  return Number(lesson1?.completed || 0) >= 10;
}

async function getReminderBusinessSkipReason(ae, database = prisma) {
  if (ae.eventType === LESSON1_SIGNUP_REMINDER) {
    return await isLesson1Complete(ae.userId, database)
      ? 'LESSON1_COMPLETE'
      : null;
  }

  if (ae.eventType === LESSON1_WATCH_REMINDER) {
    return await hasJourneyMilestone({
      database,
      userId: ae.userId,
      productKey: ae.productKey,
      milestoneType: LESSON1_OPENED,
    })
      ? 'LESSON1_OPENED'
      : null;
  }

  if (ae.eventType === LEARNING_PATH_DISCOVERY_REMINDER) {
    return await hasJourneyMilestone({
      database,
      userId: ae.userId,
      productKey: ae.productKey,
      milestoneType: LEARNING_PATH_EXPLORED,
    })
      ? 'LEARNING_PATH_EXPLORED'
      : null;
  }

  if (
    ae.eventType === CHECKOUT_HELP_REMINDER ||
    ae.eventType === ANY_QUESTIONS_REMINDER
  ) {
    return null;
  }

  return 'UNSUPPORTED_REMINDER';
}

// ---------------------------------------------------------------------------
// Shared auth helper.
// Sends the 503/401 response itself; returns false if the request is rejected.
// ---------------------------------------------------------------------------
function checkAuth(req, res, tag) {
  const envSecret = process.env.AUTOMATION_SECRET;
  if (!envSecret || envSecret.trim() === '' || POISON.has(envSecret.trim())) {
    console.warn(`[${tag}] Secret not configured on this server.`);
    res.status(503).json({
      ok:      false,
      error:   'AUTOMATION_NOT_CONFIGURED',
      message: 'Automation secret is not configured on this server.',
    });
    return false;
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token || token !== envSecret) {
    console.warn(`[${tag}] Unauthorized request.`);
    res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
    return false;
  }

  return true;
}

function parseSendingAuditInteger(value, {
  name,
  defaultValue,
  minimum,
  maximum,
}) {
  if (value === undefined) return defaultValue;

  if (
    Array.isArray(value) ||
    typeof value !== 'string' ||
    !/^\d+$/.test(value.trim())
  ) {
    return {
      error: `${name} must be a non-negative integer.`,
    };
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < minimum ||
    parsed > maximum
  ) {
    return {
      error: `${name} must be between ${minimum} and ${maximum}.`,
    };
  }

  return parsed;
}

function parseRolloutWatermark() {
  const configuredValues = ROLLOUT_WATERMARK_ENV_NAMES
    .map((name) => ({
      name,
      value: String(process.env[name] || '').trim(),
    }))
    .filter(({ value }) => value !== '');

  if (configuredValues.length === 0) {
    return {
      error: 'WHATSAPP_ROLLOUT_WATERMARK_NOT_CONFIGURED',
    };
  }

  if (configuredValues.some(({ value }) => POISON.has(value.toLowerCase()))) {
    return {
      error: 'WHATSAPP_ROLLOUT_WATERMARK_INVALID',
    };
  }

  if (
    configuredValues.some(
      ({ value }) => !ROLLOUT_WATERMARK_ISO_RE.test(value),
    )
  ) {
    return {
      error: 'WHATSAPP_ROLLOUT_WATERMARK_INVALID',
    };
  }

  const parsed = new Date(configuredValues[0].value);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString() !== configuredValues[0].value
  ) {
    return {
      error: 'WHATSAPP_ROLLOUT_WATERMARK_INVALID',
    };
  }

  if (
    configuredValues.some(({ value }) => {
      const other = new Date(value);
      return (
        Number.isNaN(other.getTime()) ||
        other.getTime() !== parsed.getTime()
      );
    })
  ) {
    return {
      error: 'WHATSAPP_ROLLOUT_WATERMARK_CONFLICT',
    };
  }

  return parsed;
}

function parseRolloutCandidateLimit(value) {
  if (value === undefined) return DEFAULT_ROLLOUT_CANDIDATE_LIMIT;

  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_ROLLOUT_CANDIDATE_LIMIT
  ) {
    return {
      error: `limit must be between 1 and ${MAX_ROLLOUT_CANDIDATE_LIMIT}.`,
    };
  }

  return value;
}

function isValidSendingAuditDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function formatSendingAuditDate(value) {
  return isValidSendingAuditDate(value) ? value.toISOString() : null;
}

function getSendingAuditAgeAnchor(row) {
  if (isValidSendingAuditDate(row.processedAt)) {
    return row.processedAt;
  }

  if (isValidSendingAuditDate(row.createdAt)) {
    return row.createdAt;
  }

  return null;
}

function compareSendingAuditRows(left, right) {
  const leftAnchor = getSendingAuditAgeAnchor(left);
  const rightAnchor = getSendingAuditAgeAnchor(right);

  if (leftAnchor === null && rightAnchor === null) {
    return String(left.id).localeCompare(String(right.id));
  }
  if (leftAnchor === null) return 1;
  if (rightAnchor === null) return -1;

  const anchorDifference = leftAnchor.getTime() - rightAnchor.getTime();
  if (anchorDifference !== 0) return anchorDifference;

  return String(left.id).localeCompare(String(right.id));
}

function formatSendingAuditRow(row, now) {
  const ageAnchor = getSendingAuditAgeAnchor(row);
  const ageBasis =
    isValidSendingAuditDate(row.processedAt)
      ? 'processedAt'
      : isValidSendingAuditDate(row.createdAt)
        ? 'createdAt-fallback'
        : 'missing';

  return {
    id: row.id,
    userId: row.userId,
    eventType: row.eventType,
    createdAt: formatSendingAuditDate(row.createdAt),
    scheduledAt: formatSendingAuditDate(row.scheduledAt),
    processedAt: formatSendingAuditDate(row.processedAt),
    sentAt: formatSendingAuditDate(row.sentAt),
    providerMessageIdPresent: Boolean(row.providerMessageId),
    destination: row.destinationNumberNormalized ? '[masked]' : null,
    ageHours:
      ageAnchor === null
        ? null
        : Number(
            ((now.getTime() - ageAnchor.getTime()) / 3_600_000).toFixed(2),
          ),
    ageBasis,
    evidence: {
      count: Array.isArray(row.whatsappEvents)
        ? row.whatsappEvents.length
        : 0,
      events: Array.isArray(row.whatsappEvents)
        ? row.whatsappEvents.map((event) => ({
            id: event.id,
            eventType: event.eventType,
            eventTimestamp: formatSendingAuditDate(event.eventTimestamp),
            errorCode: event.errorCode ?? null,
            createdAt: formatSendingAuditDate(event.createdAt),
            providerMessageIdPresent: Boolean(event.providerMessageId),
          }))
        : [],
    },
  };
}

function reconciliationRequestHash({
  automationEventId,
  action,
  reasonCode,
}) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        automationEventId,
        action,
        reasonCode: reasonCode ?? null,
      }),
    )
    .digest('hex');
}

function isValidReconciliationIdempotencyKey(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_IDEMPOTENCY_KEY_LENGTH &&
    /^[A-Za-z0-9._:-]+$/.test(value)
  );
}

function formatReconciliationJournalResult(journal) {
  const applied = journal.decision === 'APPLIED';

  return {
    status: applied ? 200 : 409,
    body: applied
      ? {
          ok: true,
          action: journal.action,
          automationEventId: journal.automationEventId,
          resultingStatus: journal.resultingStatus,
          reconciliationId: journal.id,
        }
      : {
          ok: false,
          error: 'RECONCILIATION_NOT_APPLIED',
          action: journal.action,
          automationEventId: journal.automationEventId,
          resultingStatus: journal.resultingStatus,
        },
  };
}

function getReconciliationConflictResult() {
  return {
    status: 409,
    body: {
      ok: false,
      error: 'IDEMPOTENCY_KEY_REUSED',
    },
  };
}

function sortEvidenceNewestFirst(left, right) {
  const leftTimestamp =
    left.eventTimestamp instanceof Date &&
    !Number.isNaN(left.eventTimestamp.getTime())
      ? left.eventTimestamp.getTime()
      : Number.NEGATIVE_INFINITY;
  const rightTimestamp =
    right.eventTimestamp instanceof Date &&
    !Number.isNaN(right.eventTimestamp.getTime())
      ? right.eventTimestamp.getTime()
      : Number.NEGATIVE_INFINITY;

  if (leftTimestamp !== rightTimestamp) return rightTimestamp - leftTimestamp;

  const leftCreatedAt =
    left.createdAt instanceof Date && !Number.isNaN(left.createdAt.getTime())
      ? left.createdAt.getTime()
      : Number.NEGATIVE_INFINITY;
  const rightCreatedAt =
    right.createdAt instanceof Date && !Number.isNaN(right.createdAt.getTime())
      ? right.createdAt.getTime()
      : Number.NEGATIVE_INFINITY;

  if (leftCreatedAt !== rightCreatedAt) return rightCreatedAt - leftCreatedAt;
  return String(right.id).localeCompare(String(left.id));
}

function usableProviderSentTimestamp(eventTimestamp, now) {
  if (
    !(eventTimestamp instanceof Date) ||
    Number.isNaN(eventTimestamp.getTime())
  ) {
    return null;
  }

  // Meta timestamps are provider-controlled. Do not write a materially future
  // timestamp into the lifecycle row if the webhook clock is malformed.
  if (eventTimestamp.getTime() > now.getTime() + 5 * 60_000) {
    return null;
  }

  return eventTimestamp;
}

async function findMatchingReconciliationEvidence(transaction, event) {
  if (!event.providerMessageId) return [];

  return transaction.whatsAppMessageEvent.findMany({
    where: {
      automationEventId: event.id,
      providerMessageId: event.providerMessageId,
      eventType: {
        in: [...PROVIDER_SUCCESS_STATUSES, PROVIDER_FAILURE_STATUS],
      },
    },
    select: {
      id: true,
      eventType: true,
      eventTimestamp: true,
      createdAt: true,
    },
  });
}

async function createReconciliationJournalEntry(transaction, data) {
  return transaction.automationReconciliationJournal.create({ data });
}

function journalData({
  event,
  idempotencyKey,
  requestHash,
  action,
  decision,
  resultingStatus,
  reasonCode,
  evidence = null,
}) {
  return {
    automationEventId: event.id,
    idempotencyKey,
    requestHash,
    action,
    decision,
    priorStatus: event.status,
    resultingStatus,
    reasonCode,
    evidenceEventId: evidence?.id ?? null,
    evidenceStatus: evidence?.eventType ?? null,
    authMethod: RECONCILIATION_AUTH_METHOD,
  };
}

// ---------------------------------------------------------------------------
// GET /api/automation/sending-audit
//
// Read-only operator audit for uncertain Lesson 1 reminder attempts.
// This route deliberately has no write, transaction, provider, or retry path.
// ---------------------------------------------------------------------------
router.get('/sending-audit', async (req, res) => {
  if (!checkAuth(req, res, 'AUTOMATION-SENDING-AUDIT')) return;

  const allowedQueryFields = new Set([
    'olderThanMinutes',
    'limit',
    'automationEventId',
  ]);
  const unknownFields = Object.keys(req.query || {}).filter(
    (key) => !allowedQueryFields.has(key),
  );

  if (unknownFields.length > 0) {
    return res.status(400).json({
      ok: false,
      error: 'UNKNOWN_QUERY_FIELDS',
    });
  }

  const olderThanMinutes = parseSendingAuditInteger(
    req.query?.olderThanMinutes,
    {
      name: 'olderThanMinutes',
      defaultValue: 0,
      minimum: 0,
      maximum: MAX_SENDING_AUDIT_AGE_MINUTES,
    },
  );
  const limit = parseSendingAuditInteger(req.query?.limit, {
    name: 'limit',
    defaultValue: MAX_SENDING_AUDIT_LIMIT,
    minimum: 1,
    maximum: MAX_SENDING_AUDIT_LIMIT,
  });

  if (typeof olderThanMinutes === 'object' || typeof limit === 'object') {
    const parameterError =
      typeof olderThanMinutes === 'object'
        ? olderThanMinutes.error
        : limit.error;

    return res.status(400).json({
      ok: false,
      error: 'INVALID_QUERY_PARAMETERS',
      message: parameterError,
    });
  }

  const automationEventId = req.query?.automationEventId;

  if (
    automationEventId !== undefined &&
    (
      Array.isArray(automationEventId) ||
      typeof automationEventId !== 'string' ||
      !UUID_V4_RE.test(automationEventId)
    )
  ) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_AUTOMATION_EVENT_ID',
    });
  }

  const now = new Date();
  const baseWhere = {
    status: 'SENDING',
    eventType: 'LESSON1_SIGNUP_REMINDER',
  };

  if (automationEventId !== undefined) {
    baseWhere.id = automationEventId;
  }

  if (olderThanMinutes > 0) {
    const cutoff = new Date(
      now.getTime() - olderThanMinutes * 60_000,
    );
    baseWhere.OR = [
      { processedAt: { lte: cutoff } },
      {
        processedAt: null,
        createdAt: { lte: cutoff },
      },
    ];
  }

  const select = {
    id: true,
    userId: true,
    eventType: true,
    createdAt: true,
    scheduledAt: true,
    processedAt: true,
    sentAt: true,
    providerMessageId: true,
    destinationNumberNormalized: true,
    whatsappEvents: {
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        providerMessageId: true,
        eventType: true,
        eventTimestamp: true,
        errorCode: true,
        createdAt: true,
      },
    },
  };

  try {
    // Query the normal and fallback age anchors separately so that a bounded
    // result can still be ordered by the effective age anchor. Fetching the
    // first `limit` from each sorted partition is enough to produce the first
    // `limit` rows of their merged, oldest-first order.
    const [count, processedRows, fallbackRows] = await Promise.all([
      prisma.automationEvent.count({ where: baseWhere }),
      prisma.automationEvent.findMany({
        where: {
          ...baseWhere,
          processedAt: { not: null },
        },
        select,
        orderBy: [
          { processedAt: 'asc' },
          { id: 'asc' },
        ],
        take: limit,
      }),
      prisma.automationEvent.findMany({
        where: {
          ...baseWhere,
          processedAt: null,
        },
        select,
        orderBy: [
          { createdAt: 'asc' },
          { id: 'asc' },
        ],
        take: limit,
      }),
    ]);
    const rows = [...processedRows, ...fallbackRows]
      .sort(compareSendingAuditRows)
      .slice(0, limit);

    return res.json({
      ok: true,
      generatedAt: now.toISOString(),
      filters: {
        status: 'SENDING',
        eventType: 'LESSON1_SIGNUP_REMINDER',
        olderThanMinutes,
        limit,
        automationEventId: automationEventId ?? null,
      },
      count,
      hasMore: count > rows.length,
      rows: rows.map((row) => formatSendingAuditRow(row, now)),
    });
  } catch {
    console.error(
      '[AUTOMATION-SENDING-AUDIT] Database read failed.',
    );
    return res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
    });
  }
});

function sendingMonitorHistoryRow(row) {
  return {
    journalId: row.id,
    automationEventId: row.automationEventId,
    createdAt: formatSendingAuditDate(row.createdAt),
    action: row.action,
    decision: row.decision,
    priorStatus: row.priorStatus,
    resultingStatus: row.resultingStatus,
    reasonCode: row.reasonCode,
    evidenceStatus: row.evidenceStatus,
  };
}

// ---------------------------------------------------------------------------
// GET /api/automation/sending-monitor
//
// Bounded operator monitoring only. This route intentionally has no writes,
// transaction state changes, provider calls, retries, or work discovery.
// ---------------------------------------------------------------------------
router.get('/sending-monitor', async (req, res) => {
  if (!checkAuth(req, res, 'AUTOMATION-SENDING-MONITOR')) return;

  const allowedQueryFields = new Set(['windowMinutes', 'historyLimit']);
  const unknownFields = Object.keys(req.query || {}).filter(
    (key) => !allowedQueryFields.has(key),
  );

  if (unknownFields.length > 0) {
    return res.status(400).json({
      ok: false,
      error: 'UNKNOWN_QUERY_FIELDS',
    });
  }

  const windowMinutes = parseSendingAuditInteger(
    req.query?.windowMinutes,
    {
      name: 'windowMinutes',
      defaultValue: DEFAULT_SENDING_MONITOR_WINDOW_MINUTES,
      minimum: 1,
      maximum: MAX_SENDING_MONITOR_WINDOW_MINUTES,
    },
  );
  const historyLimit = parseSendingAuditInteger(
    req.query?.historyLimit,
    {
      name: 'historyLimit',
      defaultValue: DEFAULT_SENDING_MONITOR_HISTORY_LIMIT,
      minimum: 0,
      maximum: MAX_SENDING_MONITOR_HISTORY_LIMIT,
    },
  );

  if (typeof windowMinutes === 'object' || typeof historyLimit === 'object') {
    const parameterError =
      typeof windowMinutes === 'object'
        ? windowMinutes.error
        : historyLimit.error;

    return res.status(400).json({
      ok: false,
      error: 'INVALID_QUERY_PARAMETERS',
      message: parameterError,
    });
  }

  const now = new Date();
  const since = new Date(now.getTime() - windowMinutes * 60_000);
  const age15Minutes = new Date(now.getTime() - 15 * 60_000);
  const age1Hour = new Date(now.getTime() - 60 * 60_000);
  const age6Hours = new Date(now.getTime() - 6 * 60 * 60_000);
  const age24Hours = new Date(now.getTime() - 24 * 60 * 60_000);
  const age7Days = new Date(now.getTime() - 7 * 24 * 60 * 60_000);

  try {
    const [
      eventRows,
      sendingRows,
      failureRows,
      reconciliationRows,
      historyResult,
    ] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          'due' AS "bucket",
          COUNT(*) AS "count"
        FROM "AutomationEvent"
        WHERE "eventType" = 'LESSON1_SIGNUP_REMINDER'
          AND "status" = 'PENDING'
          AND "scheduledAt" IS NOT NULL
          AND "scheduledAt" <= ${now}
        UNION ALL
        SELECT
          'scheduledFuture' AS "bucket",
          COUNT(*) AS "count"
        FROM "AutomationEvent"
        WHERE "eventType" = 'LESSON1_SIGNUP_REMINDER'
          AND "status" = 'PENDING'
          AND "scheduledAt" > ${now}
        UNION ALL
        SELECT
          'unscheduled' AS "bucket",
          COUNT(*) AS "count"
        FROM "AutomationEvent"
        WHERE "eventType" = 'LESSON1_SIGNUP_REMINDER'
          AND "status" = 'PENDING'
          AND "scheduledAt" IS NULL
      `,
      prisma.$queryRaw`
        SELECT
          'under15Minutes' AS "bucket",
          COUNT(*) AS "count"
        FROM "AutomationEvent"
        WHERE "eventType" = 'LESSON1_SIGNUP_REMINDER'
          AND "status" = 'SENDING'
          AND "processedAt" > ${age15Minutes}
        UNION ALL
        SELECT
          'under15Minutes' AS "bucket",
          COUNT(*) AS "count"
        FROM "AutomationEvent"
        WHERE "eventType" = 'LESSON1_SIGNUP_REMINDER'
          AND "status" = 'SENDING'
          AND "processedAt" IS NULL
          AND "createdAt" > ${age15Minutes}
        UNION ALL
        SELECT
          'minutes15To1Hour' AS "bucket",
          COUNT(*) AS "count"
        FROM "AutomationEvent"
        WHERE "eventType" = 'LESSON1_SIGNUP_REMINDER'
          AND "status" = 'SENDING'
          AND "processedAt" > ${age1Hour}
          AND "processedAt" <= ${age15Minutes}
        UNION ALL
        SELECT
          'minutes15To1Hour' AS "bucket",
          COUNT(*) AS "count"
        FROM "AutomationEvent"
        WHERE "eventType" = 'LESSON1_SIGNUP_REMINDER'
          AND "status" = 'SENDING'
          AND "processedAt" IS NULL
          AND "createdAt" > ${age1Hour}
          AND "createdAt" <= ${age15Minutes}
        UNION ALL
        SELECT
          'hours1To6' AS "bucket",
          COUNT(*) AS "count"
        FROM "AutomationEvent"
        WHERE "eventType" = 'LESSON1_SIGNUP_REMINDER'
          AND "status" = 'SENDING'
          AND "processedAt" > ${age6Hours}
          AND "processedAt" <= ${age1Hour}
        UNION ALL
        SELECT
          'hours1To6' AS "bucket",
          COUNT(*) AS "count"
        FROM "AutomationEvent"
        WHERE "eventType" = 'LESSON1_SIGNUP_REMINDER'
          AND "status" = 'SENDING'
          AND "processedAt" IS NULL
          AND "createdAt" > ${age6Hours}
          AND "createdAt" <= ${age1Hour}
        UNION ALL
        SELECT
          'hours6To24' AS "bucket",
          COUNT(*) AS "count"
        FROM "AutomationEvent"
        WHERE "eventType" = 'LESSON1_SIGNUP_REMINDER'
          AND "status" = 'SENDING'
          AND "processedAt" > ${age24Hours}
          AND "processedAt" <= ${age6Hours}
        UNION ALL
        SELECT
          'hours6To24' AS "bucket",
          COUNT(*) AS "count"
        FROM "AutomationEvent"
        WHERE "eventType" = 'LESSON1_SIGNUP_REMINDER'
          AND "status" = 'SENDING'
          AND "processedAt" IS NULL
          AND "createdAt" > ${age24Hours}
          AND "createdAt" <= ${age6Hours}
        UNION ALL
        SELECT
          'days1To7' AS "bucket",
          COUNT(*) AS "count"
        FROM "AutomationEvent"
        WHERE "eventType" = 'LESSON1_SIGNUP_REMINDER'
          AND "status" = 'SENDING'
          AND "processedAt" > ${age7Days}
          AND "processedAt" <= ${age24Hours}
        UNION ALL
        SELECT
          'days1To7' AS "bucket",
          COUNT(*) AS "count"
        FROM "AutomationEvent"
        WHERE "eventType" = 'LESSON1_SIGNUP_REMINDER'
          AND "status" = 'SENDING'
          AND "processedAt" IS NULL
          AND "createdAt" > ${age7Days}
          AND "createdAt" <= ${age24Hours}
        UNION ALL
        SELECT
          'over7Days' AS "bucket",
          COUNT(*) AS "count"
        FROM "AutomationEvent"
        WHERE "eventType" = 'LESSON1_SIGNUP_REMINDER'
          AND "status" = 'SENDING'
          AND "processedAt" <= ${age7Days}
        UNION ALL
        SELECT
          'over7Days' AS "bucket",
          COUNT(*) AS "count"
        FROM "AutomationEvent"
        WHERE "eventType" = 'LESSON1_SIGNUP_REMINDER'
          AND "status" = 'SENDING'
          AND "processedAt" IS NULL
          AND "createdAt" <= ${age7Days}
      `,
      prisma.$queryRaw`
        SELECT
          COUNT(*) AS "observedInWindow",
          COUNT(*) FILTER (
            WHERE "automationEventId" IS NOT NULL
          ) AS "linkedToAutomationEvent",
          COUNT(*) FILTER (
            WHERE "automationEventId" IS NULL
          ) AS "unlinked",
          COUNT(*) FILTER (
            WHERE "eventTimestamp" IS NULL
          ) AS "missingTimestamp"
        FROM "WhatsAppMessageEvent"
        WHERE "eventType" = ${PROVIDER_FAILURE_STATUS}
          AND "createdAt" >= ${since}
      `,
      prisma.$queryRaw`
        SELECT
          COUNT(*) FILTER (
            WHERE j."action" = 'MARK_SENT'
              AND j."decision" = 'APPLIED'
          ) AS "markSentApplied",
          COUNT(*) FILTER (
            WHERE j."action" = 'MARK_SENT'
              AND j."decision" = 'REJECTED'
          ) AS "markSentRejected",
          COUNT(*) FILTER (
            WHERE j."action" = 'QUARANTINE'
              AND j."decision" = 'APPLIED'
          ) AS "quarantineApplied",
          COUNT(*) FILTER (
            WHERE j."action" = 'QUARANTINE'
              AND j."decision" = 'REJECTED'
          ) AS "quarantineRejected"
        FROM "AutomationReconciliationJournal" j
        INNER JOIN "AutomationEvent" ae
          ON ae."id" = j."automationEventId"
        WHERE j."createdAt" >= ${since}
          AND ae."eventType" = 'LESSON1_SIGNUP_REMINDER'
      `,
      historyLimit > 0
        ? prisma.$queryRaw`
            SELECT
              j."id" AS "id",
              j."automationEventId" AS "automationEventId",
              j."createdAt" AS "createdAt",
              j."action" AS "action",
              j."decision" AS "decision",
              j."priorStatus" AS "priorStatus",
              j."resultingStatus" AS "resultingStatus",
              j."reasonCode" AS "reasonCode",
              j."evidenceStatus" AS "evidenceStatus"
            FROM "AutomationReconciliationJournal" j
            INNER JOIN "AutomationEvent" ae
              ON ae."id" = j."automationEventId"
            WHERE j."createdAt" >= ${since}
              AND ae."eventType" = 'LESSON1_SIGNUP_REMINDER'
            ORDER BY j."createdAt" DESC, j."id" DESC
            LIMIT ${historyLimit + 1}
          `
        : Promise.resolve([]),
    ]);

    const failureMetrics = failureRows[0] || {};
    const reconciliationMetrics = reconciliationRows[0] || {};
    const count = (value) => Number(value ?? 0);
    const bucketCounts = (rows) => rows.reduce((result, row) => {
      result[row.bucket] = (result[row.bucket] || 0) + count(row.count);
      return result;
    }, {});
    const pendingBuckets = bucketCounts(eventRows);
    const sendingBuckets = bucketCounts(sendingRows);
    const pendingDue = pendingBuckets.due || 0;
    const pendingScheduledFuture = pendingBuckets.scheduledFuture || 0;
    const pendingUnscheduled = pendingBuckets.unscheduled || 0;
    const pendingTotal =
      pendingDue + pendingScheduledFuture + pendingUnscheduled;
    const sendingTotal = [
      'under15Minutes',
      'minutes15To1Hour',
      'hours1To6',
      'hours6To24',
      'days1To7',
      'over7Days',
    ].reduce((total, bucket) => total + (sendingBuckets[bucket] || 0), 0);
    const history = historyResult.slice(0, historyLimit);
    const markSentApplied = count(reconciliationMetrics.markSentApplied);
    const markSentRejected = count(reconciliationMetrics.markSentRejected);
    const quarantineApplied = count(reconciliationMetrics.quarantineApplied);
    const quarantineRejected = count(reconciliationMetrics.quarantineRejected);

    return res.json({
      ok: true,
      generatedAt: now.toISOString(),
      window: {
        minutes: windowMinutes,
        since: since.toISOString(),
        providerFailedWebhookEventsBasis: 'createdAt',
        reconciliationJournalBasis: 'createdAt',
      },
      current: {
        pending: {
          total: pendingTotal,
          due: pendingDue,
          scheduledFuture: pendingScheduledFuture,
          unscheduled: pendingUnscheduled,
        },
        sending: {
          total: sendingTotal,
          ageBasis: 'processedAt-or-createdAt',
          buckets: {
            under15Minutes: sendingBuckets.under15Minutes || 0,
            minutes15To1Hour: sendingBuckets.minutes15To1Hour || 0,
            hours1To6: sendingBuckets.hours1To6 || 0,
            hours6To24: sendingBuckets.hours6To24 || 0,
            days1To7: sendingBuckets.days1To7 || 0,
            over7Days: sendingBuckets.over7Days || 0,
            missingAge: 0,
          },
        },
      },
      providerFailedWebhookEvents: {
        observedInWindow: count(failureMetrics.observedInWindow),
        linkedToAutomationEvent: count(failureMetrics.linkedToAutomationEvent),
        unlinked: count(failureMetrics.unlinked),
        missingTimestamp: count(failureMetrics.missingTimestamp),
      },
      reconciliation: {
        MARK_SENT: {
          totalJournalEntries: markSentApplied + markSentRejected,
          applied: markSentApplied,
          rejected: markSentRejected,
        },
        QUARANTINE: {
          totalJournalEntries: quarantineApplied + quarantineRejected,
          applied: quarantineApplied,
          rejected: quarantineRejected,
        },
      },
      recentReconciliations: history.map(sendingMonitorHistoryRow),
      recentReconciliationsHasMore:
        historyLimit > 0 && historyResult.length > history.length,
    });
  } catch {
    console.error('[AUTOMATION-SENDING-MONITOR] Database read failed.');
    return res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
    });
  }
});

function formatDueReminderPreviewRow(ae, eligibility, now) {
  const reasonCode = eligibility.skipReason ?? null;

  return {
    automationEventId: ae.id,
    eventType: ae.eventType,
    status: ae.status,
    scheduledAt: formatSendingAuditDate(ae.scheduledAt),
    due: ae.scheduledAt instanceof Date && ae.scheduledAt <= now,
    destination: ae.destinationNumberNormalized ? '[masked]' : null,
    eligibility: {
      decision: reasonCode ? 'EXCLUDED' : 'ELIGIBLE',
      reasonCode,
    },
  };
}

// ---------------------------------------------------------------------------
// GET /api/automation/due-reminder-preview
//
// Bounded operator preview only. This route intentionally has no writes,
// transactions, locks, provider calls, retries, or work discovery.
// ---------------------------------------------------------------------------
router.get('/due-reminder-preview', async (req, res) => {
  if (!checkAuth(req, res, 'AUTOMATION-DUE-REMINDER-PREVIEW')) return;

  const allowedQueryFields = new Set(['limit', 'automationEventId']);
  const unknownFields = Object.keys(req.query || {}).filter(
    (key) => !allowedQueryFields.has(key),
  );

  if (unknownFields.length > 0) {
    return res.status(400).json({
      ok: false,
      error: 'UNKNOWN_QUERY_FIELDS',
    });
  }

  const limit = parseSendingAuditInteger(req.query?.limit, {
    name: 'limit',
    defaultValue: DEFAULT_DUE_REMINDER_PREVIEW_LIMIT,
    minimum: 1,
    maximum: MAX_DUE_REMINDER_PREVIEW_LIMIT,
  });

  if (typeof limit === 'object') {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_QUERY_PARAMETERS',
      message: limit.error,
    });
  }

  const automationEventId = req.query?.automationEventId;
  if (
    automationEventId !== undefined &&
    (
      Array.isArray(automationEventId) ||
      typeof automationEventId !== 'string' ||
      !UUID_V4_RE.test(automationEventId)
    )
  ) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_AUTOMATION_EVENT_ID',
    });
  }

  const { templateName, languageCode } = getLesson1TemplateConfiguration();
  if (!templateName || !languageCode) {
    return res.status(503).json({
      ok: false,
      error: 'WHATSAPP_TEMPLATE_NOT_CONFIGURED',
    });
  }

  const now = new Date();

  try {
    const dueEvents = await prisma.automationEvent.findMany({
      where: {
        ...(automationEventId !== undefined
          ? { id: automationEventId }
          : {}),
        eventType: 'LESSON1_SIGNUP_REMINDER',
        status: 'PENDING',
        scheduledAt: { lte: now },
      },
      orderBy: [
        { scheduledAt: 'asc' },
        { id: 'asc' },
      ],
      take: limit,
      select: {
        id: true,
        eventType: true,
        status: true,
        userId: true,
        scheduledAt: true,
        destinationNumberNormalized: true,
      },
    });

    const rows = [];
    const exclusionReasons = {};

    for (const ae of dueEvents.slice(0, limit)) {
      const eligibility = await getLiveReminderEligibility(ae, prisma);
      const learnerName = String(eligibility.user?.name || '').trim();

      if (!eligibility.skipReason && !learnerName) {
        eligibility.skipReason = 'WHATSAPP_TEMPLATE_PARAMETER_MISSING';
      }

      const row = formatDueReminderPreviewRow(ae, eligibility, now);
      rows.push(row);

      if (row.eligibility.reasonCode) {
        const reason = row.eligibility.reasonCode;
        exclusionReasons[reason] = (exclusionReasons[reason] || 0) + 1;
      }
    }

    const eligible = rows.filter(
      (row) => row.eligibility.decision === 'ELIGIBLE',
    ).length;
    const excluded = rows.length - eligible;

    return res.json({
      ok: true,
      preview: 'LESSON1_SIGNUP_REMINDER',
      generatedAt: now.toISOString(),
      limit,
      counts: {
        examined: rows.length,
        eligible,
        excluded,
        exclusionReasons,
      },
      rows,
    });
  } catch {
    console.error('[AUTOMATION-DUE-REMINDER-PREVIEW] Database read failed.');
    return res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/automation/reconcile-sending
//
// Explicit, single-event operator reconciliation for uncertain Lesson 1
// reminder attempts. It never calls a provider, retries, discovers work, or
// returns an event to PENDING.
// ---------------------------------------------------------------------------
router.post('/reconcile-sending', async (req, res) => {
  if (!checkAuth(req, res, 'AUTOMATION-RECONCILIATION')) return;

  const allowedFields = new Set([
    'automationEventId',
    'action',
    'reasonCode',
  ]);
  const unknownFields = Object.keys(req.body || {}).filter(
    (key) => !allowedFields.has(key),
  );

  if (unknownFields.length > 0) {
    return res.status(400).json({
      ok: false,
      error: 'UNKNOWN_FIELDS',
    });
  }

  const automationEventId = req.body?.automationEventId;
  const action = req.body?.action;
  const reasonCode = req.body?.reasonCode;
  const idempotencyKey = req.get('Idempotency-Key');

  if (
    typeof automationEventId !== 'string' ||
    !UUID_V4_RE.test(automationEventId)
  ) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_AUTOMATION_EVENT_ID',
    });
  }

  if (typeof action !== 'string' || !RECONCILIATION_ACTIONS.has(action)) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_RECONCILIATION_ACTION',
    });
  }

  if (!isValidReconciliationIdempotencyKey(idempotencyKey)) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_IDEMPOTENCY_KEY',
    });
  }

  if (action === 'MARK_SENT' && reasonCode !== undefined) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_RECONCILIATION_REASON',
    });
  }

  if (
    action === 'QUARANTINE' &&
    (
      typeof reasonCode !== 'string' ||
      !QUARANTINE_REASON_CODES.has(reasonCode)
    )
  ) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_RECONCILIATION_REASON',
    });
  }

  const requestHash = reconciliationRequestHash({
    automationEventId,
    action,
    reasonCode,
  });

  try {
    const existingJournal =
      await prisma.automationReconciliationJournal.findUnique({
        where: {
          automationEventId_idempotencyKey: {
            automationEventId,
            idempotencyKey,
          },
        },
      });

    if (existingJournal) {
      const result =
        existingJournal.requestHash === requestHash
          ? formatReconciliationJournalResult(existingJournal)
          : getReconciliationConflictResult();
      return res.status(result.status).json(result.body);
    }

    // This pre-lock lookup is only to derive the canonical lock key. The event
    // is re-read inside the transaction after the lock is held.
    const initialEvent = await prisma.automationEvent.findUnique({
      where: { id: automationEventId },
      select: {
        id: true,
        eventType: true,
        destinationNumberNormalized: true,
      },
    });

    if (!initialEvent) {
      return res.status(404).json({
        ok: false,
        error: 'NOT_FOUND',
      });
    }

    if (!RECONCILIABLE_REMINDER_EVENT_TYPE_SET.has(initialEvent.eventType)) {
      return res.status(400).json({
        ok: false,
        error: 'WRONG_EVENT_TYPE',
      });
    }

    const initialDestination = getEventDestination(initialEvent);

    if (initialDestination.skipReason) {
      return res.status(409).json({
        ok: false,
        error: 'RECONCILIATION_NOT_APPLIED',
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      await acquireWhatsAppDestinationLock(tx, initialDestination.destination);

      // Re-check idempotency after serialization so same-event duplicate
      // submissions cannot perform more than one lifecycle transition.
      const journalAfterLock =
        await tx.automationReconciliationJournal.findUnique({
          where: {
            automationEventId_idempotencyKey: {
              automationEventId,
              idempotencyKey,
            },
          },
        });

      if (journalAfterLock) {
        return journalAfterLock.requestHash === requestHash
          ? formatReconciliationJournalResult(journalAfterLock)
          : getReconciliationConflictResult();
      }

      const event = await tx.automationEvent.findUnique({
        where: { id: automationEventId },
        select: {
          id: true,
          userId: true,
          eventType: true,
          productKey: true,
          status: true,
          destinationNumberNormalized: true,
          providerMessageId: true,
          sentAt: true,
        },
      });

      if (
        !event ||
        !RECONCILIABLE_REMINDER_EVENT_TYPE_SET.has(event.eventType) ||
        event.eventType !== initialEvent.eventType ||
        event.destinationNumberNormalized !== initialDestination.destination
      ) {
        return {
          status: 409,
          body: {
            ok: false,
            error: 'RECONCILIATION_NOT_APPLIED',
          },
        };
      }

      const now = new Date();

      if (event.status !== 'SENDING') {
        const journal = await createReconciliationJournalEntry(
          tx,
          journalData({
            event,
            idempotencyKey,
            requestHash,
            action,
            decision: 'REJECTED',
            resultingStatus: event.status,
            reasonCode: 'NOT_SENDING',
          }),
        );
        return formatReconciliationJournalResult(journal);
      }

      const evidence = await findMatchingReconciliationEvidence(tx, event);
      const successEvidence = evidence
        .filter((item) => PROVIDER_SUCCESS_STATUSES.has(item.eventType))
        .sort(sortEvidenceNewestFirst);
      const failedEvidence = evidence
        .filter((item) => item.eventType === PROVIDER_FAILURE_STATUS)
        .sort(sortEvidenceNewestFirst);

      if (action === 'MARK_SENT') {
        if (successEvidence.length === 0) {
          const journal = await createReconciliationJournalEntry(
            tx,
            journalData({
              event,
              idempotencyKey,
              requestHash,
              action,
              decision: 'REJECTED',
              resultingStatus: event.status,
              reasonCode: 'SUCCESS_EVIDENCE_REQUIRED',
            }),
          );
          return formatReconciliationJournalResult(journal);
        }

        const sentEvidence = successEvidence
          .filter((item) => item.eventType === 'SENT')
          .map((item) => ({
            item,
            timestamp: usableProviderSentTimestamp(item.eventTimestamp, now),
          }))
          .filter(({ timestamp }) => timestamp !== null)
          .sort((left, right) =>
            right.timestamp.getTime() - left.timestamp.getTime(),
          )[0];

        const sentData = {
          status: 'SENT',
          processedAt: now,
        };

        // DELIVERED and READ prove the message was sent but are later
        // milestones, not trustworthy send timestamps.
        if (sentEvidence && !event.sentAt) {
          sentData.sentAt = sentEvidence.timestamp;
        }

        if (
          event.eventType === CHECKOUT_HELP_REMINDER &&
          !event.sentAt &&
          !sentData.sentAt
        ) {
          const firstReliableEvidenceTimestamp = successEvidence
            .map((item) =>
              usableProviderSentTimestamp(item.eventTimestamp, now),
            )
            .filter((timestamp) => timestamp !== null)
            .sort((left, right) => left.getTime() - right.getTime())[0];

          if (firstReliableEvidenceTimestamp) {
            sentData.sentAt = firstReliableEvidenceTimestamp;
          }
        }

        const updated = await tx.automationEvent.updateMany({
          where: {
            id: event.id,
            eventType: event.eventType,
            status: 'SENDING',
            providerMessageId: event.providerMessageId,
          },
          data: sentData,
        });

        if (updated.count !== 1) {
          throw new Error('Reconciliation state changed during MARK_SENT.');
        }

        const authoritativeSentAt = event.sentAt || sentData.sentAt || null;
        if (
          event.eventType === CHECKOUT_HELP_REMINDER &&
          authoritativeSentAt
        ) {
          await scheduleAnyQuestionsAfterCheckoutHelpSent({
            transaction: tx,
            checkoutHelpEvent: {
              ...event,
              status: 'SENT',
              sentAt: authoritativeSentAt,
            },
            sentAt: authoritativeSentAt,
            anchorSource: sentEvidence
              ? 'provider-sent-evidence'
              : 'provider-success-evidence',
          });
        }

        const journal = await createReconciliationJournalEntry(
          tx,
          journalData({
            event,
            idempotencyKey,
            requestHash,
            action,
            decision: 'APPLIED',
            resultingStatus: 'SENT',
            reasonCode: 'MATCHING_SUCCESS_EVIDENCE',
            evidence: successEvidence[0],
          }),
        );
        return formatReconciliationJournalResult(journal);
      }

      if (successEvidence.length > 0) {
        const journal = await createReconciliationJournalEntry(
          tx,
          journalData({
            event,
            idempotencyKey,
            requestHash,
            action,
            decision: 'REJECTED',
            resultingStatus: event.status,
            reasonCode: 'SUCCESS_EVIDENCE_PRESENT',
            evidence: successEvidence[0],
          }),
        );
        return formatReconciliationJournalResult(journal);
      }

      if (
        (reasonCode === 'FAILED_EVIDENCE' && failedEvidence.length === 0) ||
        (reasonCode === 'OUTCOME_UNKNOWN' && failedEvidence.length > 0)
      ) {
        const journal = await createReconciliationJournalEntry(
          tx,
          journalData({
            event,
            idempotencyKey,
            requestHash,
            action,
            decision: 'REJECTED',
            resultingStatus: event.status,
            reasonCode:
              reasonCode === 'FAILED_EVIDENCE'
                ? 'FAILED_EVIDENCE_REQUIRED'
                : 'FAILED_EVIDENCE_AVAILABLE',
            evidence: failedEvidence[0] ?? null,
          }),
        );
        return formatReconciliationJournalResult(journal);
      }

      const updated = await tx.automationEvent.updateMany({
        where: {
          id: event.id,
          eventType: event.eventType,
          status: 'SENDING',
          providerMessageId: event.providerMessageId,
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          processedAt: now,
        },
      });

      if (updated.count !== 1) {
        throw new Error('Reconciliation state changed during QUARANTINE.');
      }

      const journal = await createReconciliationJournalEntry(
        tx,
        journalData({
          event,
          idempotencyKey,
          requestHash,
          action,
          decision: 'APPLIED',
          resultingStatus: 'CANCELLED',
          reasonCode,
          evidence: failedEvidence[0] ?? null,
        }),
      );
      return formatReconciliationJournalResult(journal);
    }, DESTINATION_LOCK_TRANSACTION_OPTIONS);

    return res.status(result.status).json(result.body);
  } catch {
    console.error('[AUTOMATION-RECONCILIATION] Database operation failed.');
    return res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/automation/process-due-reminders   (Phase 2 – single reminder)
// ---------------------------------------------------------------------------
router.post('/process-due-reminders', async (req, res) => {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  if (!checkAuth(req, res, 'AUTOMATION')) return;

  // ── 2. dryRun flag ────────────────────────────────────────────────────────
  if (req.body?.dryRun !== true) {
    return res.status(400).json({
      ok:      false,
      error:   'DRY_RUN_FLAG_REQUIRED',
      message: 'dryRun must be boolean true.',
    });
  }

  // ── 3. Exactly one identifier ─────────────────────────────────────────────
  const { email, userId, automationEventId } = req.body || {};
  const identifiers = [email, userId, automationEventId].filter(
    (v) => v !== undefined && v !== null && v !== '',
  );

  if (identifiers.length === 0) {
    return res.status(400).json({
      ok:      false,
      error:   'MISSING_IDENTIFIER',
      message: 'Provide exactly one of: email, userId, automationEventId.',
    });
  }
  if (identifiers.length > 1) {
    return res.status(400).json({
      ok:      false,
      error:   'AMBIGUOUS_IDENTIFIER',
      message: 'Provide exactly one of: email, userId, automationEventId — not multiple.',
    });
  }

  // ── 4. Main handler ───────────────────────────────────────────────────────
  try {
    let ae;

    // ── PATH A: automationEventId — direct UUID primary-key lookup ────────
    if (automationEventId !== undefined && automationEventId !== null && automationEventId !== '') {
      ae = await prisma.automationEvent.findUnique({
        where: { id: String(automationEventId) },
      });

      if (!ae) {
        return res.status(404).json({
          ok:      false,
          error:   'NOT_FOUND',
          message: `No AutomationEvent found with id=${automationEventId}.`,
        });
      }

      if (ae.eventType !== 'LESSON1_SIGNUP_REMINDER') {
        return res.status(400).json({
          ok:      false,
          error:   'WRONG_EVENT_TYPE',
          message: `AutomationEvent ${automationEventId} is type ${ae.eventType}, not LESSON1_SIGNUP_REMINDER.`,
        });
      }

      if (ae.status !== 'PENDING') {
        return res.json({
          ok:             true,
          result:         'ALREADY_PROCESSED',
          aeId:           ae.id,
          existingStatus: ae.status,
          processedAt:    ae.processedAt ?? null,
          cancelledAt:    ae.cancelledAt ?? null,
          whatsappSent:   false,
        });
      }
    }

    // ── PATH B: email or userId — two-step PENDING-first lookup ──────────
    else {
      let resolvedUserId;

      if (email !== undefined && email !== null && email !== '') {
        const user = await prisma.user.findUnique({
          where:  { email: String(email).trim().toLowerCase() },
          select: { id: true },
        });
        if (!user) {
          return res.status(404).json({
            ok:      false,
            error:   'USER_NOT_FOUND',
            message: `No user found with email=${email}.`,
          });
        }
        resolvedUserId = user.id;
      } else {
        const parsed = parseInt(userId, 10);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          return res.status(400).json({
            ok:      false,
            error:   'INVALID_USER_ID',
            message: 'userId must be a positive integer.',
          });
        }
        const user = await prisma.user.findUnique({
          where:  { id: parsed },
          select: { id: true },
        });
        if (!user) {
          return res.status(404).json({
            ok:      false,
            error:   'USER_NOT_FOUND',
            message: `No user found with userId=${userId}.`,
          });
        }
        resolvedUserId = parsed;
      }

      // Step B2: find the unique PENDING row (partial unique index guarantees ≤ 1)
      ae = await prisma.automationEvent.findFirst({
        where: {
          userId:    resolvedUserId,
          eventType: 'LESSON1_SIGNUP_REMINDER',
          status:    'PENDING',
        },
      });

      if (!ae) {
        // Step B3: fallback — fetch the most recent historical row for reporting
        const historical = await prisma.automationEvent.findFirst({
          where:   { userId: resolvedUserId, eventType: 'LESSON1_SIGNUP_REMINDER' },
          orderBy: { createdAt: 'desc' },
        });

        if (!historical) {
          return res.json({
            ok:           true,
            result:       'NOT_FOUND',
            message:      'No LESSON1_SIGNUP_REMINDER has ever been created for this user.',
            whatsappSent: false,
          });
        }

        return res.json({
          ok:             true,
          result:         'ALREADY_PROCESSED',
          aeId:           historical.id,
          existingStatus: historical.status,
          processedAt:    historical.processedAt ?? null,
          cancelledAt:    historical.cancelledAt ?? null,
          whatsappSent:   false,
        });
      }
    }

    // ── 5. Due-time check (no DB write on failure) ─────────────────────────
    if (!ae.scheduledAt || ae.scheduledAt > new Date()) {
      const scheduledAt = ae.scheduledAt ? ae.scheduledAt.toISOString() : null;
      const now = new Date().toISOString();
      console.log(`[AUTOMATION] NOT_DUE aeId=${ae.id} scheduledAt=${scheduledAt} now=${now}`);
      return res.json({
        ok:           true,
        result:       'NOT_DUE',
        aeId:         ae.id,
        scheduledAt,
        now,
        whatsappSent: false,
      });
    }

    // ── 6. Eligibility + transition via shared function ────────────────────
    const rowResult = await processOneReminder(ae);
    return res.json({ ok: true, ...rowResult });

  } catch (err) {
    console.error('[AUTOMATION] Unexpected error in process-due-reminders:', err.message);
    return res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/automation/process-due-reminders-batch   (Phase 3 – batch)
// ---------------------------------------------------------------------------
router.post('/process-due-reminders-batch', async (req, res) => {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  if (!checkAuth(req, res, 'AUTOMATION-BATCH')) return;

  // ── 2. dryRun flag ────────────────────────────────────────────────────────
  if (req.body?.dryRun !== true) {
    return res.status(400).json({
      ok:      false,
      error:   'DRY_RUN_FLAG_REQUIRED',
      message: 'dryRun must be boolean true.',
    });
  }

  // ── 3. mode — required, no inference, no default ─────────────────────────
  const { mode } = req.body;
  if (mode === undefined || mode === null) {
    return res.status(400).json({
      ok:      false,
      error:   'INVALID_MODE',
      message: 'mode is required: "explicit" or "discovery".',
    });
  }
  if (mode !== 'explicit' && mode !== 'discovery') {
    return res.status(400).json({
      ok:      false,
      error:   'INVALID_MODE',
      message: 'mode must be "explicit" or "discovery".',
    });
  }

  // ── 4. Mode-specific validation ───────────────────────────────────────────
  let deduplicatedIds = null;
  let limit           = null;

  if (mode === 'explicit') {
    // 4a. Conflicting field (limit forbidden in explicit mode)
    if (req.body.limit !== undefined) {
      return res.status(400).json({
        ok:      false,
        error:   'CONFLICTING_PARAMS',
        message: 'limit is not allowed in explicit mode.',
      });
    }

    // 4b. Required field
    if (req.body.automationEventIds === undefined) {
      return res.status(400).json({
        ok:      false,
        error:   'MISSING_AUTOMATION_EVENT_IDS',
        message: 'automationEventIds is required in explicit mode.',
      });
    }

    // 4c. Array shape
    if (!Array.isArray(req.body.automationEventIds)) {
      return res.status(400).json({
        ok:      false,
        error:   'INVALID_AUTOMATION_EVENT_IDS',
        message: 'automationEventIds must be an array.',
      });
    }
    if (req.body.automationEventIds.length === 0) {
      return res.status(400).json({
        ok:      false,
        error:   'INVALID_AUTOMATION_EVENT_IDS',
        message: 'automationEventIds must contain at least 1 ID.',
      });
    }

    // 4d. UUID v4 validation
    for (let i = 0; i < req.body.automationEventIds.length; i++) {
      const v = req.body.automationEventIds[i];
      if (typeof v !== 'string' || !UUID_V4_RE.test(v)) {
        return res.status(400).json({
          ok:      false,
          error:   'INVALID_AUTOMATION_EVENT_IDS',
          message: `element ${i} is not a valid UUID: ${v}`,
        });
      }
    }

    // 4e. Silent deduplication
    const raw = req.body.automationEventIds;
    deduplicatedIds = [...new Set(raw)];
    if (deduplicatedIds.length < raw.length) {
      console.warn(
        `[AUTOMATION-BATCH] Deduplicated ${raw.length - deduplicatedIds.length} duplicate ID(s).`,
      );
    }

    // 4f. Hard cap after dedup
    if (deduplicatedIds.length > MAX_BATCH) {
      return res.status(400).json({
        ok:      false,
        error:   'LIMIT_EXCEEDS_MAX',
        message: `automationEventIds may not contain more than ${MAX_BATCH} distinct IDs.`,
      });
    }

    // 4g. Unknown fields — checked last so field-specific errors fire first
    const ALLOWED_EXPLICIT = new Set(['dryRun', 'mode', 'automationEventIds']);
    const unknownKeys = Object.keys(req.body).filter((k) => !ALLOWED_EXPLICIT.has(k));
    if (unknownKeys.length > 0) {
      return res.status(400).json({
        ok:      false,
        error:   'UNKNOWN_FIELDS',
        message: `Unexpected body field(s): ${unknownKeys.join(', ')}.`,
      });
    }

  } else {
    // discovery mode

    // 4a. Conflicting field (automationEventIds forbidden in discovery mode)
    if (req.body.automationEventIds !== undefined) {
      return res.status(400).json({
        ok:      false,
        error:   'CONFLICTING_PARAMS',
        message: 'automationEventIds is not allowed in discovery mode.',
      });
    }

    // 4b. limit required — no default
    if (req.body.limit === undefined) {
      return res.status(400).json({
        ok:      false,
        error:   'MISSING_LIMIT',
        message: 'limit is required in discovery mode.',
      });
    }

    // 4c. Strict number type, positive integer, 1–10
    if (
      typeof req.body.limit !== 'number' ||
      !Number.isInteger(req.body.limit) ||
      req.body.limit < 1
    ) {
      return res.status(400).json({
        ok:      false,
        error:   'INVALID_LIMIT',
        message: 'limit must be a positive integer.',
      });
    }
    if (req.body.limit > MAX_BATCH) {
      return res.status(400).json({
        ok:      false,
        error:   'LIMIT_EXCEEDS_MAX',
        message: `limit cannot exceed ${MAX_BATCH}.`,
      });
    }

    // 4d. Unknown fields
    const ALLOWED_DISCOVERY = new Set(['dryRun', 'mode', 'limit']);
    const unknownKeys = Object.keys(req.body).filter((k) => !ALLOWED_DISCOVERY.has(k));
    if (unknownKeys.length > 0) {
      return res.status(400).json({
        ok:      false,
        error:   'UNKNOWN_FIELDS',
        message: `Unexpected body field(s): ${unknownKeys.join(', ')}.`,
      });
    }

    limit = req.body.limit;
  }

  // ── 5. DB query ───────────────────────────────────────────────────────────
  try {
    const now = new Date();
    let due;

    if (mode === 'explicit') {
      due = await prisma.automationEvent.findMany({
        where: {
          id:          { in: deduplicatedIds },
          eventType:   'LESSON1_SIGNUP_REMINDER',
          status:      'PENDING',
          scheduledAt: { lte: now },
        },
        orderBy: { scheduledAt: 'asc' },
      });
    } else {
      due = await prisma.automationEvent.findMany({
        where: {
          eventType:   'LESSON1_SIGNUP_REMINDER',
          status:      'PENDING',
          scheduledAt: { lte: now },
        },
        orderBy: { scheduledAt: 'asc' },
        take:    limit,
      });
    }

    // ── 6. Serial per-row processing with per-row error isolation ─────────
    const results = [];
    for (const ae of due) {
      try {
        const rowResult = await processOneReminder(ae);
        results.push(rowResult);
      } catch (err) {
        console.error(`[AUTOMATION-BATCH] Row failed aeId=${ae.id}:`, err.message);
        results.push({ aeId: ae.id, result: 'FAILED', error: err.message });
      }
    }

    // ── 7. Aggregate counts ───────────────────────────────────────────────
    let processed        = 0;
    let cancelled        = 0;
    let alreadyProcessed = 0;
    let failed           = 0;
    for (const r of results) {
      if      (r.result === 'DRY_RUN')          processed++;
      else if (r.result === 'CANCELLED')         cancelled++;
      else if (r.result === 'ALREADY_PROCESSED') alreadyProcessed++;
      else if (r.result === 'FAILED')            failed++;
    }

    // ── 8. Response ───────────────────────────────────────────────────────
    if (mode === 'explicit') {
      const foundIds         = new Set(due.map((ae) => ae.id));
      const notFoundOrNotDue = deduplicatedIds.filter((id) => !foundIds.has(id));
      return res.json({
        ok:               true,
        dryRun:           true,
        mode:             'explicit',
        requestedIds:     deduplicatedIds.length,
        foundAndDue:      due.length,
        notFoundOrNotDue,
        processed,
        cancelled,
        alreadyProcessed,
        failed,
        whatsappSent:     false,
        results,
      });
    } else {
      return res.json({
        ok:               true,
        dryRun:           true,
        mode:             'discovery',
        selected:         due.length,
        processed,
        cancelled,
        alreadyProcessed,
        failed,
        whatsappSent:     false,
        results,
      });
    }

  } catch (err) {
    console.error('[AUTOMATION-BATCH] Unexpected error:', err.message);
    return res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/automation/process-due-reminder-live
//
// Phase 4 controlled live-send endpoint.
//
// Safety constraints:
//   - explicit automationEventId only
//   - exactly one reminder
//   - dedicated live-send kill switch
//   - request must explicitly confirm liveSend:true
//   - recipient restricted to WHATSAPP_LIVE_TEST_NUMBER
//   - eligibility re-checked immediately before claim
//   - atomic PENDING -> SENDING claim before provider invocation
//   - provider success required before SENT/sentAt
//   - provider uncertainty leaves row in SENDING for manual investigation
//
// NOTE: the current provider implementation is intentionally disabled and
// cannot contact Meta. Jest tests will mock the provider in a later step.
// ---------------------------------------------------------------------------
export function createLiveReminderHandler({
  database = prisma,
  sendTemplate = sendWhatsAppTemplate,
  providerDispatchTimeoutMs = PROVIDER_DISPATCH_TIMEOUT_MS,
  cancelInitialIneligible = true,
  enforceTestRecipient = true,
  isLiveSendEnabled = isWhatsAppLiveSendEnabled,
} = {}) {
  return async (req, res) => {
  // ── 1. Existing automation auth ──────────────────────────────────────────
  if (!checkAuth(req, res, 'AUTOMATION-LIVE')) return;

  // ── 2. Global live-send kill switch ──────────────────────────────────────
  if (!isLiveSendEnabled()) {
    return res.status(503).json({
      ok: false,
      error: 'WHATSAPP_LIVE_SEND_DISABLED',
    });
  }

  // ── 3. Explicit request confirmation ─────────────────────────────────────
  if (req.body?.liveSend !== true) {
    return res.status(400).json({
      ok: false,
      error: 'LIVE_SEND_CONFIRMATION_REQUIRED',
      message: 'liveSend must be boolean true.',
    });
  }

  // ── 4. Reject unknown fields ──────────────────────────────────────────────
  const allowedFields = new Set(['liveSend', 'automationEventId']);
  const unknownFields = Object.keys(req.body || {}).filter(
    (key) => !allowedFields.has(key),
  );

  if (unknownFields.length > 0) {
    return res.status(400).json({
      ok: false,
      error: 'UNKNOWN_FIELDS',
      message: `Unknown field(s): ${unknownFields.join(', ')}`,
    });
  }

  // ── 5. Exactly one explicit AutomationEvent UUID ─────────────────────────
  const automationEventId = req.body?.automationEventId;

  if (
    typeof automationEventId !== 'string' ||
    !UUID_V4_RE.test(automationEventId)
  ) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_AUTOMATION_EVENT_ID',
    });
  }

  // ── 6. Test-recipient restriction ────────────────────────────────────────
  let allowedTestNumberNormalized = null;
  if (enforceTestRecipient) {
    const allowedTestNumber =
      (process.env.WHATSAPP_LIVE_TEST_NUMBER || '').trim();

    if (
      !allowedTestNumber ||
      POISON.has(allowedTestNumber.toLowerCase())
    ) {
      return res.status(503).json({
        ok: false,
        error: 'WHATSAPP_TEST_NUMBER_NOT_CONFIGURED',
      });
    }

    allowedTestNumberNormalized =
      normalizeWhatsAppNumber(allowedTestNumber);

    if (!allowedTestNumberNormalized) {
      return res.status(503).json({
        ok: false,
        error: 'WHATSAPP_TEST_NUMBER_INVALID',
      });
    }
  }

  // Template configuration is also fail-closed.
  const { languageCode } = getLesson1TemplateConfiguration();

  if (!languageCode) {
    return res.status(503).json({
      ok: false,
      error: 'WHATSAPP_TEMPLATE_NOT_CONFIGURED',
    });
  }

  try {
    // ── 7. Fetch exact reminder ─────────────────────────────────────────────
    const ae = await database.automationEvent.findUnique({
      where: { id: automationEventId },
    });

    if (!ae) {
      return res.status(404).json({
        ok: false,
        error: 'NOT_FOUND',
      });
    }

    if (!WHATSAPP_REMINDER_EVENT_TYPE_SET.has(ae.eventType)) {
      return res.status(400).json({
        ok: false,
        error: 'WRONG_EVENT_TYPE',
      });
    }

    const eventTemplateConfiguration =
      getReminderTemplateConfiguration(ae.eventType);

    if (
      !eventTemplateConfiguration?.templateName ||
      !eventTemplateConfiguration.languageCode
    ) {
      return res.status(503).json({
        ok: false,
        error: 'WHATSAPP_TEMPLATE_NOT_CONFIGURED',
      });
    }

    if (ae.status !== 'PENDING') {
      return res.json({
        ok: true,
        result: 'ALREADY_PROCESSED',
        aeId: ae.id,
        existingStatus: ae.status,
        whatsappSent: false,
      });
    }

    const now = new Date();

    if (!ae.scheduledAt || ae.scheduledAt > now) {
      return res.json({
        ok: true,
        result: 'NOT_DUE',
        aeId: ae.id,
        scheduledAt: ae.scheduledAt?.toISOString() ?? null,
        now: now.toISOString(),
        whatsappSent: false,
      });
    }

    // ── 8. Re-check eligibility immediately before claim ────────────────────
    const eligibility = await getLiveReminderEligibility(ae, database);

    if (eligibility.skipReason) {
      if (!cancelInitialIneligible) {
        return res.json({
          ok: true,
          result: 'SKIPPED',
          aeId: ae.id,
          skipReason: eligibility.skipReason,
          whatsappSent: false,
        });
      }

      const result = await cancelRow(
        ae.id,
        eligibility.skipReason,
        database,
      );
      if (result.count === 0) {
        return res.json({
          ok: true,
          result: 'ALREADY_PROCESSED',
          aeId: ae.id,
          whatsappSent: false,
        });
      }
      return res.json({
        ok: true,
        ...ineligibleResult(
          ae,
          eligibility.skipReason,
          result.processedAt,
          result.cancelledAt,
        ),
      });
    }

    const { destination, user } = eligibility;
    const learnerName = String(user.name || '').trim();

    if (!learnerName) {
      return res.status(422).json({
        ok: false,
        error: 'WHATSAPP_TEMPLATE_PARAMETER_MISSING',
        parameter: 'body.{{1}}',
        aeId: ae.id,
        whatsappSent: false,
      });
    }

    // ── 9. Hard test-number allowlist ───────────────────────────────────────
    if (
      enforceTestRecipient &&
      destination !== allowedTestNumberNormalized
    ) {
      return res.status(403).json({
        ok: false,
        error: 'TEST_RECIPIENT_ONLY',
        aeId: ae.id,
        whatsappSent: false,
      });
    }

    // ── 10. Commit claim, then lock and perform the final send stage ─────────
    // The claim is intentionally committed before the lock-owning transaction.
    // If the provider outcome is uncertain, this preserves SENDING even though
    // the final transaction commits or rolls back. A STOP that wins the lock
    // before this final stage commits durable suppression first; a send that
    // wins holds the same lock until its provider outcome is known.
    const claimedAt = new Date();
    const claimed = await database.automationEvent.updateMany({
      where: {
        id: ae.id,
        status: 'PENDING',
      },
      data: {
        status: 'SENDING',
        processedAt: claimedAt,
      },
    });

    if (claimed.count === 0) {
      return res.json({
        ok: true,
        result: 'ALREADY_PROCESSED',
        aeId: ae.id,
        whatsappSent: false,
      });
    }

    console.log(
      `[AUTOMATION-LIVE] CLAIMED aeId=${ae.id} userId=${ae.userId}`,
    );

    const response = await database.$transaction(async (tx) => {
      await acquireWhatsAppDestinationLock(tx, destination);

      // A STOP, ownership change, or account-access change may occur between
      // the first eligibility query and the committed claim above. Every final
      // read and write below uses the transaction that owns the destination
      // lock so no unlocked pool connection can observe a competing state.
      const lockedEvent = await tx.automationEvent.findUnique({
        where: { id: ae.id },
      });

      // A reconciliation can quarantine the committed claim while this request
      // waits for the same destination lock. Never dispatch after that terminal
      // transition; the provider call must be downstream of this final state
      // check, not merely the earlier PENDING -> SENDING claim.
      if (
        !lockedEvent ||
        lockedEvent.eventType !== ae.eventType ||
        (lockedEvent.productKey || SENTENCE_MASTER_PRODUCT_KEY) !==
          (ae.productKey || SENTENCE_MASTER_PRODUCT_KEY) ||
        lockedEvent.status !== 'SENDING' ||
        lockedEvent.destinationNumberNormalized !== destination
      ) {
        return {
          status: 200,
          body: {
            ok: true,
            result: 'ALREADY_PROCESSED',
            aeId: ae.id,
            existingStatus: lockedEvent?.status ?? null,
            whatsappSent: false,
          },
        };
      }

      const finalEligibility = await getLiveReminderEligibility(lockedEvent, tx);

      if (finalEligibility.skipReason) {
        const result = await cancelClaimedRow(
          lockedEvent.id,
          finalEligibility.skipReason,
          tx,
        );

        if (result.count === 0) {
          return {
            status: 200,
            body: {
              ok: true,
              result: 'ALREADY_PROCESSED',
              aeId: lockedEvent.id,
              whatsappSent: false,
            },
          };
        }

        return {
          status: 200,
          body: {
            ok: true,
            ...ineligibleResult(
            lockedEvent,
              finalEligibility.skipReason,
              result.processedAt,
              result.cancelledAt,
            ),
          },
        };
      }

      let delivery;

      try {
        delivery = await sendTemplateWithinDestinationLock(
          sendTemplate,
          {
            to: destination,
            templateName: eventTemplateConfiguration.templateName,
            languageCode: eventTemplateConfiguration.languageCode,
            bodyParameters: [learnerName],
            automationEventId: lockedEvent.id,
          },
          providerDispatchTimeoutMs,
        );
      } catch (providerErr) {
        console.error(
          `[AUTOMATION-LIVE] PROVIDER_UNCONFIRMED aeId=${ae.id} ` +
          `code=${providerErr?.code || 'UNKNOWN'}`,
        );

        // Deliberately leave status=SENDING.
        // A timeout/error can be ambiguous; automatically retrying could
        // create a duplicate WhatsApp message.
        return {
          status: 502,
          body: {
            ok: false,
            error: 'WHATSAPP_SEND_UNCONFIRMED',
            providerError: providerErr?.code || 'UNKNOWN',
            aeId: ae.id,
            existingStatus: 'SENDING',
            whatsappSent: null,
          },
        };
      }

      if (
        !delivery ||
        typeof delivery.messageId !== 'string' ||
        delivery.messageId.trim() === ''
      ) {
        console.error(
          `[AUTOMATION-LIVE] INVALID_PROVIDER_RESPONSE aeId=${ae.id}`,
        );

        // Same conservative treatment: remain SENDING.
        return {
          status: 502,
          body: {
            ok: false,
            error: 'WHATSAPP_SEND_UNCONFIRMED',
            providerError: 'INVALID_PROVIDER_RESPONSE',
            aeId: ae.id,
            existingStatus: 'SENDING',
            whatsappSent: null,
          },
        };
      }

      const sentAt = new Date();
      const existingPayload =
        lockedEvent.payload &&
        typeof lockedEvent.payload === 'object' &&
        !Array.isArray(lockedEvent.payload)
          ? lockedEvent.payload
          : {};

      const nextPayload = {
        ...existingPayload,
        whatsappDelivery: {
          provider: delivery.provider || 'meta',
          messageId: delivery.messageId,
          sentAt: sentAt.toISOString(),
        },
      };

      try {
        const finalized = await tx.automationEvent.updateMany({
          where: {
            id: ae.id,
            status: 'SENDING',
          },
          data: {
            status: 'SENT',
            sentAt,
            processedAt: sentAt,
            payload: nextPayload,
            providerMessageId: delivery.messageId,
          },
        });

        if (finalized.count === 0) {
          throw new Error('SENDING_TO_SENT_CONFLICT');
        }

        if (lockedEvent.eventType === CHECKOUT_HELP_REMINDER) {
          await scheduleAnyQuestionsAfterCheckoutHelpSent({
            transaction: tx,
            checkoutHelpEvent: {
              ...lockedEvent,
              status: 'SENT',
              sentAt,
            },
            sentAt,
            anchorSource: 'provider-confirmation',
          });
        }
      } catch (finalizeErr) {
        console.error(
          `[AUTOMATION-LIVE] FINALIZE_FAILED aeId=${ae.id} ` +
          `messageId=${delivery.messageId} error=${finalizeErr.message}`,
        );

        // Every failure after provider confirmation is uncertain delivery, even
        // when the primary lifecycle write itself failed. Roll back this
        // transaction and persist only provider correlation outside it so
        // linked webhook evidence can reconcile the still-SENDING event.
        finalizeErr.providerConfirmed = true;
        finalizeErr.providerMessageId = delivery.messageId;
        finalizeErr.provider = delivery.provider || 'meta';
        finalizeErr.providerSentAt = sentAt;
        finalizeErr.providerPayload = nextPayload;
        throw finalizeErr;
      }

      console.log(
        `[AUTOMATION-LIVE] SENT aeId=${ae.id} userId=${ae.userId} ` +
        `messageId=${delivery.messageId}`,
      );

      return {
        status: 200,
        body: {
          ok: true,
          result: 'SENT',
          aeId: ae.id,
          userId: ae.userId,
          email: user.email,
          sentAt: sentAt.toISOString(),
          providerMessageId: delivery.messageId,
          whatsappSent: true,
        },
      };
    }, DESTINATION_LOCK_TRANSACTION_OPTIONS);

    return res.status(response.status).json(response.body);
  } catch (err) {
    console.error('[AUTOMATION-LIVE] Unexpected error:', err.message);

    if (err?.providerConfirmed) {
      try {
        const correlated = await database.automationEvent.updateMany({
          where: {
            id: automationEventId,
            status: 'SENDING',
            providerMessageId: null,
          },
          data: {
            providerMessageId: err.providerMessageId,
            payload: err.providerPayload,
          },
        });

        if (correlated.count !== 1) {
          console.error(
            `[AUTOMATION-LIVE] PROVIDER_CORRELATION_CONFLICT ` +
            `aeId=${automationEventId}`,
          );
        }
      } catch (correlationErr) {
        console.error(
          `[AUTOMATION-LIVE] PROVIDER_CORRELATION_FAILED ` +
          `aeId=${automationEventId} error=${correlationErr.message}`,
        );
      }

      return res.status(500).json({
        ok: false,
        error: 'SEND_FINALIZE_FAILED',
        aeId: automationEventId,
        providerMessageId: err.providerMessageId,
        whatsappSent: true,
      });
    }

    return res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
    });
  }
  };
}

router.post('/process-due-reminder-live', createLiveReminderHandler());

function canaryReasonCode(value, fallback = 'CANARY_PROCESSING_FAILED') {
  return typeof value === 'string' && /^[A-Z0-9_]{1,64}$/.test(value)
    ? value
    : fallback;
}

function formatCanaryRow(ae, {
  status = ae.status,
  result,
  reasonCode = null,
  whatsappSent = false,
}) {
  return {
    automationEventId: ae.id,
    eventType: ae.eventType,
    status,
    scheduledAt: formatSendingAuditDate(ae.scheduledAt),
    destination: ae.destinationNumberNormalized ? '[masked]' : null,
    result,
    reasonCode,
    whatsappSent,
  };
}

async function getCanaryEventStatus(database, ae) {
  const currentEvent = await database.automationEvent.findUnique({
    where: { id: ae.id },
    select: { status: true },
  });

  return currentEvent?.status ?? ae.status;
}

function sanitizeCanaryLiveResult(ae, response, status = ae.status) {
  const body = response.body || {};

  if (body.result === 'SENT' || body.whatsappSent === true) {
    return {
      row: formatCanaryRow(ae, {
        status,
        result: 'SENT',
        reasonCode: body.result === 'SENT'
          ? null
          : canaryReasonCode(body.error),
        whatsappSent: true,
      }),
      stopAfterAttempt: true,
    };
  }

  if (body.error === 'WHATSAPP_SEND_UNCONFIRMED') {
    return {
      row: formatCanaryRow(ae, {
        status,
        result: 'UNCONFIRMED',
        reasonCode: 'WHATSAPP_SEND_UNCONFIRMED',
        whatsappSent: null,
      }),
      stopAfterAttempt: true,
    };
  }

  if (body.result === 'NOT_DUE') {
    return {
      row: formatCanaryRow(ae, {
        status,
        result: 'NOT_DUE',
        reasonCode: 'NOT_DUE',
        whatsappSent: false,
      }),
      stopAfterAttempt: false,
    };
  }

  if (body.result === 'CANCELLED' || body.result === 'SKIPPED') {
    return {
      row: formatCanaryRow(ae, {
        status,
        result: 'SKIPPED',
        reasonCode: canaryReasonCode(body.skipReason),
        whatsappSent: false,
      }),
      stopAfterAttempt: false,
    };
  }

  if (body.result === 'ALREADY_PROCESSED') {
    return {
      row: formatCanaryRow(ae, {
        status,
        result: 'ALREADY_PROCESSED',
        reasonCode: 'ALREADY_PROCESSED',
        whatsappSent: false,
      }),
      stopAfterAttempt: false,
    };
  }

  if (body.error === 'TEST_RECIPIENT_ONLY') {
    return {
      row: formatCanaryRow(ae, {
        status,
        result: 'SKIPPED',
        reasonCode: 'TEST_RECIPIENT_ONLY',
        whatsappSent: false,
      }),
      stopAfterAttempt: false,
    };
  }

  if (body.error === 'WHATSAPP_TEMPLATE_PARAMETER_MISSING') {
    return {
      row: formatCanaryRow(ae, {
        status,
        result: 'SKIPPED',
        reasonCode: 'WHATSAPP_TEMPLATE_PARAMETER_MISSING',
        whatsappSent: false,
      }),
      stopAfterAttempt: false,
    };
  }

  return {
    row: formatCanaryRow(ae, {
      status,
      result: 'NOT_SENT',
      reasonCode: 'CANARY_PROCESSING_FAILED',
      whatsappSent: false,
    }),
    stopAfterAttempt: true,
  };
}

async function invokeCanaryLiveHandler(handler, req, automationEventId) {
  const outcome = {
    status: 200,
    body: null,
  };
  const response = {
    status(statusCode) {
      outcome.status = statusCode;
      return response;
    },
    json(body) {
      outcome.body = body;
      return response;
    },
  };

  await handler(
    {
      headers: {
        authorization: req.headers.authorization,
      },
      body: {
        liveSend: true,
        automationEventId,
      },
    },
    response,
  );

  return outcome;
}

function canarySummary(row) {
  return {
    examined: 1,
    skipped: row.result === 'SKIPPED' ? 1 : 0,
    sent: row.result === 'SENT' ? 1 : 0,
    unconfirmed: row.result === 'UNCONFIRMED' ? 1 : 0,
  };
}

export function createCanaryReminderHandler({
  database = prisma,
  sendTemplate = sendWhatsAppTemplate,
  providerDispatchTimeoutMs = PROVIDER_DISPATCH_TIMEOUT_MS,
  isLiveSendEnabled = isWhatsAppLiveSendEnabled,
  isCanaryWorkerEnabled = () =>
    (process.env.WHATSAPP_CANARY_WORKER_ENABLED || '').trim().toLowerCase() ===
    'true',
} = {}) {
  return async (req, res) => {
    if (!checkAuth(req, res, 'AUTOMATION-CANARY')) return;

    if (!isLiveSendEnabled()) {
      return res.status(503).json({
        ok: false,
        error: 'WHATSAPP_LIVE_SEND_DISABLED',
      });
    }

    if (!isCanaryWorkerEnabled()) {
      return res.status(503).json({
        ok: false,
        error: 'WHATSAPP_CANARY_WORKER_DISABLED',
      });
    }

    if (req.body?.liveSend !== true) {
      return res.status(400).json({
        ok: false,
        error: 'LIVE_SEND_CONFIRMATION_REQUIRED',
        message: 'liveSend must be boolean true.',
      });
    }

    const allowedFields = new Set(['liveSend', 'automationEventId']);
    const unknownFields = Object.keys(req.body || {}).filter(
      (key) => !allowedFields.has(key),
    );

    if (unknownFields.length > 0) {
      return res.status(400).json({
        ok: false,
        error: 'UNKNOWN_FIELDS',
      });
    }

    const automationEventId = req.body?.automationEventId;

    if (
      typeof automationEventId !== 'string' ||
      !UUID_V4_RE.test(automationEventId)
    ) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_AUTOMATION_EVENT_ID',
      });
    }

    const allowedTestNumber = (process.env.WHATSAPP_LIVE_TEST_NUMBER || '').trim();

    if (
      !allowedTestNumber ||
      POISON.has(allowedTestNumber.toLowerCase())
    ) {
      return res.status(503).json({
        ok: false,
        error: 'WHATSAPP_TEST_NUMBER_NOT_CONFIGURED',
      });
    }

    const allowedTestNumberNormalized =
      normalizeWhatsAppNumber(allowedTestNumber);

    if (!allowedTestNumberNormalized) {
      return res.status(503).json({
        ok: false,
        error: 'WHATSAPP_TEST_NUMBER_INVALID',
      });
    }

    const { templateName, languageCode } = getLesson1TemplateConfiguration();

    if (!templateName || !languageCode) {
      return res.status(503).json({
        ok: false,
        error: 'WHATSAPP_TEMPLATE_NOT_CONFIGURED',
      });
    }

    const now = new Date();

    try {
      const ae = await database.automationEvent.findUnique({
        where: { id: automationEventId },
      });

      if (!ae) {
        return res.status(404).json({
          ok: false,
          error: 'NOT_FOUND',
        });
      }

      if (ae.eventType !== 'LESSON1_SIGNUP_REMINDER') {
        return res.status(400).json({
          ok: false,
          error: 'WRONG_EVENT_TYPE',
        });
      }

      if (ae.status !== 'PENDING') {
        const row = formatCanaryRow(ae, {
          result: 'ALREADY_PROCESSED',
          reasonCode: 'ALREADY_PROCESSED',
          whatsappSent: false,
        });

        return res.json({
          ok: true,
          worker: 'LESSON1_SIGNUP_REMINDER_CANARY',
          targeted: true,
          generatedAt: now.toISOString(),
          automationEventId: ae.id,
          counts: canarySummary(row),
          rows: [row],
        });
      }

      if (!ae.scheduledAt || ae.scheduledAt > now) {
        const row = formatCanaryRow(ae, {
          result: 'NOT_DUE',
          reasonCode: 'NOT_DUE',
          whatsappSent: false,
        });

        return res.json({
          ok: true,
          worker: 'LESSON1_SIGNUP_REMINDER_CANARY',
          targeted: true,
          generatedAt: now.toISOString(),
          automationEventId: ae.id,
          counts: canarySummary(row),
          rows: [row],
        });
      }

      const liveHandler = createLiveReminderHandler({
        database,
        sendTemplate,
        providerDispatchTimeoutMs,
        cancelInitialIneligible: false,
        isLiveSendEnabled,
      });
      const liveOutcome = await invokeCanaryLiveHandler(
        liveHandler,
        req,
        ae.id,
      );
      const canaryOutcome = sanitizeCanaryLiveResult(
        ae,
        liveOutcome,
        await getCanaryEventStatus(database, ae),
      );
      const row = canaryOutcome.row;

      return res.status(200).json({
        ok: true,
        worker: 'LESSON1_SIGNUP_REMINDER_CANARY',
        targeted: true,
        generatedAt: now.toISOString(),
        automationEventId: ae.id,
        counts: canarySummary(row),
        rows: [row],
      });
    } catch {
      console.error('[AUTOMATION-CANARY] Database read or processing failed.');
      return res.status(500).json({
        ok: false,
        error: 'INTERNAL_ERROR',
      });
    }
  };
}

router.post('/process-due-reminder-canary', createCanaryReminderHandler());

function formatRolloutRow(ae, {
  status = ae.status,
  result,
  reasonCode = null,
  whatsappSent = false,
}) {
  return {
    automationEventId: ae.id,
    eventType: ae.eventType,
    status,
    createdAt: formatSendingAuditDate(ae.createdAt),
    scheduledAt: formatSendingAuditDate(ae.scheduledAt),
    destination: ae.destinationNumberNormalized ? '[masked]' : null,
    result,
    reasonCode,
    whatsappSent,
  };
}

function sanitizeRolloutLiveResult(ae, response, status = ae.status) {
  const body = response.body || {};

  if (body.result === 'SENT' || body.whatsappSent === true) {
    return {
      row: formatRolloutRow(ae, {
        status,
        result: 'SENT',
        reasonCode: body.result === 'SENT'
          ? null
          : canaryReasonCode(body.error, 'ROLLOUT_SEND_FINALIZATION_FAILED'),
        whatsappSent: true,
      }),
      stopAfterAttempt: true,
    };
  }

  if (body.error === 'WHATSAPP_SEND_UNCONFIRMED') {
    return {
      row: formatRolloutRow(ae, {
        status,
        result: 'UNCONFIRMED',
        reasonCode: 'WHATSAPP_SEND_UNCONFIRMED',
        whatsappSent: null,
      }),
      stopAfterAttempt: true,
    };
  }

  if (body.result === 'CANCELLED' || body.result === 'SKIPPED') {
    return {
      row: formatRolloutRow(ae, {
        status,
        result: 'SKIPPED',
        reasonCode: canaryReasonCode(body.skipReason),
        whatsappSent: false,
      }),
      stopAfterAttempt: false,
    };
  }

  if (body.result === 'ALREADY_PROCESSED') {
    return {
      row: formatRolloutRow(ae, {
        status,
        result: 'ALREADY_PROCESSED',
        reasonCode: 'ALREADY_PROCESSED',
        whatsappSent: false,
      }),
      stopAfterAttempt: false,
    };
  }

  if (body.error === 'WHATSAPP_TEMPLATE_PARAMETER_MISSING') {
    return {
      row: formatRolloutRow(ae, {
        status,
        result: 'SKIPPED',
        reasonCode: 'WHATSAPP_TEMPLATE_PARAMETER_MISSING',
        whatsappSent: false,
      }),
      stopAfterAttempt: false,
    };
  }

  return {
    row: formatRolloutRow(ae, {
      status,
      result: 'UNCONFIRMED',
      reasonCode: 'ROLLOUT_PROCESSING_UNKNOWN',
      whatsappSent: null,
    }),
    // A generic live-handler failure can occur after provider dispatch but
    // before the lock-owning transaction reports success. Treat it as
    // indeterminate and stop this invocation rather than risking a second
    // production send.
    stopAfterAttempt: true,
  };
}

function rolloutSummary(rows) {
  return rows.reduce(
    (summary, row) => {
      summary.examined += 1;
      if (row.result === 'SENT') summary.sent += 1;
      else if (row.result === 'UNCONFIRMED') summary.unconfirmed += 1;
      else if (
        row.result === 'SKIPPED' ||
        row.result === 'ALREADY_PROCESSED' ||
        row.result === 'NOT_SENT'
      ) {
        summary.skipped += 1;
      }
      return summary;
    },
    {
      examined: 0,
      skipped: 0,
      sent: 0,
      unconfirmed: 0,
    },
  );
}

function rolloutPreviewOutcome(ae, eligibility, now) {
  let reasonCode = eligibility.skipReason;

  if (!reasonCode && !String(eligibility.user?.name || '').trim()) {
    reasonCode = 'WHATSAPP_TEMPLATE_PARAMETER_MISSING';
  }

  return {
    row: formatRolloutRow(ae, {
      result: reasonCode ? 'SKIPPED' : 'ELIGIBLE',
      reasonCode,
      whatsappSent: false,
    }),
    now,
  };
}

async function invokeRolloutLiveHandler(handler, req, automationEventId) {
  const outcome = {
    status: 200,
    body: null,
  };
  const response = {
    status(statusCode) {
      outcome.status = statusCode;
      return response;
    },
    json(body) {
      outcome.body = body;
      return response;
    },
  };

  await handler(
    {
      headers: {
        authorization: req.headers.authorization,
      },
      body: {
        liveSend: true,
        automationEventId,
      },
    },
    response,
  );

  return outcome;
}

export function createRolloutReminderHandler({
  database = prisma,
  sendTemplate = sendWhatsAppTemplate,
  providerDispatchTimeoutMs = PROVIDER_DISPATCH_TIMEOUT_MS,
  isLiveSendEnabled = isWhatsAppLiveSendEnabled,
  isRolloutWorkerEnabled = () =>
    (process.env.WHATSAPP_ROLLOUT_WORKER_ENABLED || '')
      .trim()
      .toLowerCase() === 'true',
} = {}) {
  return async (req, res) => {
    if (!checkAuth(req, res, 'AUTOMATION-ROLLOUT')) return;

    const body = req.body || {};
    const allowedFields = new Set(['liveSend', 'preview', 'dryRun', 'limit']);
    const unknownFields = Object.keys(body).filter(
      (key) => !allowedFields.has(key),
    );

    if (unknownFields.length > 0) {
      return res.status(400).json({
        ok: false,
        error: 'UNKNOWN_FIELDS',
      });
    }

    const preview = body.preview === true || body.dryRun === true;
    const hasLiveSend = body.liveSend === true;

    if (
      (body.preview !== undefined && typeof body.preview !== 'boolean') ||
      (body.dryRun !== undefined && typeof body.dryRun !== 'boolean') ||
      (body.liveSend !== undefined && typeof body.liveSend !== 'boolean')
    ) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_MODE',
      });
    }

    if (preview && hasLiveSend) {
      return res.status(400).json({
        ok: false,
        error: 'MODE_CONFLICT',
      });
    }

    if (!preview && !hasLiveSend) {
      return res.status(400).json({
        ok: false,
        error: 'LIVE_SEND_CONFIRMATION_REQUIRED',
        message: 'liveSend must be boolean true unless preview or dryRun is true.',
      });
    }

    const limit = parseRolloutCandidateLimit(body.limit);
    if (typeof limit === 'object') {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_QUERY_PARAMETERS',
        message: limit.error,
      });
    }

    const watermark = parseRolloutWatermark();
    if (!(watermark instanceof Date)) {
      return res.status(503).json({
        ok: false,
        error: watermark.error,
      });
    }

    const { languageCode } = getLesson1TemplateConfiguration();
    if (!languageCode) {
      return res.status(503).json({
        ok: false,
        error: 'WHATSAPP_TEMPLATE_NOT_CONFIGURED',
      });
    }

    if (!preview && !isLiveSendEnabled()) {
      return res.status(503).json({
        ok: false,
        error: 'WHATSAPP_LIVE_SEND_DISABLED',
      });
    }

    if (!preview && !isRolloutWorkerEnabled()) {
      return res.status(503).json({
        ok: false,
        error: 'WHATSAPP_ROLLOUT_WORKER_DISABLED',
      });
    }

    const now = new Date();

    try {
      const discovered = await database.automationEvent.findMany({
        where: {
          eventType: {
            in: WHATSAPP_REMINDER_EVENT_TYPES,
          },
          status: 'PENDING',
          createdAt: { gte: watermark },
          scheduledAt: { lte: now },
        },
        orderBy: [
          { createdAt: 'asc' },
          { id: 'asc' },
        ],
        take: limit + 1,
        select: {
          id: true,
          eventType: true,
          productKey: true,
          status: true,
          userId: true,
          createdAt: true,
          scheduledAt: true,
          destinationNumberNormalized: true,
        },
      });

      const candidates = discovered.slice(0, limit);
      const rows = [];
      let stopAfterAttempt = false;

      for (const ae of candidates) {
        const eventDestination = getEventDestination(ae);

        if (eventDestination.skipReason) {
          rows.push(formatRolloutRow(ae, {
            result: 'SKIPPED',
            reasonCode: eventDestination.skipReason,
            whatsappSent: false,
          }));
          continue;
        }

        if (
          !ae.createdAt ||
          !(ae.createdAt instanceof Date) ||
          Number.isNaN(ae.createdAt.getTime()) ||
          ae.createdAt < watermark
        ) {
          rows.push(formatRolloutRow(ae, {
            result: 'SKIPPED',
            reasonCode: 'ROLLOUT_WATERMARK_EXCLUDED',
            whatsappSent: false,
          }));
          continue;
        }

        if (!preview) {
          const liveHandler = createLiveReminderHandler({
            database,
            sendTemplate,
            providerDispatchTimeoutMs,
            enforceTestRecipient: false,
            cancelInitialIneligible: true,
            isLiveSendEnabled: () =>
              isLiveSendEnabled() && isRolloutWorkerEnabled(),
          });
          const liveOutcome = await invokeRolloutLiveHandler(
            liveHandler,
            req,
            ae.id,
          );
          const rolloutOutcome = sanitizeRolloutLiveResult(
            ae,
            liveOutcome,
            await getCanaryEventStatus(database, ae),
          );
          rows.push(rolloutOutcome.row);
          stopAfterAttempt = rolloutOutcome.stopAfterAttempt;
          if (stopAfterAttempt) break;
          continue;
        }

        const eligibility = await getLiveReminderEligibility(ae, database);
        rows.push(rolloutPreviewOutcome(ae, eligibility, now).row);
      }

      const counts = rolloutSummary(rows);

      return res.json({
        ok: true,
        worker: 'LESSON1_SIGNUP_REMINDER_ROLLOUT',
        mode: preview ? 'preview' : 'live',
        dryRun: preview,
        generatedAt: now.toISOString(),
        rolloutWatermark: watermark.toISOString(),
        limit,
        hasMore: discovered.length > candidates.length,
        counts,
        rows,
      });
    } catch {
      console.error('[AUTOMATION-ROLLOUT] Database read or processing failed.');
      return res.status(500).json({
        ok: false,
        error: 'INTERNAL_ERROR',
      });
    }
  };
}

router.post('/process-due-reminder-rollout', createRolloutReminderHandler());

// ---------------------------------------------------------------------------
// processOneReminder — shared eligibility + atomic transition logic.
//
// Caller guarantees: ae.status === 'PENDING' and ae.scheduledAt <= now.
// Returns a per-row result object (no `ok` field — callers add that).
// DB errors propagate to the caller's try/catch.
// ---------------------------------------------------------------------------
async function processOneReminder(ae) {
  const user = await prisma.user.findUnique({
    where:  { id: ae.userId },
    select: {
      id:               true,
      email:            true,
      whatsapp_consent: true,
      whatsapp_number:  true,
      whatsapp_number_normalized: true,
      has_access:       true,
    },
  });

  if (!user) {
    const { count, processedAt, cancelledAt } = await cancelRow(ae.id, 'USER_NOT_FOUND');
    if (count === 0) return { result: 'ALREADY_PROCESSED', aeId: ae.id, whatsappSent: false };
    return ineligibleResult(ae, 'USER_NOT_FOUND', processedAt, cancelledAt);
  }
  if (!user.whatsapp_consent) {
    const { count, processedAt, cancelledAt } = await cancelRow(ae.id, 'CONSENT_FALSE');
    if (count === 0) return { result: 'ALREADY_PROCESSED', aeId: ae.id, whatsappSent: false };
    return ineligibleResult(ae, 'CONSENT_FALSE', processedAt, cancelledAt);
  }
  if (!user.whatsapp_number) {
    const { count, processedAt, cancelledAt } = await cancelRow(ae.id, 'NO_WHATSAPP_NUMBER');
    if (count === 0) return { result: 'ALREADY_PROCESSED', aeId: ae.id, whatsappSent: false };
    return ineligibleResult(ae, 'NO_WHATSAPP_NUMBER', processedAt, cancelledAt);
  }
  if (!user.whatsapp_number_normalized) {
    const { count, processedAt, cancelledAt } =
      await cancelRow(ae.id, 'INVALID_WHATSAPP_NUMBER');
    if (count === 0) {
      return {
        result: 'ALREADY_PROCESSED',
        aeId: ae.id,
        whatsappSent: false,
      };
    }
    return ineligibleResult(
      ae,
      'INVALID_WHATSAPP_NUMBER',
      processedAt,
      cancelledAt,
    );
  }

  if (user.has_access) {
    const { count, processedAt, cancelledAt } = await cancelRow(ae.id, 'USER_HAS_ACCESS');
    if (count === 0) return { result: 'ALREADY_PROCESSED', aeId: ae.id, whatsappSent: false };
    return ineligibleResult(ae, 'USER_HAS_ACCESS', processedAt, cancelledAt);
  }

  const phoneSkipReason =
    await getPhoneLevelSkipReason(user.id, user.whatsapp_number_normalized);

  if (phoneSkipReason) {
    const { count, processedAt, cancelledAt } =
      await cancelRow(ae.id, phoneSkipReason);

    if (count === 0) {
      return {
        result: 'ALREADY_PROCESSED',
        aeId: ae.id,
        whatsappSent: false,
      };
    }

    return ineligibleResult(
      ae,
      phoneSkipReason,
      processedAt,
      cancelledAt,
    );
  }

  const lesson1Complete = await isLesson1Complete(ae.userId);

  if (lesson1Complete) {
    const { count, processedAt, cancelledAt } = await cancelRow(ae.id, 'LESSON1_COMPLETE');
    if (count === 0) return { result: 'ALREADY_PROCESSED', aeId: ae.id, whatsappSent: false };
    return ineligibleResult(ae, 'LESSON1_COMPLETE', processedAt, cancelledAt);
  }

  // Atomic transition: PENDING → DRY_RUN (race guard)
  const now = new Date();
  const updated = await prisma.automationEvent.updateMany({
    where: { id: ae.id, status: 'PENDING' },  // ← race guard
    data:  { status: 'DRY_RUN', processedAt: now },
    // sentAt intentionally NOT set — no message was sent
  });

  if (updated.count === 0) {
    console.log(`[AUTOMATION] ALREADY_PROCESSED (race) aeId=${ae.id}`);
    return { result: 'ALREADY_PROCESSED', aeId: ae.id, whatsappSent: false };
  }

  console.log(
    `[AUTOMATION] DRY_RUN aeId=${ae.id} userId=${ae.userId} ` +
    `email=${user.email} processedAt=${now.toISOString()}`,
  );

  return {
    result:       'DRY_RUN',
    aeId:         ae.id,
    userId:       ae.userId,
    email:        user.email,
    scheduledAt:  ae.scheduledAt.toISOString(),
    processedAt:  now.toISOString(),
    sentAt:       null,
    whatsappSent: false,
    eligibility: {
      whatsapp_consent:        true,
      whatsapp_number_present: true,
      has_access:              false,
      lesson1_complete:        false,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Atomically cancel a row that failed an eligibility check.
 * WHERE status=PENDING prevents double-write under concurrent access.
 *
 * Returns { count, processedAt, cancelledAt } so the caller can:
 *   - detect a race (count === 0) and return ALREADY_PROCESSED
 *   - surface the EXACT timestamps written to the DB in the response
 */
async function cancelRow(aeId, reason, database = prisma) {
  const now = new Date();
  const result = await database.automationEvent.updateMany({
    where: { id: aeId, status: 'PENDING' },
    data:  { status: 'CANCELLED', cancelledAt: now, processedAt: now },
  });
  console.log(`[AUTOMATION] CANCELLED aeId=${aeId} reason=${reason} count=${result.count}`);
  return { count: result.count, processedAt: now, cancelledAt: now };
}

/**
 * Guardedly cancel a claimed row before a provider request starts.
 * providerMessageId must still be absent: a provider-confirmed attempt is
 * never recast as unsent, even if another process changes the row.
 */
async function cancelClaimedRow(aeId, reason, database = prisma) {
  const now = new Date();
  const result = await database.automationEvent.updateMany({
    where: {
      id: aeId,
      status: 'SENDING',
      providerMessageId: null,
    },
    data: { status: 'CANCELLED', cancelledAt: now, processedAt: now },
  });
  console.log(
    `[AUTOMATION-LIVE] GUARDED_CANCELLED aeId=${aeId} reason=${reason} count=${result.count}`,
  );
  return { count: result.count, processedAt: now, cancelledAt: now };
}

/**
 * Build a per-row ineligible-cancellation result object.
 * No `ok` field — callers add that when returning to HTTP clients.
 *
 * processedAt and cancelledAt must be the exact Date objects returned
 * by cancelRow so that response timestamps match what was written to DB.
 */
function ineligibleResult(ae, skipReason, processedAt, cancelledAt) {
  return {
    result:       'CANCELLED',
    skipReason,
    aeId:         ae.id,
    userId:       ae.userId,
    processedAt:  processedAt.toISOString(),
    cancelledAt:  cancelledAt.toISOString(),
    sentAt:       null,
    whatsappSent: false,
  };
}

export default router;
