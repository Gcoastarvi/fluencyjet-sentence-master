-- Run only in an isolated disposable PostgreSQL database:
-- psql ... -v ON_ERROR_STOP=1 -f server/__tests__/fixtures/memoryStandaloneMigration.sql
CREATE TABLE "MemoryAssessmentSession" ("id" TEXT PRIMARY KEY);
CREATE TABLE "MemoryMasterclassCheckoutIntent" (
  "id" TEXT PRIMARY KEY,
  "memoryAssessmentSessionId" TEXT NOT NULL REFERENCES "MemoryAssessmentSession"("id") ON DELETE RESTRICT,
  "trackId" VARCHAR(50) NOT NULL,
  "eventKey" VARCHAR(100) NOT NULL,
  "purchaserName" VARCHAR(100)
);
CREATE TABLE "MemoryMasterclassPurchase" (
  "id" TEXT PRIMARY KEY,
  "checkoutIntentId" TEXT NOT NULL UNIQUE REFERENCES "MemoryMasterclassCheckoutIntent"("id") ON DELETE RESTRICT,
  "purchaserName" VARCHAR(100)
);
INSERT INTO "MemoryAssessmentSession" VALUES ('historical-session');
INSERT INTO "MemoryMasterclassCheckoutIntent" VALUES
  ('historical-intent', 'historical-session', 'school_foundation', 'historical-event', NULL);
INSERT INTO "MemoryMasterclassPurchase" VALUES ('historical-purchase', 'historical-intent', NULL);

\ir ../../prisma/migrations/20261010120000_add_memory_standalone_checkout/migration.sql

INSERT INTO "MemoryMasterclassCheckoutIntent"
  ("id", "memoryAssessmentSessionId", "trackId", "eventKey", "checkoutSource", "purchaserName")
VALUES ('standalone-intent', NULL, 'advanced', 'new-event', 'standalone_vsl', 'Test purchaser');
INSERT INTO "MemoryMasterclassPurchase"
  ("id", "checkoutIntentId", "checkoutSource", "trackId", "purchaserName")
VALUES ('standalone-purchase', 'standalone-intent', 'standalone_vsl', 'advanced', 'Test purchaser');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "MemoryMasterclassCheckoutIntent"
    WHERE "id" = 'historical-intent' AND "checkoutSource" = 'assessment'
      AND "memoryAssessmentSessionId" = 'historical-session'
      AND "eventKey" = 'historical-event' AND "purchaserName" IS NULL
  ) THEN RAISE EXCEPTION 'Historical intent was not preserved'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "MemoryMasterclassPurchase"
    WHERE "id" = 'historical-purchase' AND "checkoutSource" = 'assessment'
      AND "trackId" IS NULL AND "purchaserName" IS NULL
  ) THEN RAISE EXCEPTION 'Historical purchase was not preserved'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "MemoryMasterclassCheckoutIntent"
    WHERE "id" = 'standalone-intent' AND "memoryAssessmentSessionId" IS NULL
      AND "checkoutSource" = 'standalone_vsl' AND "trackId" = 'advanced'
  ) THEN RAISE EXCEPTION 'Standalone intent could not be stored'; END IF;
  BEGIN
    DELETE FROM "MemoryAssessmentSession" WHERE "id" = 'historical-session';
    RAISE EXCEPTION 'Assessment foreign key protection was lost';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END $$;
