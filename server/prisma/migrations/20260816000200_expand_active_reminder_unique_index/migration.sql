-- Phase 4: prevent a second active reminder from being created while
-- an existing reminder is either waiting to send or currently being sent.
--
-- Create the stronger index first so the existing PENDING-only protection
-- remains in place if creation unexpectedly fails.

CREATE UNIQUE INDEX IF NOT EXISTS "AutomationEvent_userId_eventType_active_uniq"
  ON "AutomationEvent" ("userId", "eventType")
  WHERE "status" IN ('PENDING', 'SENDING');

DROP INDEX IF EXISTS "AutomationEvent_userId_eventType_pending_uniq";
