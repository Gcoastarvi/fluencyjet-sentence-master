-- Phase 9.1: durable WhatsApp phone suppression and destination identity.
--
-- This migration is intentionally additive. Existing reminders and historical
-- webhook events remain unchanged; no rows are backfilled.

-- AlterTable
ALTER TABLE "AutomationEvent"
ADD COLUMN "destinationNumberNormalized" VARCHAR(20);

-- AlterTable
ALTER TABLE "WhatsAppMessageEvent"
ADD COLUMN "senderNumberNormalized" VARCHAR(20),
ADD COLUMN "inboundClassification" VARCHAR(40),
ADD COLUMN "inboundCommand" VARCHAR(30);

-- CreateTable
CREATE TABLE "WhatsAppPhoneSuppression" (
    "phoneNumberNormalized" VARCHAR(20) NOT NULL,
    "isOptedOut" BOOLEAN NOT NULL DEFAULT true,
    "optedOutAt" TIMESTAMP(3),
    "optOutCommand" VARCHAR(30),
    "sourceEventId" TEXT,
    "clearedAt" TIMESTAMP(3),
    "clearanceSource" VARCHAR(150),
    "clearanceReason" VARCHAR(255),
    "clearedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppPhoneSuppression_pkey" PRIMARY KEY ("phoneNumberNormalized")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppPhoneSuppression_sourceEventId_key"
ON "WhatsAppPhoneSuppression"("sourceEventId");

-- CreateIndex
CREATE INDEX "WhatsAppPhoneSuppression_isOptedOut_optedOutAt_idx"
ON "WhatsAppPhoneSuppression"("isOptedOut", "optedOutAt");

-- CreateIndex
CREATE INDEX "WhatsAppPhoneSuppression_clearedByUserId_idx"
ON "WhatsAppPhoneSuppression"("clearedByUserId");

-- AddForeignKey
ALTER TABLE "WhatsAppPhoneSuppression"
ADD CONSTRAINT "WhatsAppPhoneSuppression_sourceEventId_fkey"
FOREIGN KEY ("sourceEventId") REFERENCES "WhatsAppMessageEvent"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppPhoneSuppression"
ADD CONSTRAINT "WhatsAppPhoneSuppression_clearedByUserId_fkey"
FOREIGN KEY ("clearedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;