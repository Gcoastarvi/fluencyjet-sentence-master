-- Phase 13C1a: bounded/indexed access for the read-only sending monitor.
-- These are additive indexes only; no historical data is changed.

CREATE INDEX IF NOT EXISTS "AutomationEvent_eventType_status_scheduledAt_idx"
  ON "AutomationEvent" ("eventType", "status", "scheduledAt");

CREATE INDEX IF NOT EXISTS "AutomationEvent_eventType_status_processedAt_idx"
  ON "AutomationEvent" ("eventType", "status", "processedAt");

CREATE INDEX IF NOT EXISTS "AutomationEvent_eventType_status_createdAt_idx"
  ON "AutomationEvent" ("eventType", "status", "createdAt")
  -- Prisma schema indexes cannot express this partial predicate; retain this
  -- SQL migration when applying schema-driven changes.
  WHERE "processedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "WhatsAppMessageEvent_eventType_createdAt_idx"
  ON "WhatsAppMessageEvent" ("eventType", "createdAt");

CREATE INDEX IF NOT EXISTS "AutomationReconciliationJournal_createdAt_id_idx"
  ON "AutomationReconciliationJournal" ("createdAt", "id");