-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('beginner', 'intermediate', 'advanced');

-- CreateEnum
CREATE TYPE "TierLevel" AS ENUM ('free', 'basic', 'pro');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('quiz', 'streak', 'bonus', 'admin', 'QUESTION_CORRECT', 'QUIZ_COMPLETED', 'LESSON_COMPLETED', 'DAILY_STREAK', 'BADGE_UNLOCK', 'ADMIN_ADJUST', 'GENERIC');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password" TEXT NOT NULL,
    "username" VARCHAR(32),
    "avatar_url" TEXT,
    "has_access" BOOLEAN NOT NULL DEFAULT false,
    "tier_level" "TierLevel" NOT NULL DEFAULT 'free',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'beginner',
    "is_locked" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpEvent" (
    "id" BIGSERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "event_type" "EventType" NOT NULL,
    "xp_delta" INTEGER NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" BIGSERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "badge_id" INTEGER NOT NULL,
    "awarded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWeeklyTotals" (
    "user_id" INTEGER NOT NULL,
    "week_key" TIMESTAMP(3) NOT NULL,
    "week_xp" INTEGER NOT NULL DEFAULT 0,
    "month_key" TIMESTAMP(3) NOT NULL,
    "month_xp" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserWeeklyTotals_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "UserProgress" (
    "user_id" INTEGER NOT NULL,
    "total_xp" INTEGER NOT NULL DEFAULT 0,
    "last_activity" TIMESTAMP(3),
    "week_key" TIMESTAMPTZ(6) NOT NULL DEFAULT date_trunc('week'::text, (now() AT TIME ZONE 'utc'::text)),
    "month_key" TIMESTAMPTZ(6) NOT NULL DEFAULT date_trunc('month'::text, (now() AT TIME ZONE 'utc'::text)),
    "week_xp" INTEGER NOT NULL DEFAULT 0,
    "month_xp" INTEGER NOT NULL DEFAULT 0,
    "lifetime_xp" INTEGER NOT NULL DEFAULT 0,
    "badges_awarded" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserProgress_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_created_at_idx" ON "User"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_slug_key" ON "Lesson"("slug");

-- CreateIndex
CREATE INDEX "Lesson_difficulty_idx" ON "Lesson"("difficulty");

-- CreateIndex
CREATE INDEX "Lesson_is_locked_idx" ON "Lesson"("is_locked");

-- CreateIndex
CREATE INDEX "XpEvent_user_id_created_at_idx" ON "XpEvent"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "XpEvent_created_at_idx" ON "XpEvent"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_code_key" ON "Badge"("code");

-- CreateIndex
CREATE INDEX "Badge_threshold_idx" ON "Badge"("threshold");

-- CreateIndex
CREATE INDEX "UserBadge_awarded_at_idx" ON "UserBadge"("awarded_at");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_user_id_badge_id_key" ON "UserBadge"("user_id", "badge_id");

-- CreateIndex
CREATE INDEX "UserWeeklyTotals_week_xp_idx" ON "UserWeeklyTotals"("week_xp");

-- CreateIndex
CREATE INDEX "UserWeeklyTotals_month_xp_idx" ON "UserWeeklyTotals"("month_xp");

-- CreateIndex
CREATE INDEX "UserProgress_total_xp_idx" ON "UserProgress"("total_xp");

-- CreateIndex
CREATE INDEX "UserProgress_week_key_idx" ON "UserProgress"("week_key");

-- CreateIndex
CREATE INDEX "UserProgress_month_key_idx" ON "UserProgress"("month_key");

-- AddForeignKey
ALTER TABLE "XpEvent" ADD CONSTRAINT "XpEvent_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWeeklyTotals" ADD CONSTRAINT "UserWeeklyTotals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

