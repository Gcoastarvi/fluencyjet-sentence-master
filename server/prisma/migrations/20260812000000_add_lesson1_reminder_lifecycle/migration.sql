-- Add LESSON1_SIGNUP_REMINDER to AutomationType enum
ALTER TYPE "AutomationType" ADD VALUE IF NOT EXISTS 'LESSON1_SIGNUP_REMINDER';

-- Add CANCELLED to AutomationStatus enum
ALTER TYPE "AutomationStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- Add scheduledAt and cancelledAt columns to AutomationEvent
ALTER TABLE "AutomationEvent"
  ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);

-- Composite index for efficient per-user event lookups
CREATE INDEX IF NOT EXISTS "AutomationEvent_userId_eventType_status_idx"
  ON "AutomationEvent" ("userId", "eventType", "status");

-- Index for future worker: find pending events due for sending
CREATE INDEX IF NOT EXISTS "AutomationEvent_status_scheduledAt_idx"
  ON "AutomationEvent" ("status", "scheduledAt");

-- Partial unique index: at most one PENDING event per (userId, eventType)
CREATE UNIQUE INDEX IF NOT EXISTS "AutomationEvent_userId_eventType_pending_uniq"
  ON "AutomationEvent" ("userId", "eventType")
  WHERE "status" = 'PENDING';
