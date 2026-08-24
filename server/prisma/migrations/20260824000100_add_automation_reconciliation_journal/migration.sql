-- Add durable, append-only history for operator reconciliation actions.
CREATE TYPE "ReconciliationAction" AS ENUM ('MARK_SENT', 'QUARANTINE');

CREATE TYPE "ReconciliationDecision" AS ENUM ('APPLIED', 'REJECTED');

CREATE TABLE "AutomationReconciliationJournal" (
    "id" TEXT NOT NULL,
    "automationEventId" TEXT NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "action" "ReconciliationAction" NOT NULL,
    "decision" "ReconciliationDecision" NOT NULL,
    "priorStatus" "AutomationStatus" NOT NULL,
    "resultingStatus" "AutomationStatus" NOT NULL,
    "reasonCode" VARCHAR(64) NOT NULL,
    "evidenceEventId" TEXT,
    "evidenceStatus" VARCHAR(20),
    "authMethod" VARCHAR(40) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationReconciliationJournal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AutomationReconciliationJournal_automationEventId_idempotencyKey_key"
  ON "AutomationReconciliationJournal"("automationEventId", "idempotencyKey");

CREATE INDEX "AutomationReconciliationJournal_automationEventId_createdAt_idx"
  ON "AutomationReconciliationJournal"("automationEventId", "createdAt");

ALTER TABLE "AutomationReconciliationJournal"
  ADD CONSTRAINT "AutomationReconciliationJournal_automationEventId_fkey"
  FOREIGN KEY ("automationEventId") REFERENCES "AutomationEvent"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AutomationReconciliationJournal"
  ADD CONSTRAINT "AutomationReconciliationJournal_evidenceEventId_fkey"
  FOREIGN KEY ("evidenceEventId") REFERENCES "WhatsAppMessageEvent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;