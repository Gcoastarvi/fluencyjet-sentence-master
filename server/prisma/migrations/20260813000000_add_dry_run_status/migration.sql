-- Add DRY_RUN to AutomationStatus enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'DRY_RUN'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AutomationStatus')
  ) THEN
    ALTER TYPE "AutomationStatus" ADD VALUE 'DRY_RUN';
  END IF;
END$$;

-- Add processedAt column to AutomationEvent (idempotent)
ALTER TABLE "AutomationEvent"
  ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3);
