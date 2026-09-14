import express from 'express';
import prisma from '../db/client.js';
import { adminOnly } from '../middleware/adminOnly.js';
import {
  APPROVED_BROADCAST_TEMPLATES,
  createWhatsAppBroadcastHandler,
  createWhatsAppBroadcastWorkerHandler,
  isWhatsAppBroadcastWorkerEnabled,
  isWhatsAppLiveSendEnabled,
  reconcileSendingHandler,
} from './automationProcessor.js';

const router = express.Router();
const MAX_AUDIENCE = 100;
const STUCK_SENDING_AFTER_MS = 15 * 60 * 1000;
const POISON_VALUES = new Set([
  '',
  'undefined',
  'null',
  'changeme',
  'change-me',
  'your_token_here',
  'your_access_token_here',
  'your_phone_number_id_here',
]);

function configured(name, validator = () => true) {
  const value = String(process.env[name] || '').trim();
  return !POISON_VALUES.has(value.toLowerCase()) && validator(value);
}

function internalAuthorization() {
  return true;
}

function maskWhatsAppNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  const visible = digits.slice(-4);
  return `${'•'.repeat(Math.max(4, digits.length - visible.length))}${visible}`;
}

function requireStuckBroadcast(event, now = new Date()) {
  const processedAtMs = event.processedAt
    ? new Date(event.processedAt).getTime()
    : Number.NaN;
  if (
    event.eventType !== 'WHATSAPP_BROADCAST' ||
    !Number.isFinite(processedAtMs) ||
    processedAtMs > now.getTime() - STUCK_SENDING_AFTER_MS
  ) {
    return {
      status: 409,
      body: {
        ok: false,
        error: 'BROADCAST_NOT_STUCK',
      },
    };
  }
  return null;
}

function parseUserIds(value) {
  if (typeof value === 'string') {
    const tokens = value.split(/[\s,]+/).filter(Boolean);
    if (tokens.some((id) => !/^\d+$/.test(id))) return null;
    value = tokens.map((id) => Number(id));
  }
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_AUDIENCE ||
    value.some((id) => !Number.isSafeInteger(id) || id <= 0)
  ) {
    return null;
  }
  return [...new Set(value)];
}

function parseDate(value, endOfDay = false) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function unknownFields(body, allowed) {
  return Object.keys(body || {}).some((key) => !allowed.has(key));
}

function sendDelegated(handler, body, req, res, headers = req.headers) {
  const delegatedRequest = Object.create(req);
  delegatedRequest.body = body;
  delegatedRequest.headers = headers;
  return handler(delegatedRequest, res);
}

async function resolveAudience(body, database) {
  const directIds = body.userIds === undefined ? null : parseUserIds(body.userIds);
  if (body.userIds !== undefined && !directIds) {
    return { error: 'INVALID_USER_IDS' };
  }

  const source = body.source;
  const from = body.from;
  const to = body.to;
  const hasSourceFilter =
    source !== undefined || from !== undefined || to !== undefined;
  if (!directIds && !hasSourceFilter) return { error: 'AUDIENCE_REQUIRED' };
  if (directIds && hasSourceFilter) return { error: 'AUDIENCE_MODES_CONFLICT' };

  let ids = directIds;
  if (!ids) {
    if (
      typeof source !== 'string' ||
      !source.trim() ||
      typeof from !== 'string' ||
      typeof to !== 'string'
    ) {
      return { error: 'SOURCE_DATE_RANGE_REQUIRED' };
    }
    const start = parseDate(from);
    const end = parseDate(to, true);
    if (!start || !end || start > end) return { error: 'INVALID_DATE_RANGE' };

    const users = await database.user.findMany({
      where: {
        source: source.trim(),
        created_at: { gte: start, lte: end },
      },
      orderBy: { id: 'asc' },
      take: MAX_AUDIENCE + 1,
      select: { id: true },
    });
    if (users.length > MAX_AUDIENCE) return { error: 'AUDIENCE_TOO_LARGE' };
    ids = users.map(({ id }) => id);
  }

  return {
    userIds: ids,
    requested: ids.length,
    bounded: ids.length >= MAX_AUDIENCE,
  };
}

const audienceFields = new Set([
  'userIds',
  'source',
  'from',
  'to',
]);
const campaignFields = new Set([
  'campaignKey',
  'templateName',
  'scheduledAt',
  ...audienceFields,
]);

function statusCounts() {
  return {
    total: 0,
    PENDING: 0,
    SENDING: 0,
    SENT: 0,
    CANCELLED: 0,
    FAILED: 0,
    DONE: 0,
    DRY_RUN: 0,
  };
}

router.use(adminOnly);

function providerReadiness(_req, res) {
  const provider = {
    phoneNumberIdConfigured: configured('WHATSAPP_PHONE_NUMBER_ID', (value) =>
      /^\d+$/.test(value),
    ),
    accessTokenConfigured: configured('WHATSAPP_ACCESS_TOKEN'),
    graphApiVersionConfigured: configured('WHATSAPP_GRAPH_API_VERSION', (value) =>
      /^v\d+\.\d+$/.test(value),
    ),
  };
  const gates = {
    liveSendEnabled: isWhatsAppLiveSendEnabled(),
    broadcastWorkerEnabled: isWhatsAppBroadcastWorkerEnabled(),
  };
  const blockers = [
    ...Object.entries(provider)
      .filter(([, value]) => !value)
      .map(([name]) => `${name} is not configured`),
    ...Object.entries(gates)
      .filter(([, value]) => !value)
      .map(([name]) => `${name} is disabled`),
  ];
  return res.json({
    ok: true,
    ready: blockers.length === 0,
    provider,
    gates,
    approvedTemplates: Object.values(APPROVED_BROADCAST_TEMPLATES).map(
      ({ templateName, languageCode }) => ({
        name: templateName,
        languageCode,
        bodyParameters: ['learnerName'],
      }),
    ),
    blockers,
  });
}
router.get('/readiness', providerReadiness);

async function leadSources(_req, res) {
  try {
    const rows = await prisma.user.findMany({
      where: { source: { not: null } },
      distinct: ['source'],
      orderBy: { source: 'asc' },
      select: { source: true },
    });
    return res.json({
      ok: true,
      sources: rows.map(({ source }) => source).filter(Boolean),
    });
  } catch {
    return res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' });
  }
}
router.get('/lead-sources', leadSources);

async function scheduleOrPreview(req, res, preview) {
  if (unknownFields(req.body, campaignFields)) {
    return res.status(400).json({ ok: false, error: 'UNKNOWN_FIELDS' });
  }
  try {
    const audience = await resolveAudience(req.body || {}, prisma);
    if (audience.error) {
      return res.status(400).json({ ok: false, error: audience.error });
    }
    const body = {
      campaignKey: req.body.campaignKey,
      templateName: req.body.templateName,
      scheduledAt: req.body.scheduledAt,
      preview,
      userIds: audience.userIds,
    };
    return sendDelegated(
      createWhatsAppBroadcastHandler({
        database: prisma,
        authorize: internalAuthorization,
      }),
      body,
      req,
      res,
    );
  } catch {
    return res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' });
  }
}

router.post('/preview', (req, res) => scheduleOrPreview(req, res, true));
router.post('/campaigns', (req, res) => scheduleOrPreview(req, res, false));

async function processCampaign(req, res) {
  const allowed = new Set(['limit']);
  if (unknownFields(req.body, allowed)) {
    return res.status(400).json({ ok: false, error: 'UNKNOWN_FIELDS' });
  }
  const campaignKey = req.params.campaignKey;
  const workerBody = {
    liveSend: true,
    campaignKey,
    ...(req.body?.limit === undefined ? {} : { limit: req.body.limit }),
  };
  return sendDelegated(
    createWhatsAppBroadcastWorkerHandler({
      database: prisma,
      authorize: internalAuthorization,
    }),
    workerBody,
    req,
    res,
  );
}

router.post('/campaigns/:campaignKey/process', processCampaign);

router.get('/campaigns', async (_req, res) => {
  try {
    const events = await prisma.automationEvent.findMany({
      where: { eventType: 'WHATSAPP_BROADCAST' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        campaignKey: true,
        status: true,
        createdAt: true,
        scheduledAt: true,
        processedAt: true,
        sentAt: true,
      },
    });
    const campaigns = new Map();
    for (const event of events) {
      if (!event.campaignKey) continue;
      const item = campaigns.get(event.campaignKey) || {
        campaignKey: event.campaignKey,
        counts: statusCounts(),
        createdAt: event.createdAt,
        scheduledAt: event.scheduledAt,
      };
      item.counts.total += 1;
      if (item.counts[event.status] === undefined) item.counts[event.status] = 0;
      item.counts[event.status] += 1;
      campaigns.set(event.campaignKey, item);
    }
    return res.json({ ok: true, campaigns: [...campaigns.values()] });
  } catch {
    return res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' });
  }
});

router.get('/campaigns/:campaignKey/events', async (req, res) => {
  if (Object.keys(req.query || {}).length > 0) {
    return res.status(400).json({ ok: false, error: 'UNKNOWN_QUERY_FIELDS' });
  }
  if (!/^[a-z0-9][a-z0-9._-]{0,119}$/i.test(req.params.campaignKey)) {
    return res.status(400).json({ ok: false, error: 'INVALID_CAMPAIGN_KEY' });
  }
  try {
    const events = await prisma.automationEvent.findMany({
      where: { eventType: 'WHATSAPP_BROADCAST', campaignKey: req.params.campaignKey },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_AUDIENCE,
      select: {
        id: true,
        userId: true,
        status: true,
        createdAt: true,
        scheduledAt: true,
        processedAt: true,
        sentAt: true,
        cancelledAt: true,
        providerMessageId: true,
        destinationNumberNormalized: true,
      },
    });
    const users = await prisma.user.findMany({
      where: { id: { in: [...new Set(events.map((event) => event.userId))] } },
      select: { id: true, name: true },
    });
    const namesByUserId = new Map(users.map((user) => [user.id, user.name]));
    return res.json({
      ok: true,
      campaignKey: req.params.campaignKey,
      events: events.map(({
        providerMessageId,
        destinationNumberNormalized,
        ...event
      }) => {
        const processedAtMs = event.processedAt
          ? new Date(event.processedAt).getTime()
          : Number.NaN;
        return {
          ...event,
          learnerName: namesByUserId.get(event.userId) || null,
          whatsappNumberMasked: maskWhatsAppNumber(destinationNumberNormalized),
          providerMessageIdPresent: Boolean(providerMessageId),
          quarantinable:
            event.status === 'SENDING' &&
            Number.isFinite(processedAtMs) &&
            processedAtMs <= Date.now() - STUCK_SENDING_AFTER_MS,
        };
      }),
    });
  } catch {
    return res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' });
  }
});

async function quarantine(req, res) {
  const allowed = new Set(['campaignKey', 'idempotencyKey']);
  if (unknownFields(req.body, allowed)) {
    return res.status(400).json({ ok: false, error: 'UNKNOWN_FIELDS' });
  }
  if (typeof req.body?.idempotencyKey !== 'string') {
    return res.status(400).json({ ok: false, error: 'INVALID_IDEMPOTENCY_KEY' });
  }
  const body = {
    automationEventId: req.params.eventId,
    campaignKey: req.body.campaignKey,
    action: 'QUARANTINE',
    reasonCode: 'OUTCOME_UNKNOWN',
  };
  const headers = {
    ...req.headers,
    'idempotency-key': req.body.idempotencyKey,
  };
  return reconcileSendingHandler(
    Object.assign(Object.create(req), { body, headers }),
    res,
    {
    database: prisma,
    authorize: internalAuthorization,
    validateLockedEvent: requireStuckBroadcast,
    },
  );
}

router.post('/events/:eventId/quarantine', quarantine);

export default router;