-- AlterTable
ALTER TABLE "SpokenEnglishPurchase"
ADD COLUMN "razorpayOrderId" TEXT,
ADD COLUMN "vocabularyCheckoutIntentId" TEXT;

-- CreateTable
CREATE TABLE "VocabularyCheckoutIntent" (
    "id" TEXT NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 79900,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "productKey" VARCHAR(80) NOT NULL DEFAULT 'vocabulary_challenge_799',
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

    CONSTRAINT "VocabularyCheckoutIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SpokenEnglishPurchase_razorpayOrderId_key"
ON "SpokenEnglishPurchase"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "SpokenEnglishPurchase_vocabularyCheckoutIntentId_key"
ON "SpokenEnglishPurchase"("vocabularyCheckoutIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "VocabularyCheckoutIntent_razorpayOrderId_key"
ON "VocabularyCheckoutIntent"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "VocabularyCheckoutIntent_createdAt_idx"
ON "VocabularyCheckoutIntent"("createdAt");

-- CreateIndex
CREATE INDEX "VocabularyCheckoutIntent_utmCampaign_idx"
ON "VocabularyCheckoutIntent"("utmCampaign");

-- CreateIndex
CREATE INDEX "VocabularyCheckoutIntent_utmContent_idx"
ON "VocabularyCheckoutIntent"("utmContent");

-- CreateIndex
CREATE INDEX "VocabularyCheckoutIntent_fbclid_idx"
ON "VocabularyCheckoutIntent"("fbclid");

-- AddForeignKey
ALTER TABLE "SpokenEnglishPurchase"
ADD CONSTRAINT "SpokenEnglishPurchase_vocabularyCheckoutIntentId_fkey"
FOREIGN KEY ("vocabularyCheckoutIntentId")
REFERENCES "VocabularyCheckoutIntent"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
