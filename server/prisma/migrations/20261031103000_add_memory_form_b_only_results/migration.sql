-- Permit purchase-verified retests without a Form A baseline.
ALTER TABLE "MemoryRetestAccessGrant"
  ALTER COLUMN "assessmentSessionId" DROP NOT NULL;

-- Store Form B-only results separately from Form A assessments.
CREATE TABLE "MemoryFormBOnlyResult" (
  "id" TEXT NOT NULL,
  "purchaseId" TEXT NOT NULL,
  "trackId" VARCHAR(50) NOT NULL,
  "formBAnswers" JSONB NOT NULL,
  "formBResult" JSONB NOT NULL,
  "formBScore" DECIMAL(5,2) NOT NULL,
  "formBRetentionRatio" DECIMAL(6,3),
  "formBCompletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MemoryFormBOnlyResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemoryFormBOnlyResult_purchaseId_key"
  ON "MemoryFormBOnlyResult"("purchaseId");

CREATE INDEX "MemoryFormBOnlyResult_trackId_formBCompletedAt_idx"
  ON "MemoryFormBOnlyResult"("trackId", "formBCompletedAt");

ALTER TABLE "MemoryFormBOnlyResult"
  ADD CONSTRAINT "MemoryFormBOnlyResult_purchaseId_fkey"
  FOREIGN KEY ("purchaseId")
  REFERENCES "MemoryMasterclassPurchase"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
