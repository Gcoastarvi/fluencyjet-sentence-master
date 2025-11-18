-- Add new columns if they are missing
ALTER TABLE "Badge" ADD COLUMN IF NOT EXISTS "label"   TEXT;
ALTER TABLE "Badge" ADD COLUMN IF NOT EXISTS "min_xp"  INTEGER;

-- If old columns exist, copy their values into the new ones
UPDATE "Badge"
SET "label" = "name"
WHERE "label" IS NULL AND "name" IS NOT NULL;

UPDATE "Badge"
SET "min_xp" = "threshold"
WHERE "min_xp" IS NULL AND "threshold" IS NOT NULL;
