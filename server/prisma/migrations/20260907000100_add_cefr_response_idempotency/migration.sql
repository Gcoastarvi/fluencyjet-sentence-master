-- AlterTable
ALTER TABLE "Response"
ADD COLUMN "idempotencyKey" VARCHAR(128);

-- CreateIndex
CREATE UNIQUE INDEX "Response_attemptId_activityItemId_idempotencyKey_key"
ON "Response"("attemptId", "activityItemId", "idempotencyKey");
