-- Phase 7: canonical WhatsApp identity.
--
-- Raw whatsapp_number is retained for audit/display.
-- whatsapp_number_normalized is nullable and intentionally NOT unique,
-- because multiple User rows may legitimately/ historically share one
-- WhatsApp destination.

ALTER TABLE "User"
ADD COLUMN "whatsapp_number_normalized" VARCHAR(20);

-- Deterministic backfill only.
--
-- Supported:
--   9876543210       -> +919876543210
--   919876543210     -> +919876543210
--   +91 98765 43210  -> +919876543210
--   explicit + international E.164-style numbers -> +<digits>
--
-- Ambiguous / malformed legacy values remain NULL.

UPDATE "User"
SET "whatsapp_number_normalized" =
  CASE
    WHEN BTRIM("whatsapp_number") LIKE '+%'
         AND REGEXP_REPLACE("whatsapp_number", '[^0-9]', '', 'g') ~ '^[0-9]{8,15}$'
      THEN '+' || REGEXP_REPLACE("whatsapp_number", '[^0-9]', '', 'g')

    WHEN REGEXP_REPLACE("whatsapp_number", '[^0-9]', '', 'g') ~ '^91[0-9]{10}$'
      THEN '+' || REGEXP_REPLACE("whatsapp_number", '[^0-9]', '', 'g')

    WHEN REGEXP_REPLACE("whatsapp_number", '[^0-9]', '', 'g') ~ '^[0-9]{10}$'
      THEN '+91' || REGEXP_REPLACE("whatsapp_number", '[^0-9]', '', 'g')

    ELSE NULL
  END
WHERE "whatsapp_number" IS NOT NULL;

CREATE INDEX "User_whatsapp_number_normalized_idx"
ON "User"("whatsapp_number_normalized");
