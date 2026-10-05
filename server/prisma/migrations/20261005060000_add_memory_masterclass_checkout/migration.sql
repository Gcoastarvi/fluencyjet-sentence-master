-- CreateTable
CREATE TABLE "MemoryMasterclassCheckoutIntent" (
    "id" TEXT NOT NULL,
    "memoryAssessmentSessionId" TEXT NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 9900,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "productKey" VARCHAR(80) NOT NULL DEFAULT 'memory_masterclass_99',
    "eventKey" VARCHAR(100) NOT NULL,
    "eventStartsAt" TIMESTAMP(3) NOT NULL,
    "eventEndsAt" TIMESTAMP(3) NOT NULL,
    "eventTimezone" VARCHAR(80) NOT NULL DEFAULT 'Asia/Kolkata',
    "trackId" VARCHAR(50) NOT NULL,
    "visitorId" VARCHAR(191),
    "fbclid" TEXT,
    "fbc" TEXT,
    "fbp" TEXT,
    "utmSource" VARCHAR(150),
    "utmMedium" VARCHAR(150),
    "utmCampaign" VARCHAR(200),
    "utmContent" VARCHAR(200),
    "utmTerm" VARCHAR(200),
    "source" VARCHAR(150),
    "landingPage" TEXT,
    "clientIp" VARCHAR(100),
    "clientUserAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryMasterclassCheckoutIntent_pkey"
    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryMasterclassPurchase" (
    "id" TEXT NOT NULL,
    "checkoutIntentId" TEXT NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "productKey" VARCHAR(80) NOT NULL DEFAULT 'memory_masterclass_99',
    "status" VARCHAR(40) NOT NULL,
    "customerEmail" VARCHAR(191),
    "customerContact" VARCHAR(40),
    "webhookEventId" VARCHAR(191),
    "metaEventId" VARCHAR(191),
    "metaDelivered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryMasterclassPurchase_pkey"
    PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemoryMasterclassCheckoutIntent_razorpayOrderId_key"
ON "MemoryMasterclassCheckoutIntent"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "MemoryMasterclassCheckoutIntent_memoryAssessmentSessionId_idx"
ON "MemoryMasterclassCheckoutIntent"("memoryAssessmentSessionId");

-- CreateIndex
CREATE INDEX "MemoryMasterclassCheckoutIntent_eventKey_idx"
ON "MemoryMasterclassCheckoutIntent"("eventKey");

-- CreateIndex
CREATE INDEX "MemoryMasterclassCheckoutIntent_createdAt_idx"
ON "MemoryMasterclassCheckoutIntent"("createdAt");

-- CreateIndex
CREATE INDEX "MemoryMasterclassCheckoutIntent_utmCampaign_idx"
ON "MemoryMasterclassCheckoutIntent"("utmCampaign");

-- CreateIndex
CREATE INDEX "MemoryMasterclassCheckoutIntent_fbclid_idx"
ON "MemoryMasterclassCheckoutIntent"("fbclid");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryMasterclassPurchase_checkoutIntentId_key"
ON "MemoryMasterclassPurchase"("checkoutIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryMasterclassPurchase_razorpayOrderId_key"
ON "MemoryMasterclassPurchase"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryMasterclassPurchase_paymentId_key"
ON "MemoryMasterclassPurchase"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryMasterclassPurchase_webhookEventId_key"
ON "MemoryMasterclassPurchase"("webhookEventId");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryMasterclassPurchase_metaEventId_key"
ON "MemoryMasterclassPurchase"("metaEventId");

-- CreateIndex
CREATE INDEX "MemoryMasterclassPurchase_createdAt_idx"
ON "MemoryMasterclassPurchase"("createdAt");

-- CreateIndex
CREATE INDEX "MemoryMasterclassPurchase_paymentId_idx"
ON "MemoryMasterclassPurchase"("paymentId");

-- AddForeignKey
ALTER TABLE "MemoryMasterclassCheckoutIntent"
ADD CONSTRAINT "MemoryMasterclassCheckoutIntent_memoryAssessmentSessionId_fkey"
FOREIGN KEY ("memoryAssessmentSessionId")
REFERENCES "MemoryAssessmentSession"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryMasterclassPurchase"
ADD CONSTRAINT "MemoryMasterclassPurchase_checkoutIntentId_fkey"
FOREIGN KEY ("checkoutIntentId")
REFERENCES "MemoryMasterclassCheckoutIntent"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
