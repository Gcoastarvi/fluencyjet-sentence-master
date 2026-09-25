-- CreateTable
CREATE TABLE "MemoryAssessmentSession" (
    "id" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "ownerToken" TEXT NOT NULL,
    "trackId" VARCHAR(50) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'FORM_A_COMPLETED',
    "formAAnswers" JSONB NOT NULL,
    "formAResult" JSONB NOT NULL,
    "formAScore" DECIMAL(5,2) NOT NULL,
    "formARetentionRatio" DECIMAL(6,3),
    "formACompletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "learnerName" VARCHAR(100),
    "studentClass" VARCHAR(30),
    "studyCategory" VARCHAR(100),
    "parentGuardianName" VARCHAR(100),
    "whatsappNumber" VARCHAR(30),
    "whatsappNumberNormalized" VARCHAR(20),
    "whatsappContactRole" VARCHAR(40),
    "whatsappConsent" BOOLEAN NOT NULL DEFAULT false,
    "whatsappConsentAt" TIMESTAMP(3),
    "whatsappConsentSource" VARCHAR(150),
    "email" VARCHAR(191),
    "state" VARCHAR(100),
    "leadCapturedAt" TIMESTAMP(3),
    "formBAnswers" JSONB,
    "formBResult" JSONB,
    "formBScore" DECIMAL(5,2),
    "formBRetentionRatio" DECIMAL(6,3),
    "formBCompletedAt" TIMESTAMP(3),
    "utmSource" VARCHAR(150),
    "utmMedium" VARCHAR(150),
    "utmCampaign" VARCHAR(200),
    "utmContent" VARCHAR(200),
    "utmTerm" VARCHAR(200),
    "source" VARCHAR(150),
    "campaign" VARCHAR(200),
    "adset" VARCHAR(200),
    "ad" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryAssessmentSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemoryAssessmentSession_publicToken_key" ON "MemoryAssessmentSession"("publicToken");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryAssessmentSession_ownerToken_key" ON "MemoryAssessmentSession"("ownerToken");

-- CreateIndex
CREATE INDEX "MemoryAssessmentSession_whatsappNumberNormalized_idx" ON "MemoryAssessmentSession"("whatsappNumberNormalized");

-- CreateIndex
CREATE INDEX "MemoryAssessmentSession_trackId_createdAt_idx" ON "MemoryAssessmentSession"("trackId", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryAssessmentSession_createdAt_idx" ON "MemoryAssessmentSession"("createdAt");
