import crypto from "node:crypto";
import prisma from "../db/client.js";
import { MEMORY_PURCHASE_RULE_VERSION, evaluateApprovedMemoryPurchaseRule } from "./memoryPurchaseRule.js";

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

// Existing receipt/checkout refusal checks; no permissions or history rewritten.
async function buyerRefused(purchaser, db) {
  if (!purchaser?.purchaserEmail || !purchaser?.purchaserPhone) return false;
  const prior = await db.memoryMasterclassCheckoutIntent.findMany({ where: {
    OR: [{ purchaserEmail: purchaser.purchaserEmail.trim().toLowerCase() }, { purchaserPhone: purchaser.purchaserPhone }],
    metaConsentId: { not: null },
  }, select: { metaConsentId: true } });
  const ids = [...new Set(prior.map(x => x.metaConsentId).filter(Boolean))];
  if (!ids.length) return false;
  return Boolean(await db.memoryMetaConsent.findFirst({ where: { id: { in: ids },
    OR: [{ granted: false }, { revokedAt: { not: null } }],
  }, select: { id: true } }));
}

export async function memoryPurchaseConsentSnapshot(body, purchaser, {
  db = prisma, gpc = false, env = process.env,
} = {}) {
  let snapshot = await memoryConsentSnapshot(body.memoryMetaConsentReceipt, db);
  if (body.memoryMetaChoiceReceipt) {
    const choice = await memoryConsentSnapshot(body.memoryMetaChoiceReceipt, db);
    if (!choice.metaConsentGranted) snapshot = choice;
  }
  if (gpc || body.measurementRefused === true || body.adultParentOwnContactIndia === false ||
      env.MEMORY_META_PURCHASE_SHARING_BLOCKED === "true" || await buyerRefused(purchaser, db))
    snapshot = { ...snapshot, metaConsentGranted: false };
  return snapshot;
}

export async function purchaseConsentActive(purchase, db = prisma, now = new Date(), env = process.env) {
  if (env.MEMORY_META_PURCHASE_SHARING_BLOCKED === "true") return false;
  if (purchase.metaConsentGranted !== true || !purchase.metaConsentId ||
      purchase.metaConsentVersion !== MEMORY_META_CONSENT_VERSION) return false;
  const record = await db.memoryMetaConsent.findUnique({
    where: { id: purchase.metaConsentId },
  });
  return consentActive(record, now) && record.revision === purchase.metaConsentRevision && !await buyerRefused(purchase, db);
}


// Separate from browser consent. No config value can implement the missing rule.
export const MEMORY_PURCHASE_POLICY_DEADLINE = new Date("2027-05-13T00:00:00+05:30");
export const MEMORY_PURCHASE_NOTICE = "Where authorized, we share limited adult purchase details with Meta to measure ads. You can decline or withdraw through Privacy choices. Booking works without measurement.";
export const MEMORY_PURCHASE_NOTICE_HASH = receiptHash(MEMORY_PURCHASE_NOTICE);
const requiredPolicyFields = ["version", "ruleVersion", "authorizationSource", "legalApprovalRef",
  "metaTermsReviewRef", "noticeApprovalRef", "childExclusionApprovalRef", "effectiveAt", "expiresAt", "reviewDueAt"];
function currentPurchasePolicy(env, now) {
  if (env.MEMORY_META_ADULT_PURCHASE_ENABLED !== "true" ||
      env.MEMORY_META_PURCHASE_SHARING_BLOCKED === "true" || now >= MEMORY_PURCHASE_POLICY_DEADLINE ||
      MEMORY_PURCHASE_RULE_VERSION === "UNIMPLEMENTED") return null;
  let p; try { p = JSON.parse(env.MEMORY_META_ADULT_PURCHASE_POLICY_JSON || "null"); } catch { return null; }
  if (!p || requiredPolicyFields.some(k => typeof p[k] !== "string" || !p[k].trim() || p[k].length > 200) ||
      p.ruleVersion !== MEMORY_PURCHASE_RULE_VERSION || p.noticeHash !== MEMORY_PURCHASE_NOTICE_HASH ||
      !(new Date(p.effectiveAt) <= now && now < new Date(p.expiresAt) && now < new Date(p.reviewDueAt)) ||
      new Date(p.expiresAt) > MEMORY_PURCHASE_POLICY_DEADLINE || new Date(p.reviewDueAt) >= MEMORY_PURCHASE_POLICY_DEADLINE)
    return null;
  return Object.fromEntries([...requiredPolicyFields, "noticeHash"].map(k => [k,p[k]]));
}
function purchaseKey(intent) {
  return receiptHash(JSON.stringify([intent.razorpayOrderId, intent.productKey, intent.amount, intent.currency,
    String(intent.purchaserEmail || "").trim().toLowerCase(), String(intent.purchaserPhone || "").replace(/\D/g, "")]));
}
function ruleContext(intent) {
  // Never expose browser/assessment data to the policy resolver or transport.
  return { razorpayOrderId: intent.razorpayOrderId, productKey: intent.productKey,
    amount: intent.amount, currency: intent.currency, purchaserEmail: intent.purchaserEmail,
    purchaserPhone: intent.purchaserPhone };
}
function ruleApproved(result) {
  return result?.eligible === true && result.adultPurchaserEstablished === true &&
    result.ownPurchaserContacts === true && result.childrenExcluded === true &&
    result.refusalWithdrawalChecked === true && result.platformPermitted === true &&
    typeof result.authorizationEvidenceRef === "string" && Boolean(result.authorizationEvidenceRef.trim()) &&
    result.authorizationEvidenceRef.length <= 200;
}
async function purchaseBlocked(intent, db, env) {
  if (env.MEMORY_META_PURCHASE_SHARING_BLOCKED === "true" || intent.purchaseAuthorization?.blocked) return true;
  if (intent.metaConsentId) {
    const choice = await db.memoryMetaConsent.findUnique({ where: { id: intent.metaConsentId } });
    if (!choice || !choice.granted || choice.revokedAt || choice.adultConfirmed === false) return true;
  }
  return buyerRefused(intent, db);
}
export async function memoryPurchaseAuthorizationSnapshot(body, intent, {
  db = prisma, env = process.env, now = new Date(), gpc = false,
} = {}) {
  const snapshot = { version: 1, purchaseKey: purchaseKey(intent), recordedAt: now.toISOString(), blocked: gpc ||
    body.measurementRefused === true || body.adultParentOwnContactIndia === false, alternative: null };
  if (body.memoryMetaChoiceReceipt) {
    const choice = await consentRecord(body.memoryMetaChoiceReceipt, db);
    if (!choice || !choice.granted || choice.revokedAt || choice.adultConfirmed === false) snapshot.blocked = true;
  }
  // Only prospective standalone Parents orders; this scope alone NEVER proves age.
  if (await purchaseBlocked({ ...intent, purchaseAuthorization: snapshot }, db, env)) {
    snapshot.blocked = true; return snapshot;
  }
  const p = currentPurchasePolicy(env, now);
  if (!p) {
    snapshot.reason = env.MEMORY_META_ADULT_PURCHASE_ENABLED !== "true" ? "ALTERNATIVE_DISABLED" :
      MEMORY_PURCHASE_RULE_VERSION === "UNIMPLEMENTED" ? "APPROVED_RULE_NOT_IMPLEMENTED" : "POLICY_INACTIVE";
    return snapshot;
  }
  if (intent.memoryAssessmentSessionId || intent.trackId !== "school_unspecified" ||
      intent.productKey !== "memory_masterclass_99" || intent.amount !== 9900 || intent.currency !== "INR") return snapshot;
  const result = await evaluateApprovedMemoryPurchaseRule(ruleContext(intent), { now });
  if (ruleApproved(result)) snapshot.alternative = { ...p, authorizationEvidenceRef: result.authorizationEvidenceRef };
  return snapshot;
}
export async function memoryPurchaseEligibility(purchase, { db = prisma, env = process.env, now = new Date() } = {}) {
  const intent = purchase.checkoutIntent || purchase;
  if (await purchaseBlocked({ ...purchase, purchaseAuthorization: intent.purchaseAuthorization }, db, env))
    return { authorized: false, reason: "REFUSED_OR_RESTRICTED" };
  if (await purchaseConsentActive(purchase, db, now, env)) return { authorized: true, source: "adult_consent" };
  const a = intent.purchaseAuthorization, p = currentPurchasePolicy(env, now);
  if (!p && env.MEMORY_META_ADULT_PURCHASE_ENABLED === "true" && MEMORY_PURCHASE_RULE_VERSION === "UNIMPLEMENTED")
    return { authorized: false, reason: "APPROVED_RULE_NOT_IMPLEMENTED" };
  if (!p || !a?.alternative || a.purchaseKey !== purchaseKey(intent) ||
      purchase.purchaserEmail !== intent.purchaserEmail || purchase.purchaserPhone !== intent.purchaserPhone || intent.memoryAssessmentSessionId || intent.trackId !== "school_unspecified" ||
      !(new Date(a.recordedAt) >= new Date(p.effectiveAt)) || new Date(a.recordedAt) > now ||
      Object.entries(p).some(([k,v]) => a.alternative[k] !== v))
    return { authorized: false, reason: "AUTHORIZATION_MISSING" };
  const result = await evaluateApprovedMemoryPurchaseRule(ruleContext(intent), { now });
  return ruleApproved(result) && result.authorizationEvidenceRef === a.alternative.authorizationEvidenceRef
    ? { authorized: true, source: "approved_alternative", policyVersion: p.version }
    : { authorized: false, reason: "RULE_INELIGIBLE" };
}
