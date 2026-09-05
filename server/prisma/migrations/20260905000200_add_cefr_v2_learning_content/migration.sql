-- CreateTable
CREATE TABLE "LearningDay" (
    "id" TEXT NOT NULL,
    "programVersionId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "learningDayId" TEXT NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "activityType" VARCHAR(40) NOT NULL,
    "evaluationMode" VARCHAR(40) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "config" JSONB,
    "xpConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityItem" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "itemKey" VARCHAR(100) NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "prompt" JSONB NOT NULL,
    "payload" JSONB,
    "answerKey" JSONB,
    "hint" JSONB,
    "feedback" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearningDay_programVersionId_idx"
ON "LearningDay"("programVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningDay_programVersionId_dayNumber_key"
ON "LearningDay"("programVersionId", "dayNumber");

-- CreateIndex
CREATE INDEX "Activity_learningDayId_activityType_idx"
ON "Activity"("learningDayId", "activityType");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_learningDayId_key_key"
ON "Activity"("learningDayId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_learningDayId_orderIndex_key"
ON "Activity"("learningDayId", "orderIndex");

-- CreateIndex
CREATE INDEX "ActivityItem_activityId_idx"
ON "ActivityItem"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityItem_activityId_itemKey_key"
ON "ActivityItem"("activityId", "itemKey");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityItem_activityId_orderIndex_key"
ON "ActivityItem"("activityId", "orderIndex");

-- AddForeignKey
ALTER TABLE "LearningDay"
ADD CONSTRAINT "LearningDay_programVersionId_fkey"
FOREIGN KEY ("programVersionId") REFERENCES "ProgramVersion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity"
ADD CONSTRAINT "Activity_learningDayId_fkey"
FOREIGN KEY ("learningDayId") REFERENCES "LearningDay"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityItem"
ADD CONSTRAINT "ActivityItem_activityId_fkey"
FOREIGN KEY ("activityId") REFERENCES "Activity"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
