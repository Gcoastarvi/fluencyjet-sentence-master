-- Safe product-led funnel fields only
-- This migration only adds new optional/default columns to the existing User table.

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "activation_completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "ad" VARCHAR(200),
ADD COLUMN IF NOT EXISTS "adset" VARCHAR(200),
ADD COLUMN IF NOT EXISTS "campaign" VARCHAR(200),
ADD COLUMN IF NOT EXISTS "current_status" VARCHAR(80),
ADD COLUMN IF NOT EXISTS "last_demo_video_viewed_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "level_check_completed_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "level_check_result" TEXT,
ADD COLUMN IF NOT EXISTS "level_check_score" INTEGER,
ADD COLUMN IF NOT EXISTS "main_goal" VARCHAR(120),
ADD COLUMN IF NOT EXISTS "practice_commitment" VARCHAR(120),
ADD COLUMN IF NOT EXISTS "source" VARCHAR(150),
ADD COLUMN IF NOT EXISTS "utm_campaign" VARCHAR(200),
ADD COLUMN IF NOT EXISTS "utm_content" VARCHAR(200),
ADD COLUMN IF NOT EXISTS "utm_medium" VARCHAR(150),
ADD COLUMN IF NOT EXISTS "utm_source" VARCHAR(150),
ADD COLUMN IF NOT EXISTS "utm_term" VARCHAR(200),
ADD COLUMN IF NOT EXISTS "webinar_registered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "webinar_registered_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "whatsapp_number" VARCHAR(30);
