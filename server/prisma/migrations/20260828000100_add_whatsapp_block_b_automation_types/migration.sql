-- Phase 16D Block B: Sentence Master checkout reminder event types.
-- Additive only; historical AutomationEvent rows are preserved.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'AutomationType'
  ) THEN
    ALTER TYPE "AutomationType"
      ADD VALUE IF NOT EXISTS 'CHECKOUT_HELP_REMINDER';
    ALTER TYPE "AutomationType"
      ADD VALUE IF NOT EXISTS 'ANY_QUESTIONS_REMINDER';
  END IF;
END
$$;