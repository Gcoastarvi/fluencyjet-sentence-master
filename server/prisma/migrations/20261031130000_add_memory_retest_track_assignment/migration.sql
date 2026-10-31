-- Store the school assessment track selected after a Parents checkout.
-- Preserve the original purchaser and checkout-intent snapshots.

CREATE TABLE "MemoryRetestTrackAssignment" (
  "purchaseId" TEXT NOT NULL,
  "trackId" VARCHAR(50) NOT NULL,
  "assignedByAdminId" INTEGER NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MemoryRetestTrackAssignment_pkey"
    PRIMARY KEY ("purchaseId"),

  CONSTRAINT "MemoryRetestTrackAssignment_trackId_check"
    CHECK ("trackId" IN ('school_foundation', 'school_advanced'))
);

CREATE INDEX "MemoryRetestTrackAssignment_assignedByAdminId_assignedAt_idx"
  ON "MemoryRetestTrackAssignment"("assignedByAdminId", "assignedAt");

ALTER TABLE "MemoryRetestTrackAssignment"
  ADD CONSTRAINT "MemoryRetestTrackAssignment_purchaseId_fkey"
  FOREIGN KEY ("purchaseId")
  REFERENCES "MemoryMasterclassPurchase"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MemoryRetestTrackAssignment"
  ADD CONSTRAINT "MemoryRetestTrackAssignment_assignedByAdminId_fkey"
  FOREIGN KEY ("assignedByAdminId")
  REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
