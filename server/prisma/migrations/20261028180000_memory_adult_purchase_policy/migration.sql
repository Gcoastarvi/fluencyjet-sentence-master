-- Additive only. Generated from the exact PR #7 prior and proposed schemas.
-- No historical purchases/consents are updated or requeued.
-- AlterTable
ALTER TABLE "MemoryMasterclassCheckoutIntent" ADD COLUMN     "purchaseMeasurement" JSONB;

-- CreateTable
CREATE TABLE "MemoryAdultPurchasePolicy" (
    "id" VARCHAR(80) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "scope" VARCHAR(80) NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "reviewDueAt" TIMESTAMP(3) NOT NULL,
    "legalApprovalRef" VARCHAR(200) NOT NULL,
    "metaApprovalRef" VARCHAR(200) NOT NULL,
    "adultEvidenceApprovalRef" VARCHAR(200) NOT NULL,
    "authorizationSource" VARCHAR(200) NOT NULL,
    "noticeVersion" VARCHAR(80) NOT NULL,
    "noticeHash" VARCHAR(64) NOT NULL,
    "restrictionsCleared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryAdultPurchasePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryAdultPurchaseAuthorization" (
    "id" TEXT NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "emailHash" VARCHAR(64) NOT NULL,
    "phoneHash" VARCHAR(64) NOT NULL,
    "adultConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "policyId" VARCHAR(80),
    "decision" VARCHAR(40) NOT NULL,
    "evidence" JSONB NOT NULL,
    "browserConsentId" TEXT,
    "browserConsentRevision" INTEGER,
    "blockedAt" TIMESTAMP(3),
    "blockReason" VARCHAR(80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryAdultPurchaseAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemoryAdultPurchaseAuthorization_tokenHash_key" ON "MemoryAdultPurchaseAuthorization"("tokenHash");

-- CreateIndex
CREATE INDEX "MemoryAdultPurchaseAuthorization_emailHash_blockedAt_idx" ON "MemoryAdultPurchaseAuthorization"("emailHash", "blockedAt");

-- CreateIndex
CREATE INDEX "MemoryAdultPurchaseAuthorization_phoneHash_blockedAt_idx" ON "MemoryAdultPurchaseAuthorization"("phoneHash", "blockedAt");

-- AddForeignKey
ALTER TABLE "MemoryAdultPurchaseAuthorization" ADD CONSTRAINT "MemoryAdultPurchaseAuthorization_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "MemoryAdultPurchasePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- No policy row is seeded. Both configuration and an approved enabled policy
-- record are required; applying this schema cannot activate sharing.
