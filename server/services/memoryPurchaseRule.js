import crypto from "node:crypto";
import { MEMORY_MASTERCLASS_EVENT } from "../config/memoryMasterclassEvent.js";

export const MEMORY_PURCHASE_RULE_VERSION = "parents-risk-scope-v1";
export const MEMORY_PURCHASE_SCOPE = "IN_ADULT_DIRECTED_PARENTS_RISK_BASED";
const ORIGIN = "https://www.fluencyjet.com";
const PATH = "/memory-masterclass/parents";
const TTL = 15 * 60000;
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
export const purchaserContactKey = purchaser => hash(JSON.stringify([
  String(purchaser.purchaserEmail || "").trim().toLowerCase(),
  String(purchaser.purchaserPhone || "").replace(/\D/g, ""),
]));
function signingKey(env) {
  if (!env.RAZORPAY_KEY_SECRET) throw new Error("CONTEXT_SIGNING_UNAVAILABLE");
  // Domain-separated signing key from the merchant secret already used by this
  // checkout. No secret is sent to the browser, logged or read by test tooling.
  return crypto.createHmac("sha256", env.RAZORPAY_KEY_SECRET).update("brainodad:parents-context:v1").digest();
}
function signature(payload, env) { return crypto.createHmac("sha256", signingKey(env)).update(payload).digest("hex"); }
export function requestDisqualified(body = {}) {
  return body.knownChild === true || body.knownMinor === true || body.adultParentOwnContactIndia === false ||
    (body.purchaserAge != null && (!Number.isFinite(Number(body.purchaserAge)) || Number(body.purchaserAge) < 18)) ||
    (body.contactSource != null && body.contactSource !== "standalone_purchaser_form") ||
    body.studentContact === true || body.restrictedContext === true ||
    ["memoryAssessmentSessionId", "ownerToken", "studentId", "studentEmail", "studentPhone", "learnerName", "answers", "score"].some(k => body[k] != null);
}
export function issueParentsPurchaseContext(purchaser, headers, body = {}, {env=process.env, now=new Date()} = {}) {
  let ref; try { ref = new URL(headers.referer || ""); } catch { throw new Error("PARENTS_CONTEXT_INVALID"); }
  if (headers.origin !== ORIGIN || ref.origin !== ORIGIN || ref.pathname !== PATH ||
      ref.search || ref.hash || requestDisqualified(body)) throw new Error("PARENTS_CONTEXT_INVALID");
  const payload = Buffer.from(JSON.stringify({v:1, nonce:crypto.randomBytes(16).toString("hex"),
    issuedAt:now.toISOString(), expiresAt:new Date(+now+TTL).toISOString(), flow:PATH,
    contactSource:"standalone_purchaser_form", contactKey:purchaserContactKey(purchaser),
    eventKey:MEMORY_MASTERCLASS_EVENT.key, ruleVersion:MEMORY_PURCHASE_RULE_VERSION})).toString("base64url");
  return `${payload}.${signature(payload,env)}`;
}
function readContext(token, purchaser, recordedAt, {env,now}) {
  if (typeof token !== "string" || token.length > 2500) return null;
  const [payload,sig,...extra]=token.split(".");
  if(extra.length || !/^[a-f0-9]{64}$/.test(sig || "")) return null;
  const expected=signature(payload,env);
  if(!crypto.timingSafeEqual(Buffer.from(sig,"hex"),Buffer.from(expected,"hex"))) return null;
  let p; try {p=JSON.parse(Buffer.from(payload,"base64url").toString());} catch{return null;}
  const at=new Date(recordedAt || now);
  if(p.v!==1 || p.flow!==PATH || p.contactSource!=="standalone_purchaser_form" ||
    p.ruleVersion!==MEMORY_PURCHASE_RULE_VERSION || p.eventKey!==MEMORY_MASTERCLASS_EVENT.key ||
    p.contactKey!==purchaserContactKey(purchaser) || !(new Date(p.issuedAt)<=at && at<=now &&
    at<new Date(p.expiresAt)) || +new Date(p.expiresAt)-+new Date(p.issuedAt)!==TTL) return null;
  return p;
}
export async function assessmentContactConflict(input, db) {
  return Boolean(await db.memoryAssessmentSession.findFirst({where:{OR:[
    {email:{equals:input.purchaserEmail.trim().toLowerCase(),mode:"insensitive"}},
    {whatsappNumberNormalized:{in:[input.purchaserPhone,input.purchaserPhone.replace(/\D/g, "")]}}
  ]},select:{id:true}}));
}
export async function evaluateApprovedMemoryPurchaseRule(input, {now=new Date(),env=process.env,db,policy,phase="order",verifiedCapture}={}) {
  const deny=reason=>({eligible:false,scopeEligible:false,ageVerified:false,reason});
  const audit=input.purchaseAuthorization;
  if(policy?.scope!==MEMORY_PURCHASE_SCOPE || policy.metaRestrictionsCleared!==true || !policy.riskScopeApprovalRef)
    return deny("RISK_SCOPE_NOT_APPROVED");
  if(input.productKey!=="memory_masterclass_99" || input.amount!==9900 || input.currency!=="INR" ||
    input.eventKey!==MEMORY_MASTERCLASS_EVENT.key || input.trackId!=="school_unspecified" ||
    input.memoryAssessmentSessionId || input.checkoutSource!=="standalone_vsl") return deny("PRODUCT_OR_CONTEXT_MISMATCH");
  if(audit?.riskBlocked) return deny("CHILD_OR_RESTRICTED_CONTEXT");
  const context=readContext(audit?.serverContext,input,audit?.recordedAt,{env,now});
  if(!context) return deny("PARENTS_CONTEXT_INVALID");
  // India-contact market scope, NOT proof of location, residency or age.
  if(!/^\+91[6-9]\d{9}$/.test(input.purchaserPhone || "") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.purchaserEmail || ""))
    return deny("INDIA_CONTACT_SCOPE_UNKNOWN");
  // Conservative conflict check. Read only an existence indicator; never retrieve
  // or send answers, scores, student identity or assessment browser identifiers.
  const conflict=await assessmentContactConflict(input,db);
  if(conflict) return deny("ASSESSMENT_CONTACT_CONFLICT");
  if(phase!=="order") {
    const capture=verifiedCapture || input;
    if(capture.status!=="captured" || !capture.paymentId || capture.razorpayOrderId!==input.razorpayOrderId ||
      capture.amount!==9900 || capture.currency!=="INR") return deny("CAPTURE_NOT_VERIFIED");
    if(!audit?.choicesReadyAt || new Date(audit.choicesReadyAt)>now) return deny("MEASUREMENT_CHOICES_UNAVAILABLE");
  }
  return {eligible:true,scopeEligible:true,ageVerified:false,
    authorizationEvidenceRef:`risk-scope:${hash(JSON.stringify([context.nonce,input.razorpayOrderId,policy.version,MEMORY_PURCHASE_RULE_VERSION]))}`};
}
