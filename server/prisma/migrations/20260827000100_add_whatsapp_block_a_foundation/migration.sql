-- Phase 16B Block A: additive shared WhatsApp journey foundation.
-- This migration preserves all historical AutomationEvent rows.

ALTER TYPE "AutomationType"
  ADD VALUE IF NOT EXISTS 'LESSON1_WATCH_REMINDER';

ALTER TYPE "AutomationType"
  ADD VALUE IF NOT EXISTS 'LEARNING_PATH_DISCOVERY_REMINDER';

ALTER TABLE "AutomationEvent"
  ADD COLUMN IF NOT EXISTS "productKey" VARCHAR(80) NOT NULL
  DEFAULT 'sentence_master';

CREATE TABLE IF NOT EXISTS "UserJourneyMilestone" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "productKey" VARCHAR(80) NOT NULL,
  "milestoneType" VARCHAR(80) NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserJourneyMilestone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS
  "UserJourneyMilestone_userId_productKey_milestoneType_key"
  ON "UserJourneyMilestone" ("userId", "productKey", "milestoneType");

CREATE INDEX IF NOT EXISTS
  "UserJourneyMilestone_productKey_milestoneType_occurredAt_idx"
  ON "UserJourneyMilestone" ("productKey", "milestoneType", "occurredAt");

CREATE INDEX IF NOT EXISTS
  "AutomationEvent_userId_productKey_eventType_status_idx"
  ON "AutomationEvent" ("userId", "productKey", "eventType", "status");

ALTER TABLE "UserJourneyMilestone"
  DROP CONSTRAINT IF EXISTS "UserJourneyMilestone_userId_fkey";

ALTER TABLE "UserJourneyMilestone"
  ADD CONSTRAINT "UserJourneyMilestone_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Generalize the existing active-event guard to include product identity.
-- All historical rows receive sentence_master above, so the invariant is
-- preserved while future products cannot collide on the same event type.
DROP INDEX IF EXISTS "AutomationEvent_userId_eventType_active_uniq";

CREATE UNIQUE INDEX IF NOT EXISTS
  "AutomationEvent_userId_productKey_eventType_active_uniq"
  ON "AutomationEvent" ("userId", "productKey", "eventType")
  WHERE "status" IN ('PENDING', 'SENDING');