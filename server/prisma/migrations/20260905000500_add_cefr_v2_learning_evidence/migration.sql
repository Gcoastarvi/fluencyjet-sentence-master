-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Response" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "activityItemId" TEXT NOT NULL,
    "responseNumber" INTEGER NOT NULL,
    "submittedAnswer" JSONB NOT NULL,
    "isCorrect" BOOLEAN,
    "evaluationCode" VARCHAR(50),
    "score" DOUBLE PRECISION,
    "hintUsed" BOOLEAN NOT NULL DEFAULT false,
    "answerRevealed" BOOLEAN NOT NULL DEFAULT false,
    "responseTimeMs" INTEGER,
    "evaluationDetails" JSONB,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpLedger" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "activityId" TEXT,
    "attemptId" TEXT,
    "responseId" TEXT,
    "amount" INTEGER NOT NULL,
    "eventType" VARCHAR(60) NOT NULL,
    "ruleVersion" VARCHAR(40),
    "idempotencyKey" VARCHAR(191) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attempt_enrollmentId_activityId_idx" ON "Attempt"("enrollmentId", "activityId");

-- CreateIndex
CREATE INDEX "Attempt_activityId_idx" ON "Attempt"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_enrollmentId_activityId_attemptNumber_key" ON "Attempt"("enrollmentId", "activityId", "attemptNumber");

-- CreateIndex
CREATE INDEX "Response_attemptId_idx" ON "Response"("attemptId");

-- CreateIndex
CREATE INDEX "Response_activityItemId_idx" ON "Response"("activityItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Response_attemptId_activityItemId_responseNumber_key" ON "Response"("attemptId", "activityItemId", "responseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "XpLedger_idempotencyKey_key" ON "XpLedger"("idempotencyKey");

-- CreateIndex
CREATE INDEX "XpLedger_enrollmentId_createdAt_idx" ON "XpLedger"("enrollmentId", "createdAt");

-- CreateIndex
CREATE INDEX "XpLedger_userId_createdAt_idx" ON "XpLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "XpLedger_activityId_idx" ON "XpLedger"("activityId");

-- CreateIndex
CREATE INDEX "XpLedger_attemptId_idx" ON "XpLedger"("attemptId");

-- CreateIndex
CREATE INDEX "XpLedger_responseId_idx" ON "XpLedger"("responseId");

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_activityItemId_fkey" FOREIGN KEY ("activityItemId") REFERENCES "ActivityItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpLedger" ADD CONSTRAINT "XpLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpLedger" ADD CONSTRAINT "XpLedger_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpLedger" ADD CONSTRAINT "XpLedger_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpLedger" ADD CONSTRAINT "XpLedger_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpLedger" ADD CONSTRAINT "XpLedger_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

