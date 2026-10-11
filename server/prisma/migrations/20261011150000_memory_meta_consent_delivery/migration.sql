-- Additive only. Historical decisions remain denied; historical deliveries
-- remain unqueued. No existing payment, assessment or WhatsApp data is changed.
BEGIN;
CREATE TABLE "MemoryMetaConsent" (
  "id" TEXT NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "granted" BOOLEAN NOT NULL DEFAULT false,
  "adultConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "version" VARCHAR(80) NOT NULL,
  "source" VARCHAR(100) NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "MemoryMetaConsent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MemoryMetaConsent_tokenHash_key" ON "MemoryMetaConsent"("tokenHash");

ALTER TABLE "MemoryAssessmentSession"
  ADD COLUMN "metaConsentId" TEXT,
  ADD COLUMN "metaConsentGranted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "metaConsentAt" TIMESTAMP(3),
  ADD COLUMN "metaConsentVersion" VARCHAR(80),
  ADD COLUMN "metaConsentSource" VARCHAR(100),
  ADD COLUMN "metaConsentRevision" INTEGER;
ALTER TABLE "MemoryMasterclassCheckoutIntent"
  ADD COLUMN "metaConsentId" TEXT,
  ADD COLUMN "metaConsentGranted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "metaConsentAt" TIMESTAMP(3),
  ADD COLUMN "metaConsentVersion" VARCHAR(80),
  ADD COLUMN "metaConsentSource" VARCHAR(100),
  ADD COLUMN "metaConsentRevision" INTEGER;
ALTER TABLE "MemoryMasterclassPurchase"
  ADD COLUMN "metaConsentId" TEXT,
  ADD COLUMN "metaConsentGranted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "metaConsentAt" TIMESTAMP(3),
  ADD COLUMN "metaConsentVersion" VARCHAR(80),
  ADD COLUMN "metaConsentSource" VARCHAR(100),
  ADD COLUMN "metaConsentRevision" INTEGER,
  ADD COLUMN "metaDeliveryStatus" VARCHAR(40),
  ADD COLUMN "metaEventTime" TIMESTAMP(3),
  ADD COLUMN "metaAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "metaNextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "metaLeaseToken" VARCHAR(64),
  ADD COLUMN "metaLeaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "metaLastErrorCode" VARCHAR(80),
  ADD COLUMN "metaDeliveredAt" TIMESTAMP(3);
CREATE INDEX "MemoryMasterclassPurchase_metaDeliveryStatus_metaNextAttemptAt_idx"
  ON "MemoryMasterclassPurchase"("metaDeliveryStatus", "metaNextAttemptAt");
COMMIT;
