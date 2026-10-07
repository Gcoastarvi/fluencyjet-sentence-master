ALTER TABLE "MemoryAssessmentSession"
ADD COLUMN "whatsappScoreDeliveryStatus" VARCHAR(30),
ADD COLUMN "whatsappScoreDeliveryAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "whatsappScoreDeliveryLastAttemptAt" TIMESTAMP(3),
ADD COLUMN "whatsappScoreDeliveryAcceptedAt" TIMESTAMP(3),
ADD COLUMN "whatsappScoreDeliveryError" VARCHAR(500);

CREATE INDEX "MemoryAssessmentSession_whatsappScoreDeliveryStatus_idx"
ON "MemoryAssessmentSession"("whatsappScoreDeliveryStatus");
