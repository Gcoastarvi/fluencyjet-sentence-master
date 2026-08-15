/**
 * server/__tests__/phase3.test.js
 *
 * Automated tests for the Phase 3 batch endpoint:
 *   POST /api/automation/process-due-reminders-batch
 *
 * Isolation guarantee:
 *   - process.env.AUTOMATION_SECRET is set to a test-only value in beforeEach
 *     and deleted in afterEach.
 *   - All database calls are intercepted by jest.unstable_mockModule.
 *   - No network requests leave this process. No production DB is contacted.
 *   - DATABASE_URL is never read by any code path exercised here.
 *   - No request is made to api.fluencyjet.com.
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import request  from 'supertest';
import express  from 'express';

// ---------------------------------------------------------------------------
// Mock prisma BEFORE importing the router.
// ---------------------------------------------------------------------------
const mockPrisma = {
  automationEvent: {
    findUnique:  jest.fn(),
    findFirst:   jest.fn(),
    findMany:    jest.fn(),
    updateMany:  jest.fn(),
  },
  user:               { findUnique: jest.fn() },
  lessonModeProgress: { findUnique: jest.fn() },
};

jest.unstable_mockModule('../db/client.js', () => ({ default: mockPrisma }));

const { default: automationRouter } = await import('../routes/automationProcessor.js');

// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------
function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/automation', automationRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const SECRET  = 'test-automation-secret-phase3';
const AUTH    = { Authorization: `Bearer ${SECRET}` };
const PAST    = new Date(Date.now() - 60_000);   // 1 min ago — due

// Valid UUID v4 constants (version nibble = 4, variant nibble in [89ab])
const UUID1  = '11111111-1111-4111-8111-111111111111';
const UUID2  = '22222222-2222-4222-8222-222222222222';
const UUID3  = '33333333-3333-4333-8333-333333333333';
const UUID4  = '44444444-4444-4444-8444-444444444444';
const UUID5  = '55555555-5555-4555-8555-555555555555';
const UUID6  = '66666666-6666-4666-8666-666666666666';
const UUID7  = '77777777-7777-4777-8777-777777777777';
const UUID8  = '88888888-8888-4888-8888-888888888888';
const UUID9  = '99999999-9999-4999-8999-999999999999';
const UUID10 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UUID11 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function makeAe(id, userId = 42) {
  return {
    id,
    userId,
    eventType:   'LESSON1_SIGNUP_REMINDER',
    status:      'PENDING',
    scheduledAt: PAST,
    processedAt: null,
    cancelledAt: null,
    createdAt:   new Date(),
  };
}

const eligibleUser = {
  id:               42,
  email:            'test@example.com',
  whatsapp_consent: true,
  whatsapp_number:  '+919999999999',
  has_access:       false,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
beforeEach(() => {
  process.env.AUTOMATION_SECRET = SECRET;
  jest.clearAllMocks();
});

afterEach(() => {
  delete process.env.AUTOMATION_SECRET;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/automation/process-due-reminders-batch — batch endpoint', () => {

  // ── Auth guards ────────────────────────────────────────────────────────────

  describe('Auth guards', () => {
    test('[B-01] Missing AUTOMATION_SECRET → 503 AUTOMATION_NOT_CONFIGURED', async () => {
      delete process.env.AUTOMATION_SECRET;
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'discovery', limit: 1 });
      expect(res.status).toBe(503);
      expect(res.body.error).toBe('AUTOMATION_NOT_CONFIGURED');
    });

    test('[B-02] Poison AUTOMATION_SECRET ("null") → 503 AUTOMATION_NOT_CONFIGURED', async () => {
      process.env.AUTOMATION_SECRET = 'null';
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'discovery', limit: 1 });
      expect(res.status).toBe(503);
      expect(res.body.error).toBe('AUTOMATION_NOT_CONFIGURED');
    });

    test('[B-03] No Authorization header → 401 UNAUTHORIZED', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .send({ dryRun: true, mode: 'discovery', limit: 1 });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    test('[B-04] Wrong Bearer token → 401 UNAUTHORIZED', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set({ Authorization: 'Bearer wrong-token' })
        .send({ dryRun: true, mode: 'discovery', limit: 1 });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });
  });

  // ── dryRun validation ──────────────────────────────────────────────────────

  describe('dryRun validation', () => {
    test('[B-05] dryRun missing → 400 DRY_RUN_FLAG_REQUIRED', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ mode: 'discovery', limit: 1 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('DRY_RUN_FLAG_REQUIRED');
    });

    test('[B-06] dryRun: false → 400 DRY_RUN_FLAG_REQUIRED', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: false, mode: 'discovery', limit: 1 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('DRY_RUN_FLAG_REQUIRED');
    });

    test('[B-07] dryRun: "true" (string) → 400 DRY_RUN_FLAG_REQUIRED', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: 'true', mode: 'discovery', limit: 1 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('DRY_RUN_FLAG_REQUIRED');
    });
  });

  // ── mode field validation ──────────────────────────────────────────────────

  describe('mode field validation', () => {
    test('[B-08] mode missing → 400 INVALID_MODE', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, limit: 1 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_MODE');
    });

    test('[B-09] mode: "auto" → 400 INVALID_MODE', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'auto', limit: 1 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_MODE');
    });

    test('[B-10] mode: "batch" → 400 INVALID_MODE', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'batch', limit: 1 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_MODE');
    });

    test('[B-11] mode: true (boolean) → 400 INVALID_MODE', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: true, limit: 1 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_MODE');
    });
  });

  // ── Unknown field rejection ────────────────────────────────────────────────

  describe('Unknown field rejection', () => {
    test('[B-12] explicit + correct ids + extra key "foo" → 400 UNKNOWN_FIELDS', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'explicit', automationEventIds: [UUID1], foo: 'bar' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('UNKNOWN_FIELDS');
      expect(res.body.message).toContain('foo');
    });

    test('[B-13] discovery + correct limit + extra key "foo" → 400 UNKNOWN_FIELDS', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'discovery', limit: 1, foo: 'bar' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('UNKNOWN_FIELDS');
      expect(res.body.message).toContain('foo');
    });

    test('[B-14] explicit + automationEventsIds (typo, no automationEventIds) → 400 MISSING_AUTOMATION_EVENT_IDS', async () => {
      // Field-specific check fires before unknown-field check
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'explicit', automationEventsIds: [UUID1] });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_AUTOMATION_EVENT_IDS');
    });

    test('[B-15] discovery + automationEventIds present → 400 CONFLICTING_PARAMS', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'discovery', limit: 1, automationEventIds: [UUID1] });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('CONFLICTING_PARAMS');
    });
  });

  // ── Explicit mode — validation ─────────────────────────────────────────────

  describe('Explicit mode — validation', () => {
    test('[B-16] automationEventIds absent → 400 MISSING_AUTOMATION_EVENT_IDS', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'explicit' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_AUTOMATION_EVENT_IDS');
    });

    test('[B-17] limit present alongside automationEventIds → 400 CONFLICTING_PARAMS', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'explicit', automationEventIds: [UUID1], limit: 1 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('CONFLICTING_PARAMS');
    });

    test('[B-18] automationEventIds: [] (empty array) → 400 INVALID_AUTOMATION_EVENT_IDS', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'explicit', automationEventIds: [] });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_AUTOMATION_EVENT_IDS');
    });

    test('[B-19] automationEventIds: ["not-a-uuid"] → 400 INVALID_AUTOMATION_EVENT_IDS', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'explicit', automationEventIds: ['not-a-uuid'] });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_AUTOMATION_EVENT_IDS');
    });

    test('[B-20] 11 distinct valid UUIDs → 400 LIMIT_EXCEEDS_MAX', async () => {
      const ids = [UUID1, UUID2, UUID3, UUID4, UUID5, UUID6, UUID7, UUID8, UUID9, UUID10, UUID11];
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'explicit', automationEventIds: ids });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('LIMIT_EXCEEDS_MAX');
    });

    test('[B-21] 3 UUIDs with 1 duplicate → silently deduped to 2, response ok with requestedIds=2', async () => {
      mockPrisma.automationEvent.findMany.mockResolvedValue([]);
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'explicit', automationEventIds: [UUID1, UUID2, UUID1] });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.requestedIds).toBe(2); // after dedup
      expect(res.body.foundAndDue).toBe(0);
      expect(res.body.notFoundOrNotDue).toHaveLength(2);
    });

    test('[B-22] automationEventIds is a string (not array) → 400 INVALID_AUTOMATION_EVENT_IDS', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'explicit', automationEventIds: UUID1 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_AUTOMATION_EVENT_IDS');
    });

    test('[B-23] 10 distinct valid UUIDs → proceeds (at cap), returns ok with foundAndDue=0', async () => {
      const ids = [UUID1, UUID2, UUID3, UUID4, UUID5, UUID6, UUID7, UUID8, UUID9, UUID10];
      mockPrisma.automationEvent.findMany.mockResolvedValue([]);
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'explicit', automationEventIds: ids });
      expect(res.status).toBe(200);
      expect(res.body.requestedIds).toBe(10);
      expect(res.body.foundAndDue).toBe(0);
    });
  });

  // ── Explicit mode — DB behavior ────────────────────────────────────────────

  describe('Explicit mode — DB behavior', () => {
    test('[B-24] 4 rows: 1 eligible→DRY_RUN, 3 ineligible→CANCELLED (has_access / consent / lesson1)', async () => {
      const ae1 = makeAe(UUID1, 101);
      const ae2 = makeAe(UUID2, 102);
      const ae3 = makeAe(UUID3, 103);
      const ae4 = makeAe(UUID4, 104);

      mockPrisma.automationEvent.findMany.mockResolvedValue([ae1, ae2, ae3, ae4]);

      // ae1 — has_access=true → CANCELLED USER_HAS_ACCESS
      mockPrisma.user.findUnique.mockResolvedValueOnce({ ...eligibleUser, id: 101, has_access: true });
      mockPrisma.automationEvent.updateMany.mockResolvedValueOnce({ count: 1 }); // cancelRow

      // ae2 — whatsapp_consent=false → CANCELLED CONSENT_FALSE
      mockPrisma.user.findUnique.mockResolvedValueOnce({ ...eligibleUser, id: 102, whatsapp_consent: false });
      mockPrisma.automationEvent.updateMany.mockResolvedValueOnce({ count: 1 }); // cancelRow

      // ae3 — lesson1 complete → CANCELLED LESSON1_COMPLETE
      mockPrisma.user.findUnique.mockResolvedValueOnce({ ...eligibleUser, id: 103 });
      mockPrisma.lessonModeProgress.findUnique.mockResolvedValueOnce({ completed: 10, total: 10 });
      mockPrisma.automationEvent.updateMany.mockResolvedValueOnce({ count: 1 }); // cancelRow

      // ae4 — eligible → DRY_RUN
      mockPrisma.user.findUnique.mockResolvedValueOnce({ ...eligibleUser, id: 104 });
      mockPrisma.lessonModeProgress.findUnique.mockResolvedValueOnce(null);
      mockPrisma.automationEvent.updateMany.mockResolvedValueOnce({ count: 1 }); // DRY_RUN

      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'explicit', automationEventIds: [UUID1, UUID2, UUID3, UUID4] });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.mode).toBe('explicit');
      expect(res.body.requestedIds).toBe(4);
      expect(res.body.foundAndDue).toBe(4);
      expect(res.body.processed).toBe(1);
      expect(res.body.cancelled).toBe(3);
      expect(res.body.alreadyProcessed).toBe(0);
      expect(res.body.failed).toBe(0);
      expect(res.body.whatsappSent).toBe(false);

      const r1 = res.body.results.find(r => r.aeId === UUID1);
      expect(r1.result).toBe('CANCELLED');
      expect(r1.skipReason).toBe('USER_HAS_ACCESS');

      const r2 = res.body.results.find(r => r.aeId === UUID2);
      expect(r2.result).toBe('CANCELLED');
      expect(r2.skipReason).toBe('CONSENT_FALSE');

      const r3 = res.body.results.find(r => r.aeId === UUID3);
      expect(r3.result).toBe('CANCELLED');
      expect(r3.skipReason).toBe('LESSON1_COMPLETE');

      const r4 = res.body.results.find(r => r.aeId === UUID4);
      expect(r4.result).toBe('DRY_RUN');
    });

    test('[B-25] ID of CANCELLED row → not returned by DB query → appears in notFoundOrNotDue', async () => {
      // DB query returns [] because the UUID1 row is CANCELLED (status filter)
      mockPrisma.automationEvent.findMany.mockResolvedValue([]);
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'explicit', automationEventIds: [UUID1] });
      expect(res.status).toBe(200);
      expect(res.body.foundAndDue).toBe(0);
      expect(res.body.notFoundOrNotDue).toContain(UUID1);
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    test('[B-26] ID of scheduledAt>now row → not returned by DB query → appears in notFoundOrNotDue', async () => {
      // DB query returns [] because the scheduledAt filter excludes future rows
      mockPrisma.automationEvent.findMany.mockResolvedValue([]);
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'explicit', automationEventIds: [UUID2] });
      expect(res.status).toBe(200);
      expect(res.body.foundAndDue).toBe(0);
      expect(res.body.notFoundOrNotDue).toContain(UUID2);
    });

    test('[B-27] Re-run same IDs after all processed → foundAndDue=0, all IDs in notFoundOrNotDue', async () => {
      mockPrisma.automationEvent.findMany.mockResolvedValue([]);
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'explicit', automationEventIds: [UUID1, UUID2, UUID3] });
      expect(res.status).toBe(200);
      expect(res.body.foundAndDue).toBe(0);
      expect(res.body.notFoundOrNotDue).toEqual(expect.arrayContaining([UUID1, UUID2, UUID3]));
      expect(res.body.notFoundOrNotDue).toHaveLength(3);
    });

    test('[B-28] DRY_RUN row result has sentAt=null', async () => {
      const ae = makeAe(UUID1, 42);
      mockPrisma.automationEvent.findMany.mockResolvedValue([ae]);
      mockPrisma.user.findUnique.mockResolvedValue({ ...eligibleUser });
      mockPrisma.lessonModeProgress.findUnique.mockResolvedValue(null);
      mockPrisma.automationEvent.updateMany.mockResolvedValue({ count: 1 });

      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'explicit', automationEventIds: [UUID1] });

      expect(res.status).toBe(200);
      const dryRunRow = res.body.results.find(r => r.result === 'DRY_RUN');
      expect(dryRunRow).toBeDefined();
      expect(dryRunRow.sentAt).toBeNull();
    });

    test('[B-29] Top-level whatsappSent=false in explicit mode response', async () => {
      mockPrisma.automationEvent.findMany.mockResolvedValue([]);
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'explicit', automationEventIds: [UUID1] });
      expect(res.status).toBe(200);
      expect(res.body.whatsappSent).toBe(false);
    });

    test('[B-30] Race guard: updateMany count=0 → ALREADY_PROCESSED in per-row result', async () => {
      const ae = makeAe(UUID1, 42);
      mockPrisma.automationEvent.findMany.mockResolvedValue([ae]);
      mockPrisma.user.findUnique.mockResolvedValue({ ...eligibleUser });
      mockPrisma.lessonModeProgress.findUnique.mockResolvedValue(null);
      mockPrisma.automationEvent.updateMany.mockResolvedValue({ count: 0 }); // race

      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'explicit', automationEventIds: [UUID1] });

      expect(res.status).toBe(200);
      expect(res.body.alreadyProcessed).toBe(1);
      expect(res.body.processed).toBe(0);
      expect(res.body.results[0].result).toBe('ALREADY_PROCESSED');
    });

    test('[B-31] notFoundOrNotDue accurately lists IDs absent from DB result', async () => {
      const ae = makeAe(UUID1, 42); // UUID1 is found, UUID2 and UUID3 are not
      mockPrisma.automationEvent.findMany.mockResolvedValue([ae]);
      mockPrisma.user.findUnique.mockResolvedValue({ ...eligibleUser });
      mockPrisma.lessonModeProgress.findUnique.mockResolvedValue(null);
      mockPrisma.automationEvent.updateMany.mockResolvedValue({ count: 1 });

      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'explicit', automationEventIds: [UUID1, UUID2, UUID3] });

      expect(res.status).toBe(200);
      expect(res.body.requestedIds).toBe(3);
      expect(res.body.foundAndDue).toBe(1);
      expect(res.body.notFoundOrNotDue).toEqual(expect.arrayContaining([UUID2, UUID3]));
      expect(res.body.notFoundOrNotDue).not.toContain(UUID1);
    });
  });

  // ── Discovery mode — validation ────────────────────────────────────────────

  describe('Discovery mode — validation', () => {
    test('[B-32] limit absent → 400 MISSING_LIMIT', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'discovery' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_LIMIT');
    });

    test('[B-33] limit: 0 → 400 INVALID_LIMIT', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'discovery', limit: 0 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_LIMIT');
    });

    test('[B-34] limit: 11 → 400 LIMIT_EXCEEDS_MAX', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'discovery', limit: 11 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('LIMIT_EXCEEDS_MAX');
    });

    test('[B-35] limit: "5" (string) → 400 INVALID_LIMIT', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'discovery', limit: '5' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_LIMIT');
    });

    test('[B-36] limit: 2.5 (non-integer float) → 400 INVALID_LIMIT', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'discovery', limit: 2.5 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_LIMIT');
    });
  });

  // ── Discovery mode — DB behavior ───────────────────────────────────────────

  describe('Discovery mode — DB behavior', () => {
    test('[B-37] No due rows → 200 with selected=0, all counts 0, empty results', async () => {
      mockPrisma.automationEvent.findMany.mockResolvedValue([]);
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'discovery', limit: 5 });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.mode).toBe('discovery');
      expect(res.body.selected).toBe(0);
      expect(res.body.processed).toBe(0);
      expect(res.body.cancelled).toBe(0);
      expect(res.body.alreadyProcessed).toBe(0);
      expect(res.body.failed).toBe(0);
      expect(res.body.results).toHaveLength(0);
      expect(res.body.whatsappSent).toBe(false);
    });

    test('[B-38] 3 rows: 1 eligible→DRY_RUN, 1 has_access→CANCELLED, 1 consent_false→CANCELLED', async () => {
      const ae1 = makeAe(UUID1, 201);
      const ae2 = makeAe(UUID2, 202);
      const ae3 = makeAe(UUID3, 203);

      mockPrisma.automationEvent.findMany.mockResolvedValue([ae1, ae2, ae3]);

      // ae1 — eligible → DRY_RUN
      mockPrisma.user.findUnique.mockResolvedValueOnce({ ...eligibleUser, id: 201 });
      mockPrisma.lessonModeProgress.findUnique.mockResolvedValueOnce(null);
      mockPrisma.automationEvent.updateMany.mockResolvedValueOnce({ count: 1 });

      // ae2 — has_access → CANCELLED
      mockPrisma.user.findUnique.mockResolvedValueOnce({ ...eligibleUser, id: 202, has_access: true });
      mockPrisma.automationEvent.updateMany.mockResolvedValueOnce({ count: 1 });

      // ae3 — consent=false → CANCELLED
      mockPrisma.user.findUnique.mockResolvedValueOnce({ ...eligibleUser, id: 203, whatsapp_consent: false });
      mockPrisma.automationEvent.updateMany.mockResolvedValueOnce({ count: 1 });

      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'discovery', limit: 5 });

      expect(res.status).toBe(200);
      expect(res.body.mode).toBe('discovery');
      expect(res.body.selected).toBe(3);
      expect(res.body.processed).toBe(1);
      expect(res.body.cancelled).toBe(2);
      expect(res.body.whatsappSent).toBe(false);
      expect(res.body.results[0].result).toBe('DRY_RUN');
      expect(res.body.results[0].sentAt).toBeNull();
      expect(res.body.results[1].result).toBe('CANCELLED');
      expect(res.body.results[2].result).toBe('CANCELLED');
    });

    test('[B-39] Re-run discovery after all processed → selected=0', async () => {
      mockPrisma.automationEvent.findMany.mockResolvedValue([]);
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'discovery', limit: 5 });
      expect(res.status).toBe(200);
      expect(res.body.selected).toBe(0);
      expect(res.body.results).toHaveLength(0);
    });

    test('[B-40] limit:2 with mock returning 2 rows → selected=2', async () => {
      const ae1 = makeAe(UUID1, 301);
      const ae2 = makeAe(UUID2, 302);
      // Mock returns exactly 2 rows (as if DB applied TAKE 2)
      mockPrisma.automationEvent.findMany.mockResolvedValue([ae1, ae2]);

      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ ...eligibleUser, id: 301 })
        .mockResolvedValueOnce({ ...eligibleUser, id: 302 });
      mockPrisma.lessonModeProgress.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockPrisma.automationEvent.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 1 });

      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'discovery', limit: 2 });

      expect(res.status).toBe(200);
      expect(res.body.selected).toBe(2);
      expect(res.body.processed).toBe(2);
      expect(res.body.results).toHaveLength(2);
    });

    test('[B-41] Discovery response structure: mode="discovery", dryRun=true, whatsappSent=false, correct counts', async () => {
      mockPrisma.automationEvent.findMany.mockResolvedValue([]);
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'discovery', limit: 3 });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        ok:               true,
        dryRun:           true,
        mode:             'discovery',
        whatsappSent:     false,
        selected:         0,
        processed:        0,
        cancelled:        0,
        alreadyProcessed: 0,
        failed:           0,
      });
      expect(Array.isArray(res.body.results)).toBe(true);
    });
  });

  // ── Cancellation race + timestamp correctness ──────────────────────────────

  describe('Cancellation race guard + timestamp accuracy (batch)', () => {
    test('[B-42] Cancellation race in batch: eligibility fails, updateMany count=0 → ALREADY_PROCESSED per-row', async () => {
      // Uses CONSENT_FALSE as representative reason.
      const ae = makeAe(UUID1, 42);
      mockPrisma.automationEvent.findMany.mockResolvedValue([ae]);
      mockPrisma.user.findUnique.mockResolvedValue({ ...eligibleUser, whatsapp_consent: false });
      mockPrisma.automationEvent.updateMany.mockResolvedValue({ count: 0 }); // race

      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'explicit', automationEventIds: [UUID1] });

      expect(res.status).toBe(200);
      expect(res.body.alreadyProcessed).toBe(1);
      expect(res.body.cancelled).toBe(0);
      expect(res.body.results[0].result).toBe('ALREADY_PROCESSED');
      expect(res.body.results[0].aeId).toBe(UUID1);
      expect(res.body.results[0].whatsappSent).toBe(false);
      // Must NOT be CANCELLED
      expect(res.body.results[0].result).not.toBe('CANCELLED');
    });

    test('[B-43] Batch cancellation timestamps: processedAt and cancelledAt are identical and fall within test window', async () => {
      // Uses USER_HAS_ACCESS as representative reason.
      const ae = makeAe(UUID1, 42);
      mockPrisma.automationEvent.findMany.mockResolvedValue([ae]);
      mockPrisma.user.findUnique.mockResolvedValue({ ...eligibleUser, has_access: true });
      mockPrisma.automationEvent.updateMany.mockResolvedValue({ count: 1 });

      const before = Date.now();
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders-batch')
        .set(AUTH)
        .send({ dryRun: true, mode: 'explicit', automationEventIds: [UUID1] });
      const after = Date.now();

      expect(res.status).toBe(200);
      const row = res.body.results[0];
      expect(row.result).toBe('CANCELLED');
      expect(row.skipReason).toBe('USER_HAS_ACCESS');

      // Both timestamps must be valid ISO 8601 strings
      expect(typeof row.processedAt).toBe('string');
      expect(typeof row.cancelledAt).toBe('string');
      expect(() => new Date(row.processedAt).toISOString()).not.toThrow();
      expect(() => new Date(row.cancelledAt).toISOString()).not.toThrow();

      // They must be exactly equal — same Date object serialised for both
      expect(row.processedAt).toBe(row.cancelledAt);

      // The timestamp must fall within the window of this test
      const ts = new Date(row.processedAt).getTime();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });
  });
});
