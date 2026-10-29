-- Additive nullable audit only. No historical writes, seeds or replay.
ALTER TABLE "MemoryMasterclassCheckoutIntent" ADD COLUMN "purchaseAuthorization" JSONB;
