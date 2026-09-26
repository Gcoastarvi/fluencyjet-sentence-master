-- CreateTable
CREATE TABLE "Offering" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "productKey" VARCHAR(120) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "pricePaise" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "startDayNumber" INTEGER NOT NULL,
    "endDayNumber" INTEGER NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "programVersionId" TEXT NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntitlementGrant" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "offeringId" TEXT,
    "startDayNumber" INTEGER NOT NULL,
    "endDayNumber" INTEGER NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "source" VARCHAR(40) NOT NULL,
    "sourceRef" VARCHAR(191),
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntitlementGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortEnrollment" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "source" VARCHAR(40) NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Offering_productKey_key"
ON "Offering"("productKey");

-- CreateIndex
CREATE INDEX "Offering_programId_status_idx"
ON "Offering"("programId", "status");

-- CreateIndex
CREATE INDEX "Enrollment_programVersionId_status_idx"
ON "Enrollment"("programVersionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_userId_programVersionId_key"
ON "Enrollment"("userId", "programVersionId");

-- CreateIndex
CREATE INDEX "EntitlementGrant_enrollmentId_status_idx"
ON "EntitlementGrant"("enrollmentId", "status");

-- CreateIndex
CREATE INDEX "EntitlementGrant_offeringId_idx"
ON "EntitlementGrant"("offeringId");

-- CreateIndex
CREATE UNIQUE INDEX "EntitlementGrant_source_sourceRef_key"
ON "EntitlementGrant"("source", "sourceRef");

-- CreateIndex
CREATE INDEX "CohortEnrollment_enrollmentId_status_idx"
ON "CohortEnrollment"("enrollmentId", "status");

-- CreateIndex
CREATE INDEX "CohortEnrollment_cohortId_status_idx"
ON "CohortEnrollment"("cohortId", "status");

-- AddForeignKey
ALTER TABLE "Offering"
ADD CONSTRAINT "Offering_programId_fkey"
FOREIGN KEY ("programId") REFERENCES "Program"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment"
ADD CONSTRAINT "Enrollment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment"
ADD CONSTRAINT "Enrollment_programVersionId_fkey"
FOREIGN KEY ("programVersionId") REFERENCES "ProgramVersion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementGrant"
ADD CONSTRAINT "EntitlementGrant_enrollmentId_fkey"
FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementGrant"
ADD CONSTRAINT "EntitlementGrant_offeringId_fkey"
FOREIGN KEY ("offeringId") REFERENCES "Offering"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortEnrollment"
ADD CONSTRAINT "CohortEnrollment_enrollmentId_fkey"
FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortEnrollment"
ADD CONSTRAINT "CohortEnrollment_cohortId_fkey"
FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
