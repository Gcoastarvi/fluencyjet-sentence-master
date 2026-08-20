/**
 * server/__tests__/phase2.test.js
 *
 * Automated regression tests for the Phase 2 single-reminder endpoint:
 *   POST /api/automation/process-due-reminders
 *
 * These are NEW automated tests. The previously proven Phase 2 behaviors
 * were validated manually against production (api.fluencyjet.com) using
 * real test users. This file creates automated coverage of the same paths
 * using mocked Prisma — NO production database is contacted.
 *
 * Isolation guarantee:
 *   - process.env.AUTOMATION_SECRET is set to a test-only value in beforeEach
 *     and deleted in afterEach.
 *   - All database calls are intercepted by jest.unstable_mockModule.
 *   - No network requests are made outside the in-process Express app.
 *   - DATABASE_URL is never read by any code path exercised here.
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import request  from 'supertest';
import express  from 'express';

// ---------------------------------------------------------------------------
// Mock prisma BEFORE importing the router (required for Jest ESM mocking).
// ---------------------------------------------------------------------------
const mockPrisma = {
  automationEvent: {
    findUnique:  jest.fn(),
    findFirst:   jest.fn(),
    findMany:    jest.fn(),
    updateMany:  jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  lessonModeProgress: { findUnique: jest.fn() },
};

jest.unstable_mockModule('../db/client.js', () => ({ default: mockPrisma }));

// Dynamic import AFTER mock is registered.
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
const SECRET = 'test-automation-secret-phase2';
const AUTH   = { Authorization: `Bearer ${SECRET}` };
const PAST   = new Date(Date.now() - 60_000);   // 1 min ago  — due
const FUTURE = new Date(Date.now() + 600_000);  // 10 min ahead — not due

const AE_ID  = '11111111-1111-4111-8111-111111111111';
const USER_ID = 42;

const pendingDueAe = {
  id:          AE_ID,
  userId:      USER_ID,
  eventType:   'LESSON1_SIGNUP_REMINDER',
  status:      'PENDING',
  scheduledAt: PAST,
  processedAt: null,
  cancelledAt: null,
  createdAt:   new Date(),
};

const eligibleUser = {
  id:               USER_ID,
  email:            'test@example.com',
  whatsapp_consent: true,
  whatsapp_number:  '+919999999999',
  whatsapp_number_normalized: '+919999999999',
  whatsapp_opted_out_at: null,
  has_access:       false,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
beforeEach(() => {
  process.env.AUTOMATION_SECRET = SECRET;
  jest.clearAllMocks();

  mockPrisma.user.findFirst.mockResolvedValue({ id: 42 });

  mockPrisma.user.findMany.mockResolvedValue([
    {
      has_access: false,
      whatsapp_opted_out_at: null,
    },
  ]);
});

afterEach(() => {
  delete process.env.AUTOMATION_SECRET;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/automation/process-due-reminders — single-reminder endpoint', () => {

  // ── Auth guards ────────────────────────────────────────────────────────────

  describe('Auth guards', () => {
    test('[P2-01] Missing AUTOMATION_SECRET → 503 AUTOMATION_NOT_CONFIGURED', async () => {
      delete process.env.AUTOMATION_SECRET;
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({ dryRun: true, automationEventId: AE_ID });
      expect(res.status).toBe(503);
      expect(res.body.error).toBe('AUTOMATION_NOT_CONFIGURED');
    });

    test('[P2-02] Poison AUTOMATION_SECRET ("undefined") → 503 AUTOMATION_NOT_CONFIGURED', async () => {
      process.env.AUTOMATION_SECRET = 'undefined';
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({ dryRun: true, automationEventId: AE_ID });
      expect(res.status).toBe(503);
      expect(res.body.error).toBe('AUTOMATION_NOT_CONFIGURED');
    });

    test('[P2-03] No Authorization header → 401 UNAUTHORIZED', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .send({ dryRun: true, automationEventId: AE_ID });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    test('[P2-04] Wrong Bearer token → 401 UNAUTHORIZED', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set({ Authorization: 'Bearer wrong-token' })
        .send({ dryRun: true, automationEventId: AE_ID });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });
  });

  // ── dryRun validation ──────────────────────────────────────────────────────

  describe('dryRun validation', () => {
    test('[P2-05] dryRun missing → 400 DRY_RUN_FLAG_REQUIRED', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({ automationEventId: AE_ID });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('DRY_RUN_FLAG_REQUIRED');
    });

    test('[P2-06] dryRun: false → 400 DRY_RUN_FLAG_REQUIRED', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({ dryRun: false, automationEventId: AE_ID });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('DRY_RUN_FLAG_REQUIRED');
    });

    test('[P2-07] dryRun: "true" (string) → 400 DRY_RUN_FLAG_REQUIRED', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({ dryRun: 'true', automationEventId: AE_ID });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('DRY_RUN_FLAG_REQUIRED');
    });
  });

  // ── Identifier validation ──────────────────────────────────────────────────

  describe('Identifier validation', () => {
    test('[P2-08] No identifier → 400 MISSING_IDENTIFIER', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({ dryRun: true });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('MISSING_IDENTIFIER');
    });

    test('[P2-09] Multiple identifiers (email + userId) → 400 AMBIGUOUS_IDENTIFIER', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({ dryRun: true, email: 'a@b.com', userId: 1 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('AMBIGUOUS_IDENTIFIER');
    });
  });

  // ── automationEventId path ─────────────────────────────────────────────────

  describe('automationEventId path', () => {
    test('[P2-10] automationEventId not found → 404 NOT_FOUND', async () => {
      mockPrisma.automationEvent.findUnique.mockResolvedValue(null);
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({ dryRun: true, automationEventId: AE_ID });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });

    test('[P2-11] Wrong eventType → 400 WRONG_EVENT_TYPE', async () => {
      mockPrisma.automationEvent.findUnique.mockResolvedValue({
        ...pendingDueAe,
        eventType: 'OTHER_EVENT_TYPE',
      });
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({ dryRun: true, automationEventId: AE_ID });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('WRONG_EVENT_TYPE');
    });

    test('[P2-12] status=DRY_RUN → 200 ALREADY_PROCESSED', async () => {
      mockPrisma.automationEvent.findUnique.mockResolvedValue({
        ...pendingDueAe,
        status:      'DRY_RUN',
        processedAt: new Date().toISOString(),
      });
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({ dryRun: true, automationEventId: AE_ID });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.result).toBe('ALREADY_PROCESSED');
      expect(res.body.existingStatus).toBe('DRY_RUN');
      expect(res.body.whatsappSent).toBe(false);
    });
  });

  // ── email path ─────────────────────────────────────────────────────────────

  describe('email path', () => {
    test('[P2-13] email user not found → 404 USER_NOT_FOUND', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({ dryRun: true, email: 'nobody@example.com' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('USER_NOT_FOUND');
    });
  });

  // ── userId path ────────────────────────────────────────────────────────────

  describe('userId path', () => {
    test('[P2-14] userId: -1 → 400 INVALID_USER_ID', async () => {
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({ dryRun: true, userId: -1 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_USER_ID');
    });

    test('[P2-15] userId valid but user not found → 404 USER_NOT_FOUND', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({ dryRun: true, userId: 9999 });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('USER_NOT_FOUND');
    });
  });

  // ── email/userId — no PENDING row ──────────────────────────────────────────

  describe('email/userId — no PENDING row', () => {
    test('[P2-16] email, no event ever created → 200 result=NOT_FOUND', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID });
      mockPrisma.automationEvent.findFirst
        .mockResolvedValueOnce(null)  // PENDING lookup
        .mockResolvedValueOnce(null); // historical fallback
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({ dryRun: true, email: 'test@example.com' });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.result).toBe('NOT_FOUND');
      expect(res.body.whatsappSent).toBe(false);
    });

    test('[P2-17] email, PENDING not found but historical DRY_RUN exists → 200 ALREADY_PROCESSED', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID });
      mockPrisma.automationEvent.findFirst
        .mockResolvedValueOnce(null)  // PENDING lookup
        .mockResolvedValueOnce({ ...pendingDueAe, status: 'DRY_RUN' }); // historical
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({ dryRun: true, email: 'test@example.com' });
      expect(res.status).toBe(200);
      expect(res.body.result).toBe('ALREADY_PROCESSED');
      expect(res.body.existingStatus).toBe('DRY_RUN');
      expect(res.body.whatsappSent).toBe(false);
    });
  });

  // ── Due-time check ─────────────────────────────────────────────────────────

  describe('Due-time check', () => {
    test('[P2-18] scheduledAt in future → 200 NOT_DUE (no DB write)', async () => {
      mockPrisma.automationEvent.findUnique.mockResolvedValue({
        ...pendingDueAe,
        scheduledAt: FUTURE,
      });
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({ dryRun: true, automationEventId: AE_ID });
      expect(res.status).toBe(200);
      expect(res.body.result).toBe('NOT_DUE');
      expect(res.body.whatsappSent).toBe(false);
      expect(mockPrisma.automationEvent.updateMany).not.toHaveBeenCalled();
    });
  });

  // ── Eligibility checks via processOneReminder ──────────────────────────────

  describe('Eligibility checks (processOneReminder)', () => {
    test('[P2-19] User deleted after event created → 200 CANCELLED USER_NOT_FOUND', async () => {
      mockPrisma.automationEvent.findUnique.mockResolvedValue({ ...pendingDueAe });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.automationEvent.updateMany.mockResolvedValue({ count: 1 });
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({ dryRun: true, automationEventId: AE_ID });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.result).toBe('CANCELLED');
      expect(res.body.skipReason).toBe('USER_NOT_FOUND');
      expect(res.body.sentAt).toBeNull();
      expect(res.body.whatsappSent).toBe(false);
    });

    test('[P2-20] whatsapp_consent=false → 200 CANCELLED CONSENT_FALSE', async () => {
      mockPrisma.automationEvent.findUnique.mockResolvedValue({ ...pendingDueAe });
      mockPrisma.user.findUnique.mockResolvedValue({ ...eligibleUser, whatsapp_consent: false });
      mockPrisma.automationEvent.updateMany.mockResolvedValue({ count: 1 });
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({ dryRun: true, automationEventId: AE_ID });
      expect(res.status).toBe(200);
      expect(res.body.result).toBe('CANCELLED');
      expect(res.body.skipReason).toBe('CONSENT_FALSE');
      expect(res.body.sentAt).toBeNull();
    });

    test('[P2-21] whatsapp_number=null → 200 CANCELLED NO_WHATSAPP_NUMBER', async () => {
      mockPrisma.automationEvent.findUnique.mockResolvedValue({ ...pendingDueAe });
      mockPrisma.user.findUnique.mockResolvedValue({ ...eligibleUser, whatsapp_number: null });
      mockPrisma.automationEvent.updateMany.mockResolvedValue({ count: 1 });
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({ dryRun: true, automationEventId: AE_ID });
      expect(res.status).toBe(200);
      expect(res.body.result).toBe('CANCELLED');
      expect(res.body.skipReason).toBe('NO_WHATSAPP_NUMBER');
    });

    test('[P2-22] has_access=true → 200 CANCELLED USER_HAS_ACCESS', async () => {
      mockPrisma.automationEvent.findUnique.mockResolvedValue({ ...pendingDueAe });
      mockPrisma.user.findUnique.mockResolvedValue({ ...eligibleUser, has_access: true });
      mockPrisma.automationEvent.updateMany.mockResolvedValue({ count: 1 });
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({ dryRun: true, automationEventId: AE_ID });
      expect(res.status).toBe(200);
      expect(res.body.result).toBe('CANCELLED');
      expect(res.body.skipReason).toBe('USER_HAS_ACCESS');
    });

    test('[P2-23] Lesson 1 reorder complete → 200 CANCELLED LESSON1_COMPLETE', async () => {
      mockPrisma.automationEvent.findUnique.mockResolvedValue({ ...pendingDueAe });
      mockPrisma.user.findUnique.mockResolvedValue({ ...eligibleUser });
      mockPrisma.lessonModeProgress.findUnique.mockResolvedValue({ completed: 10, total: 10 });
      mockPrisma.automationEvent.updateMany.mockResolvedValue({ count: 1 });
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({ dryRun: true, automationEventId: AE_ID });
      expect(res.status).toBe(200);
      expect(res.body.result).toBe('CANCELLED');
      expect(res.body.skipReason).toBe('LESSON1_COMPLETE');
    });
    test('[P2-23A] Same phone peer has access → CANCELLED PHONE_HAS_ACCESS', async () => {
      mockPrisma.automationEvent.findUnique.mockResolvedValue({
        ...pendingDueAe,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        ...eligibleUser,
      });
      mockPrisma.user.findMany.mockResolvedValue([
        {
          has_access: false,
          whatsapp_opted_out_at: null,
        },
        {
          has_access: true,
          whatsapp_opted_out_at: null,
        },
      ]);
      mockPrisma.automationEvent.updateMany.mockResolvedValue({
        count: 1,
      });

      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({
          dryRun: true,
          automationEventId: AE_ID,
        });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('CANCELLED');
      expect(res.body.skipReason).toBe('PHONE_HAS_ACCESS');
      expect(res.body.whatsappSent).toBe(false);

      expect(mockPrisma.lessonModeProgress.findUnique)
        .not.toHaveBeenCalled();
    });

    test('[P2-23B] Same phone peer opted out → CANCELLED PHONE_OPTED_OUT', async () => {
      mockPrisma.automationEvent.findUnique.mockResolvedValue({
        ...pendingDueAe,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        ...eligibleUser,
      });
      mockPrisma.user.findMany.mockResolvedValue([
        {
          has_access: false,
          whatsapp_opted_out_at: null,
        },
        {
          has_access: false,
          whatsapp_opted_out_at: new Date(),
        },
      ]);
      mockPrisma.automationEvent.updateMany.mockResolvedValue({
        count: 1,
      });

      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({
          dryRun: true,
          automationEventId: AE_ID,
        });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('CANCELLED');
      expect(res.body.skipReason).toBe('PHONE_OPTED_OUT');
      expect(res.body.whatsappSent).toBe(false);

      expect(mockPrisma.lessonModeProgress.findUnique)
        .not.toHaveBeenCalled();
    });

    test('[P2-23C] Missing normalized phone → CANCELLED INVALID_WHATSAPP_NUMBER', async () => {
      mockPrisma.automationEvent.findUnique.mockResolvedValue({
        ...pendingDueAe,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        ...eligibleUser,
        whatsapp_number: 'invalid-number',
        whatsapp_number_normalized: null,
      });
      mockPrisma.automationEvent.updateMany.mockResolvedValue({
        count: 1,
      });

      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({
          dryRun: true,
          automationEventId: AE_ID,
        });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('CANCELLED');
      expect(res.body.skipReason)
        .toBe('INVALID_WHATSAPP_NUMBER');
      expect(res.body.whatsappSent).toBe(false);

      expect(mockPrisma.user.findMany)
        .not.toHaveBeenCalled();

      expect(mockPrisma.lessonModeProgress.findUnique)
        .not.toHaveBeenCalled();
    });

    test('[P2-23E] Reminder owner changed canonical phone → CANCELLED PHONE_IDENTITY_CHANGED', async () => {
      mockPrisma.automationEvent.findUnique.mockResolvedValue({
        ...pendingDueAe,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        ...eligibleUser,
      });
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.automationEvent.updateMany.mockResolvedValue({
        count: 1,
      });

      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({
          dryRun: true,
          automationEventId: AE_ID,
        });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('CANCELLED');
      expect(res.body.skipReason)
        .toBe('PHONE_IDENTITY_CHANGED');
      expect(res.body.whatsappSent).toBe(false);

      expect(mockPrisma.user.findMany)
        .not.toHaveBeenCalled();

      expect(mockPrisma.lessonModeProgress.findUnique)
        .not.toHaveBeenCalled();
    });

    test('[P2-23D] Canonical identity resolves to no users → fail closed', async () => {
      mockPrisma.automationEvent.findUnique.mockResolvedValue({
        ...pendingDueAe,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        ...eligibleUser,
      });
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.automationEvent.updateMany.mockResolvedValue({
        count: 1,
      });

      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({
          dryRun: true,
          automationEventId: AE_ID,
        });

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('CANCELLED');
      expect(res.body.skipReason)
        .toBe('PHONE_IDENTITY_NOT_FOUND');
      expect(res.body.whatsappSent).toBe(false);

      expect(mockPrisma.lessonModeProgress.findUnique)
        .not.toHaveBeenCalled();
    });

  });

  // ── DRY_RUN transition ─────────────────────────────────────────────────────

  describe('DRY_RUN transition', () => {
    test('[P2-24] All checks pass → 200 DRY_RUN, sentAt=null, whatsappSent=false', async () => {
      mockPrisma.automationEvent.findUnique.mockResolvedValue({ ...pendingDueAe });
      mockPrisma.user.findUnique.mockResolvedValue({ ...eligibleUser });
      mockPrisma.lessonModeProgress.findUnique.mockResolvedValue(null);
      mockPrisma.automationEvent.updateMany.mockResolvedValue({ count: 1 });
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({ dryRun: true, automationEventId: AE_ID });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.result).toBe('DRY_RUN');
      expect(res.body.aeId).toBe(AE_ID);
      expect(res.body.sentAt).toBeNull();
      expect(res.body.whatsappSent).toBe(false);
      expect(res.body.eligibility).toMatchObject({
        whatsapp_consent:        true,
        whatsapp_number_present: true,
        has_access:              false,
        lesson1_complete:        false,
      });
    });

    test('[P2-25] Race guard: updateMany count=0 → 200 ALREADY_PROCESSED', async () => {
      mockPrisma.automationEvent.findUnique.mockResolvedValue({ ...pendingDueAe });
      mockPrisma.user.findUnique.mockResolvedValue({ ...eligibleUser });
      mockPrisma.lessonModeProgress.findUnique.mockResolvedValue(null);
      mockPrisma.automationEvent.updateMany.mockResolvedValue({ count: 0 }); // another process won
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({ dryRun: true, automationEventId: AE_ID });
      expect(res.status).toBe(200);
      expect(res.body.result).toBe('ALREADY_PROCESSED');
      expect(res.body.whatsappSent).toBe(false);
    });
  });

  // ── Cancellation race + timestamp correctness ──────────────────────────────

  describe('Cancellation race guard + timestamp accuracy', () => {
    test('[P2-26] Cancellation race: eligibility fails, updateMany count=0 → ALREADY_PROCESSED', async () => {
      // Uses CONSENT_FALSE as representative reason; same code path covers all 5 reasons.
      mockPrisma.automationEvent.findUnique.mockResolvedValue({ ...pendingDueAe });
      mockPrisma.user.findUnique.mockResolvedValue({ ...eligibleUser, whatsapp_consent: false });
      mockPrisma.automationEvent.updateMany.mockResolvedValue({ count: 0 }); // race — another processor won
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({ dryRun: true, automationEventId: AE_ID });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.result).toBe('ALREADY_PROCESSED');
      expect(res.body.aeId).toBe(AE_ID);
      expect(res.body.whatsappSent).toBe(false);
      // Must NOT be CANCELLED even though eligibility failed
      expect(res.body.result).not.toBe('CANCELLED');
    });

    test('[P2-27] Successful cancellation: processedAt and cancelledAt are identical and match the timestamp written to DB', async () => {
      // Uses USER_HAS_ACCESS as representative reason.
      mockPrisma.automationEvent.findUnique.mockResolvedValue({ ...pendingDueAe });
      mockPrisma.user.findUnique.mockResolvedValue({ ...eligibleUser, has_access: true });
      mockPrisma.automationEvent.updateMany.mockResolvedValue({ count: 1 }); // success

      const before = Date.now();
      const res = await request(makeApp())
        .post('/api/automation/process-due-reminders')
        .set(AUTH)
        .send({ dryRun: true, automationEventId: AE_ID });
      const after = Date.now();

      expect(res.status).toBe(200);
      expect(res.body.result).toBe('CANCELLED');
      expect(res.body.skipReason).toBe('USER_HAS_ACCESS');

      // Both timestamps must be valid ISO 8601 strings
      const { processedAt, cancelledAt } = res.body;
      expect(typeof processedAt).toBe('string');
      expect(typeof cancelledAt).toBe('string');
      expect(() => new Date(processedAt).toISOString()).not.toThrow();
      expect(() => new Date(cancelledAt).toISOString()).not.toThrow();

      // They must be exactly equal — same Date object was serialised for both fields
      expect(processedAt).toBe(cancelledAt);

      // The timestamp must fall within the window of this test (no stale or second-independent timestamp)
      const ts = new Date(processedAt).getTime();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });
  });
});
