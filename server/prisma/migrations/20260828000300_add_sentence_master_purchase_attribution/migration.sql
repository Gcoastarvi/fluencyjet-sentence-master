-- Preserve the authenticated identity and timing evidence captured at checkout.
CREATE TABLE IF NOT EXISTS "SentenceMasterCheckoutIntent" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "productKey" VARCHAR(80) NOT NULL,
    "learnerEmail" VARCHAR(191) NOT NULL,
    "destinationNumberNormalized" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SentenceMasterCheckoutIntent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS
  "SentenceMasterCheckoutIntent_productKey_learnerEmail_destinationNumberNormalized_createdAt_idx"
  ON "SentenceMasterCheckoutIntent"
  ("productKey", "learnerEmail", "destinationNumberNormalized", "createdAt");

CREATE INDEX IF NOT EXISTS
  "SentenceMasterCheckoutIntent_userId_productKey_createdAt_idx"
  ON "SentenceMasterCheckoutIntent" ("userId", "productKey", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SentenceMasterCheckoutIntent_userId_fkey'
  ) THEN
    ALTER TABLE "SentenceMasterCheckoutIntent"
      ADD CONSTRAINT "SentenceMasterCheckoutIntent_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "SpokenEnglishPurchase"
  ADD COLUMN IF NOT EXISTS "userId" INTEGER,
  ADD COLUMN IF NOT EXISTS "productKey" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "sourceIntentId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS
  "SpokenEnglishPurchase_sourceIntentId_key"
  ON "SpokenEnglishPurchase" ("sourceIntentId");

CREATE INDEX IF NOT EXISTS
  "SpokenEnglishPurchase_userId_productKey_status_idx"
  ON "SpokenEnglishPurchase" ("userId", "productKey", "status");

CREATE INDEX IF NOT EXISTS
  "SpokenEnglishPurchase_productKey_status_idx"
  ON "SpokenEnglishPurchase" ("productKey", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SpokenEnglishPurchase_userId_fkey'
  ) THEN
    ALTER TABLE "SpokenEnglishPurchase"
      ADD CONSTRAINT "SpokenEnglishPurchase_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SpokenEnglishPurchase_sourceIntentId_fkey'
  ) THEN
    ALTER TABLE "SpokenEnglishPurchase"
      ADD CONSTRAINT "SpokenEnglishPurchase_sourceIntentId_fkey"
      FOREIGN KEY ("sourceIntentId")
      REFERENCES "SentenceMasterCheckoutIntent"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;