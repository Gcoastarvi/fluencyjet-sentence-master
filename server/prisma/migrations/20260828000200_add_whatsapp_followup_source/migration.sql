-- Make checkout follow-up creation idempotent per authoritative source event.
-- The partial unique index is SQL-only because Prisma schema metadata cannot
-- express a conditional unique index.

ALTER TABLE "AutomationEvent"
  ADD COLUMN IF NOT EXISTS "sourceAutomationEventId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS
  "AutomationEvent_anyQuestions_sourceEvent_uniq"
  ON "AutomationEvent" ("sourceAutomationEventId")
  WHERE "eventType" = 'ANY_QUESTIONS_REMINDER'
    AND "sourceAutomationEventId" IS NOT NULL;