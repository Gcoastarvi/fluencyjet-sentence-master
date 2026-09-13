ALTER TYPE "AutomationType" ADD VALUE IF NOT EXISTS 'WHATSAPP_BROADCAST';

ALTER TABLE "AutomationEvent"
ADD COLUMN "campaignKey" VARCHAR(120);

CREATE UNIQUE INDEX "AutomationEvent_campaignKey_userId_key"
ON "AutomationEvent"("campaignKey", "userId");