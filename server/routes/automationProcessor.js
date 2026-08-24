// server/routes/automationProcessor.js
//
// Phase 2 – DRY_RUN reminder processor (single-reminder endpoint).
// Phase 3 – Batch DRY_RUN processor (explicit-ID and discovery modes).
//
// Protected endpoints for manually evaluating due LESSON1_SIGNUP_REMINDER events.
// No WhatsApp messages are sent. No cron is used. No live sends occur.
//
import express from 'express';
import prisma from '../db/client.js';
import { sendWhatsAppTemplate } from '../services/whatsappProvider.js';
import { normalizeWhatsAppNumber } from '../lib/whatsappNumber.js';
import { acquireWhatsAppDestinationLock } from '../lib/whatsappDestinationLock.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------
const POISON     = new Set(['undefined', 'null', 'false', '0', 'none', 'secret']);
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BATCH  = 10;

async function getPhoneLevelSkipReason(
  ownerUserId,
  normalizedNumber,
  { checkDurableSuppression = false } = {},
) {
  if (checkDurableSuppression) {
    const suppression = await prisma.whatsAppPhoneSuppression.findUnique({
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
  const ownerStillMatches = await prisma.user.findFirst({
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

  const phoneUsers = await prisma.user.findMany({
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

async function getLiveReminderEligibility(ae) {
  const eventDestination = getEventDestination(ae);

  if (eventDestination.skipReason) {
    return eventDestination;
  }

  const user = await prisma.user.findUnique({
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
    { checkDurableSuppression: true },
  );

  if (phoneSkipReason) {
    return { skipReason: phoneSkipReason };
  }

  return {
    destination: eventDestination.destination,
    skipReason: null,
    user,
  };
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
router.post('/process-due-reminder-live', async (req, res) => {
  // ── 1. Existing automation auth ──────────────────────────────────────────
  if (!checkAuth(req, res, 'AUTOMATION-LIVE')) return;

  // ── 2. Global live-send kill switch ──────────────────────────────────────
  if ((process.env.WHATSAPP_LIVE_SEND_ENABLED || '').trim().toLowerCase() !== 'true') {
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

  // Template configuration is also fail-closed.
  const templateName =
    (process.env.WHATSAPP_LESSON1_TEMPLATE_NAME || '').trim();
  const languageCode =
    (process.env.WHATSAPP_LESSON1_TEMPLATE_LANGUAGE || '').trim();

  if (!templateName || !languageCode) {
    return res.status(503).json({
      ok: false,
      error: 'WHATSAPP_TEMPLATE_NOT_CONFIGURED',
    });
  }

  try {
    // ── 7. Fetch exact reminder ─────────────────────────────────────────────
    const ae = await prisma.automationEvent.findUnique({
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
    const eligibility = await getLiveReminderEligibility(ae);

    if (eligibility.skipReason) {
      const result = await cancelRow(ae.id, eligibility.skipReason);
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

    const lesson1 = await prisma.lessonModeProgress.findUnique({
      where: {
        userId_lessonId_mode: {
          userId: String(ae.userId),
          lessonId: 1,
          mode: 'reorder',
        },
      },
      select: { completed: true, total: true },
    });

    const lesson1Complete =
      lesson1 !== null &&
      lesson1.total > 0 &&
      lesson1.completed >= lesson1.total;

    if (lesson1Complete) {
      const result = await cancelRow(ae.id, 'LESSON1_COMPLETE');
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
          'LESSON1_COMPLETE',
          result.processedAt,
          result.cancelledAt,
        ),
      });
    }

    // ── 9. Hard test-number allowlist ───────────────────────────────────────
    if (destination !== allowedTestNumberNormalized) {
      return res.status(403).json({
        ok: false,
        error: 'TEST_RECIPIENT_ONLY',
        aeId: ae.id,
        whatsappSent: false,
      });
    }

    // ── 10. Destination lock, claim, final gate, and provider invocation ───
    // The lock transaction intentionally remains open until the provider
    // request is known. A STOP holding this same lock must commit before a
    // waiting reminder can pass its final eligibility gate, while a send that
    // wins the lock remains serialized until its provider attempt is known.
    const response = await prisma.$transaction(async (tx) => {
      await acquireWhatsAppDestinationLock(tx, destination);

      const claimedAt = new Date();
      const claimed = await prisma.automationEvent.updateMany({
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
        return {
          status: 200,
          body: {
            ok: true,
            result: 'ALREADY_PROCESSED',
            aeId: ae.id,
            whatsappSent: false,
          },
        };
      }

      console.log(
        `[AUTOMATION-LIVE] CLAIMED aeId=${ae.id} userId=${ae.userId}`,
      );

      // A STOP, ownership change, or account-access change may occur between
      // the first eligibility query and the atomic claim above.
      const finalEligibility = await getLiveReminderEligibility(ae);

      if (finalEligibility.skipReason) {
        const result = await cancelClaimedRow(ae.id, finalEligibility.skipReason);

        if (result.count === 0) {
          return {
            status: 200,
            body: {
              ok: true,
              result: 'ALREADY_PROCESSED',
              aeId: ae.id,
              whatsappSent: false,
            },
          };
        }

        return {
          status: 200,
          body: {
            ok: true,
            ...ineligibleResult(
              ae,
              finalEligibility.skipReason,
              result.processedAt,
              result.cancelledAt,
            ),
          },
        };
      }

      let delivery;

      try {
        delivery = await sendWhatsAppTemplate({
          to: destination,
          templateName,
          languageCode,
          bodyParameters: [learnerName],
          automationEventId: ae.id,
        });
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
        ae.payload &&
        typeof ae.payload === 'object' &&
        !Array.isArray(ae.payload)
          ? ae.payload
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
        const finalized = await prisma.automationEvent.updateMany({
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
          console.error(
            `[AUTOMATION-LIVE] FINALIZE_CONFLICT aeId=${ae.id} ` +
            `messageId=${delivery.messageId}`,
          );

          return {
            status: 500,
            body: {
              ok: false,
              error: 'SEND_FINALIZE_CONFLICT',
              aeId: ae.id,
              providerMessageId: delivery.messageId,
              whatsappSent: true,
            },
          };
        }
      } catch (finalizeErr) {
        console.error(
          `[AUTOMATION-LIVE] FINALIZE_FAILED aeId=${ae.id} ` +
          `messageId=${delivery.messageId} error=${finalizeErr.message}`,
        );

        // Provider already confirmed the message. Never retry automatically.
        return {
          status: 500,
          body: {
            ok: false,
            error: 'SEND_FINALIZE_FAILED',
            aeId: ae.id,
            providerMessageId: delivery.messageId,
            whatsappSent: true,
          },
        };
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
    });

    return res.status(response.status).json(response.body);
  } catch (err) {
    console.error('[AUTOMATION-LIVE] Unexpected error:', err.message);

    return res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
    });
  }
});

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

  const lesson1 = await prisma.lessonModeProgress.findUnique({
    where: {
      userId_lessonId_mode: {
        userId:   String(ae.userId),
        lessonId: 1,
        mode:     'reorder',
      },
    },
    select: { completed: true, total: true },
  });

  const lesson1Complete =
    lesson1 !== null && lesson1.total > 0 && lesson1.completed >= lesson1.total;

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
async function cancelRow(aeId, reason) {
  const now = new Date();
  const result = await prisma.automationEvent.updateMany({
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
async function cancelClaimedRow(aeId, reason) {
  const now = new Date();
  const result = await prisma.automationEvent.updateMany({
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
