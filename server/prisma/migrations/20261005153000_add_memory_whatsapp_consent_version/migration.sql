-- Add versioned consent metadata for Memory assessment WhatsApp opt-in.
ALTER TABLE "MemoryAssessmentSession"
ADD COLUMN "whatsappConsentVersion" VARCHAR(80);
