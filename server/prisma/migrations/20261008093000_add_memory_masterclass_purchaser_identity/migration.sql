-- Nullable identity snapshots preserve existing checkout intents and purchases.
-- Do not backfill from lead/provider data: those may identify a different person.
ALTER TABLE "MemoryMasterclassCheckoutIntent"
ADD COLUMN "purchaserName" VARCHAR(100),
ADD COLUMN "purchaserEmail" VARCHAR(191),
ADD COLUMN "purchaserPhone" VARCHAR(40);

ALTER TABLE "MemoryMasterclassPurchase"
ADD COLUMN "purchaserName" VARCHAR(100),
ADD COLUMN "purchaserEmail" VARCHAR(191),
ADD COLUMN "purchaserPhone" VARCHAR(40);
