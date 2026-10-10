-- Preserve historical assessment associations; allow genuine standalone orders.
ALTER TABLE "MemoryMasterclassCheckoutIntent"
  ALTER COLUMN "memoryAssessmentSessionId" DROP NOT NULL,
  ADD COLUMN "checkoutSource" VARCHAR(40) NOT NULL DEFAULT 'assessment';

ALTER TABLE "MemoryMasterclassPurchase"
  ADD COLUMN "checkoutSource" VARCHAR(40) NOT NULL DEFAULT 'assessment',
  ADD COLUMN "trackId" VARCHAR(50);
