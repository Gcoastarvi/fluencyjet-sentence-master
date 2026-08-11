-- Safe WhatsApp consent fields
-- Adds new optional/default columns to the existing User table only.

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "whatsapp_consent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "whatsapp_consent_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "whatsapp_consent_source" VARCHAR(150);
