-- CreateTable
CREATE TABLE "Cohort" (
    "id" TEXT NOT NULL,
    "programVersionId" TEXT NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSession" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "learningDayId" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "appUnlockAt" TIMESTAMPTZ(3) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cohort_key_key"
ON "Cohort"("key");

-- CreateIndex
CREATE INDEX "Cohort_programVersionId_idx"
ON "Cohort"("programVersionId");

-- CreateIndex
CREATE INDEX "LiveSession_cohortId_startsAt_idx"
ON "LiveSession"("cohortId", "startsAt");

-- CreateIndex
CREATE INDEX "LiveSession_learningDayId_idx"
ON "LiveSession"("learningDayId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSession_cohortId_learningDayId_key"
ON "LiveSession"("cohortId", "learningDayId");

-- AddForeignKey
ALTER TABLE "Cohort"
ADD CONSTRAINT "Cohort_programVersionId_fkey"
FOREIGN KEY ("programVersionId") REFERENCES "ProgramVersion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession"
ADD CONSTRAINT "LiveSession_cohortId_fkey"
FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession"
ADD CONSTRAINT "LiveSession_learningDayId_fkey"
FOREIGN KEY ("learningDayId") REFERENCES "LearningDay"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
