-- CreateTable
CREATE TABLE "MemoryRetestAccessGrant" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "assessmentSessionId" TEXT NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "linkExpiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "sessionTokenHash" VARCHAR(64),
    "sessionExpiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryRetestAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemoryRetestAccessGrant_tokenHash_key" ON "MemoryRetestAccessGrant"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryRetestAccessGrant_sessionTokenHash_key" ON "MemoryRetestAccessGrant"("sessionTokenHash");

-- CreateIndex
CREATE INDEX "MemoryRetestAccessGrant_purchaseId_createdAt_idx" ON "MemoryRetestAccessGrant"("purchaseId", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryRetestAccessGrant_assessmentSessionId_idx" ON "MemoryRetestAccessGrant"("assessmentSessionId");

-- CreateIndex
CREATE INDEX "MemoryRetestAccessGrant_linkExpiresAt_idx" ON "MemoryRetestAccessGrant"("linkExpiresAt");

-- AddForeignKey
ALTER TABLE "MemoryRetestAccessGrant" ADD CONSTRAINT "MemoryRetestAccessGrant_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "MemoryMasterclassPurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryRetestAccessGrant" ADD CONSTRAINT "MemoryRetestAccessGrant_assessmentSessionId_fkey" FOREIGN KEY ("assessmentSessionId") REFERENCES "MemoryAssessmentSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
