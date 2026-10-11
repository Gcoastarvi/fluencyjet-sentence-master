import crypto from "node:crypto";
import prisma from "../db/client.js";

export const MEMORY_META_CONSENT_VERSION = "memory_meta_v1";
export const MEMORY_META_CONSENT_SOURCE = "memory_funnel_adult_opt_in";
export const MEMORY_META_CONSENT_DAYS = 30;
const receiptHash = value => crypto.createHash("sha256").update(value).digest("hex");
const validReceipt = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

export async function consentRecord(receipt, db = prisma) {
  if (!validReceipt(receipt)) return null;
  return db.memoryMetaConsent.findUnique({ where: { tokenHash: receiptHash(receipt) } });
}

export function consentActive(record, now = new Date()) {
  return Boolean(record?.granted && record.adultConfirmed &&
    record.version === MEMORY_META_CONSENT_VERSION &&
    new Date(record.expiresAt) > now && !record.revokedAt);
}

export async function recordMemoryConsent({ receipt, granted, adultConfirmed }, db = prisma) {
  if (typeof granted !== "boolean" || (granted && adultConfirmed !== true)) {
    throw new Error("CONSENT_INVALID");
  }
  const now = new Date();
  const existing = await consentRecord(receipt, db);
  // Never let a supplied unknown token create or change somebody else's choice.
  if (receipt && !existing) throw new Error("CONSENT_RECEIPT_INVALID");
  if (existing && existing.granted === granted && existing.version === MEMORY_META_CONSENT_VERSION &&
      new Date(existing.expiresAt) > now) {
    return { receipt, granted: consentActive(existing), version: existing.version, expiresAt: existing.expiresAt };
  }
  const token = receipt || crypto.randomBytes(32).toString("hex");
  const data = {
    granted, adultConfirmed: granted && adultConfirmed === true,
    version: MEMORY_META_CONSENT_VERSION, source: MEMORY_META_CONSENT_SOURCE,
    recordedAt: now, revokedAt: granted ? null : now,
    expiresAt: new Date(now.getTime() + MEMORY_META_CONSENT_DAYS * 86400000),
    revision: existing ? existing.revision + 1 : 1,
  };
  const record = existing
    ? await db.memoryMetaConsent.update({ where: { id: existing.id, revision: existing.revision }, data })
    : await db.memoryMetaConsent.create({ data: { ...data, tokenHash: receiptHash(token) } });
  return { receipt: token, granted: consentActive(record), version: record.version,
    expiresAt: record.expiresAt };
}

export async function memoryConsentSnapshot(receipt, db = prisma) {
  let record = null;
  try { record = await consentRecord(receipt, db); } catch {
    console.warn("[memory-meta] Consent unavailable; measurement denied");
  }
  return {
    metaConsentId: record?.id ?? null,
    metaConsentGranted: consentActive(record),
    metaConsentAt: record?.recordedAt ?? null,
    metaConsentVersion: record?.version ?? null,
    metaConsentSource: record?.source ?? null,
    metaConsentRevision: record?.revision ?? null,
  };
}

export async function purchaseConsentActive(purchase, db = prisma) {
  if (purchase.metaConsentGranted !== true || !purchase.metaConsentId ||
      purchase.metaConsentVersion !== MEMORY_META_CONSENT_VERSION) return false;
  const record = await db.memoryMetaConsent.findUnique({
    where: { id: purchase.metaConsentId },
  });
  return consentActive(record) && record.revision === purchase.metaConsentRevision;
}
