-- Phase 4: claim state for controlled WhatsApp delivery.
-- Keep the enum addition separate from migrations that use the new enum value.

ALTER TYPE "AutomationStatus"
ADD VALUE IF NOT EXISTS 'SENDING';
