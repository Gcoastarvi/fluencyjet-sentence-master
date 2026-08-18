-- AlterTable
ALTER TABLE "AutomationEvent" ADD COLUMN     "providerMessageId" VARCHAR(255);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "whatsapp_opted_out_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WhatsAppMessageEvent" (
    "id" TEXT NOT NULL,
    "automationEventId" TEXT,
    "providerMessageId" VARCHAR(255) NOT NULL,
    "eventType" VARCHAR(50) NOT NULL,
    "recipientWaId" VARCHAR(30),
    "senderWaId" VARCHAR(30),
    "eventTimestamp" TIMESTAMP(3),
    "errorCode" INTEGER,
    "errorTitle" VARCHAR(255),
    "errorDetails" TEXT,
    "rawPayload" JSONB,
    "dedupKey" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessageEvent_dedupKey_key" ON "WhatsAppMessageEvent"("dedupKey");

-- CreateIndex
CREATE INDEX "WhatsAppMessageEvent_providerMessageId_idx" ON "WhatsAppMessageEvent"("providerMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppMessageEvent_automationEventId_idx" ON "WhatsAppMessageEvent"("automationEventId");

-- CreateIndex
CREATE INDEX "WhatsAppMessageEvent_eventType_eventTimestamp_idx" ON "WhatsAppMessageEvent"("eventType", "eventTimestamp");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationEvent_providerMessageId_key" ON "AutomationEvent"("providerMessageId");

-- AddForeignKey
ALTER TABLE "WhatsAppMessageEvent" ADD CONSTRAINT "WhatsAppMessageEvent_automationEventId_fkey" FOREIGN KEY ("automationEventId") REFERENCES "AutomationEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
