import crypto from "node:crypto";
import prisma from "../db/client.js";
import { consentRecord, purchaseConsentActive } from "./memoryMetaConsent.js";

export const ADULT_PURCHASE_NOTICE_VERSION = "memory_adult_purchase_v1";
export const ADULT_PURCHASE_NOTICE = "Where separately authorized, BrainoDad shares your own adult purchaser email and phone (hashed), confirmed purchase amount, currency and payment-based event ID with Meta for advertising measurement. Meta may also use this information for its own purposes, including advertising, under its Business Tools Terms. No student scores, answers or assessment identifiers are shared. Measurement is optional: use Measurement choices to decline or withdraw. Payment is not advertising consent. This purchase policy does not enable browser Pixel tracking.";
export const ADULT_PURCHASE_NOTICE_HASH = digest(ADULT_PURCHASE_NOTICE);
// Fail closed at 00:00 IST on May 13. No database date can extend this release.
export const ADULT_PURCHASE_DEADLINE = new Date("2027-05-13T00:00:00+05:30");
const TOKEN = /^[a-f0-9]{64}$/;
const SCOPE = "IN_ADULT_PARENT_SELF_ATTESTED";
function digest(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function contacts(purchaser) {
  const email = String(purchaser?.purchaserEmail || "").trim().toLowerCase();
  let phone = String(purchaser?.purchaserPhone || "").replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(phone)) phone = "91" + phone;
  if (!email.includes("@") || !/^\d{7,15}$/.test(phone)) return null;
  return { emailHash: digest(email), phoneHash: digest(phone) };
}
const subjectWhere = identity => ({ OR: [{ emailHash: identity.emailHash }, { phoneHash: identity.phoneHash }] });

export async function activeAdultPurchasePolicy({ db = prisma, env = process.env, now = new Date() } = {}) {
  if (env.MEMORY_META_ADULT_PURCHASE_ENABLED !== "true" ||
      env.MEMORY_META_PURCHASE_SHARING_BLOCKED === "true" ||
      !env.MEMORY_META_ADULT_PURCHASE_POLICY_ID || now >= ADULT_PURCHASE_DEADLINE) return null;
  const p = await db.memoryAdultPurchasePolicy.findUnique({ where: { id: env.MEMORY_META_ADULT_PURCHASE_POLICY_ID } });
  if (!p?.enabled || p.scope !== SCOPE || !p.restrictionsCleared ||
      !p.legalApprovalRef?.trim() || !p.metaApprovalRef?.trim() || !p.adultEvidenceApprovalRef?.trim() ||
      !p.authorizationSource?.trim() || p.noticeVersion !== ADULT_PURCHASE_NOTICE_VERSION ||
      p.noticeHash !== ADULT_PURCHASE_NOTICE_HASH ||
      !(new Date(p.effectiveAt) <= now && now < new Date(p.expiresAt) && now < new Date(p.reviewDueAt)) ||
      new Date(p.reviewDueAt) >= ADULT_PURCHASE_DEADLINE || new Date(p.expiresAt) > ADULT_PURCHASE_DEADLINE) return null;
  return p;
}

export async function adultPurchasePolicyPresentation(options = {}) {
  let p = null;
  try { p = await activeAdultPurchasePolicy(options); } catch { /* ordinary consent remains available */ }
  return { mode: p ? "alternative" : "consent", policyId: p?.id || null,
    noticeVersion: ADULT_PURCHASE_NOTICE_VERSION, noticeHash: ADULT_PURCHASE_NOTICE_HASH,
    notice: ADULT_PURCHASE_NOTICE, expiresAt: p ? new Date(Math.min(+new Date(p.expiresAt), +new Date(p.reviewDueAt), +ADULT_PURCHASE_DEADLINE)).toISOString() : null };
}

async function subjectRefused(identity, db, purchaser) {
  if (await db.memoryAdultPurchaseAuthorization.findFirst({ where: {
    ...subjectWhere(identity), blockedAt: { not: null },
  }, select: { id: true } })) return true;
  if (!purchaser?.purchaserEmail || !purchaser?.purchaserPhone) return false;
  // Read-only refusal lookup against existing buyer-linked receipt snapshots.
  // Historical purchases/statuses are NEVER changed or backfilled.
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

// Only this server endpoint creates evidence; callers cannot pass a policy snapshot.
// Adult/own-contact/India is an explicit self-declaration, NOT verified identity.
// Its adequacy MUST be separately approved in adultEvidenceApprovalRef.
export async function createAdultPurchaseAuthorization(body, purchaser, {
  db = prisma, env = process.env, now = new Date(), gpc = false,
} = {}) {
  const identity = contacts(purchaser);
  if (!identity) return { eligible: false, reason: "adult_contact_scope_unknown" };
  const choice = body.memoryMetaChoiceReceipt
    ? await consentRecord(body.memoryMetaChoiceReceipt, db) : null;
  const unknownReceipt = Boolean(body.memoryMetaChoiceReceipt && !choice);
  const refused = gpc || body.refused === true || choice?.granted === false || Boolean(choice?.revokedAt);
  const p = await activeAdultPurchasePolicy({ db, env, now });
  const rawPhone = String(purchaser.purchaserPhone || "").replace(/\D/g, "");
  const adult = body.adultParentOwnContactIndia === true && /^(91)?[6-9]\d{9}$/.test(rawPhone);
  const approvedNotice = p && body.policyId === p.id && body.noticeVersion === p.noticeVersion && body.noticeHash === p.noticeHash;
  const blockedSubject = await subjectRefused(identity, db, purchaser);
  if (!refused && (!p || !adult || !approvedNotice || unknownReceipt || blockedSubject))
    return { eligible: false, reason: blockedSubject ? "prior_refusal" : "authorization_missing" };
  const token = crypto.randomBytes(32).toString("hex");
  const record = await db.memoryAdultPurchaseAuthorization.create({ data: {
    tokenHash: digest(token), ...identity, adultConfirmed: adult,
    policyId: p?.id || null, decision: refused ? "REFUSED" : "ALTERNATIVE_AUTHORIZED",
    browserConsentId: choice?.id || null, browserConsentRevision: choice?.revision || null,
    blockedAt: refused ? now : null, blockReason: refused ? (gpc ? "GPC" : "EXPLICIT_REFUSAL") : null,
    evidence: p ? { policyVersion: p.id, effectiveAt: new Date(p.effectiveAt).toISOString(),
      expiresAt: new Date(p.expiresAt).toISOString(), reviewDueAt: new Date(p.reviewDueAt).toISOString(),
      authorizationSource: p.authorizationSource, legalApprovalRef: p.legalApprovalRef,
      metaApprovalRef: p.metaApprovalRef, adultEvidenceApprovalRef: p.adultEvidenceApprovalRef,
      noticeVersion: p.noticeVersion, noticeHash: p.noticeHash, scope: p.scope,
      adultEvidence: "explicit_parent_18_plus_own_contacts_india_declaration", recordedAt: now.toISOString(),
      browserConsentRevision: choice?.revision || null, refusalState: refused ? "REFUSED" : "NO_KNOWN_REFUSAL" } : { refusalState: "REFUSED", recordedAt: now.toISOString() },
  } });
  return { token, eligible: record.decision === "ALTERNATIVE_AUTHORIZED", reason: refused ? "refused" : "alternative", expiresAt: p?.expiresAt || null };
}

export async function withdrawAdultPurchaseAuthorization(token, { db = prisma, now = new Date() } = {}) {
  if (!TOKEN.test(token || "")) throw new Error("PURCHASE_CHOICE_INVALID");
  // Bearer can ONLY withdraw. No public endpoint can approve policies or unblock.
  const row = await db.memoryAdultPurchaseAuthorization.findUnique({ where: { tokenHash: digest(token) } });
  if (!row) throw new Error("PURCHASE_CHOICE_INVALID");
  await db.memoryAdultPurchaseAuthorization.update({ where: { id: row.id },
    data: { blockedAt: row.blockedAt || now, blockReason: "WITHDRAWN" } });
  return { blocked: true };
}

export async function checkoutPurchaseMeasurement(body, purchaser, { db = prisma, env = process.env,
  now = new Date(), parents = false, gpc = false } = {}) {
  const base = { alternativeId: null, blocked: gpc || body.measurementRefused === true ||
    body.adultParentOwnContactIndia === false, blockSource: gpc ? "GPC" : "CHECKOUT_CHOICE" };
  if (body.memoryMetaChoiceReceipt) {
    const choice = await consentRecord(body.memoryMetaChoiceReceipt, db);
    if (!choice || !choice.granted || choice.revokedAt) base.blocked = true;
  }
  const identity = contacts(purchaser);
  if (identity && await subjectRefused(identity, db, purchaser)) base.blocked = true;
  if (!parents || !TOKEN.test(body.purchaseAuthorizationToken || "") || base.blocked) return base;
  const a = await db.memoryAdultPurchaseAuthorization.findUnique({ where: { tokenHash: digest(body.purchaseAuthorizationToken) } });
  if (!a || !identity || a.emailHash !== identity.emailHash || a.phoneHash !== identity.phoneHash ||
      now.getTime() - new Date(a.createdAt).getTime() > 30 * 60000) return base;
  if (await alternativeActive(a, { db, env, now })) base.alternativeId = a.id;
  return base;
}

async function alternativeActive(a, { db, env, now }) {
  if (!a?.adultConfirmed || a.blockedAt || a.decision !== "ALTERNATIVE_AUTHORIZED") return false;
  const p = await activeAdultPurchasePolicy({ db, env, now });
  if (!p || a.policyId !== p.id || new Date(a.createdAt) < new Date(p.effectiveAt) ||
      a.evidence?.effectiveAt !== new Date(p.effectiveAt).toISOString() ||
      a.evidence?.expiresAt !== new Date(p.expiresAt).toISOString() ||
      a.evidence?.reviewDueAt !== new Date(p.reviewDueAt).toISOString() ||
      a.evidence?.noticeVersion !== p.noticeVersion || a.evidence?.scope !== p.scope ||
      a.evidence?.noticeHash !== p.noticeHash || a.evidence?.authorizationSource !== p.authorizationSource ||
      a.evidence?.legalApprovalRef !== p.legalApprovalRef || a.evidence?.metaApprovalRef !== p.metaApprovalRef ||
      a.evidence?.adultEvidenceApprovalRef !== p.adultEvidenceApprovalRef) return false;
  if (a.browserConsentId) {
    const choice = await db.memoryMetaConsent.findUnique({ where: { id: a.browserConsentId } });
    if (!choice?.granted || choice.revokedAt || choice.revision !== a.browserConsentRevision) return false;
  }
  return !await subjectRefused(a, db);
}

export async function purchaseMeasurementAuthorized(purchase, {
  db = prisma, env = process.env, now = new Date(),
} = {}) {
  if (env.MEMORY_META_PURCHASE_SHARING_BLOCKED === "true") return false;
  const intent = purchase.checkoutIntent || purchase;
  const audit = intent.purchaseMeasurement;
  if (audit?.blocked) return false;
  const identity = contacts(purchase);
  if (identity && await subjectRefused(identity, db, purchase)) return false;
  if (await purchaseConsentActive(purchase, db, now)) return true;
  // Historical rows and assessment-linked checkouts cannot acquire an alternative path.
  if (!audit?.alternativeId || intent.memoryAssessmentSessionId || intent.trackId !== "school_unspecified") return false;
  const a = await db.memoryAdultPurchaseAuthorization.findUnique({ where: { id: audit.alternativeId } });
  if (!a || !identity || a.emailHash !== identity.emailHash || a.phoneHash !== identity.phoneHash) return false;
  return alternativeActive(a, { db, env, now });
}
