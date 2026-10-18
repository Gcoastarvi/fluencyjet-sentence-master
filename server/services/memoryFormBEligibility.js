/*
 * Internal Form B eligibility checker.
 * The caller must independently authorize trustedPurchaseId.
 * This does not grant browser access or verify attendance.
 */

const TRACKS = new Set([
  "school_foundation",
  "school_advanced",
  "advanced",
]);

const SESSION_STATUSES = new Set([
  "FORM_A_COMPLETED",
  "LEAD_CAPTURED",
]);

const PRODUCT = "memory_masterclass_99";
const AMOUNT = 9900;
const CURRENCY = "INR";

const deny = (reason) => ({ eligible: false, reason });
const hasText = (v) => typeof v === "string" && v.trim().length > 0;

function scoreNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100
    ? number
    : null;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function resolveMemoryFormBEligibility(
  { trustedPurchaseId } = {},
  { prisma } = {},
) {
  if (
    !prisma?.memoryMasterclassPurchase?.findUnique ||
    !prisma?.memoryMasterclassCheckoutIntent?.findUnique ||
    !prisma?.memoryAssessmentSession?.findUnique
  ) {
    throw new TypeError("Prisma client is required");
  }

  if (!hasText(trustedPurchaseId)) {
    return deny("PURCHASE_ID_REQUIRED");
  }

  const purchase = await prisma.memoryMasterclassPurchase.findUnique({
    where: { id: trustedPurchaseId },
  });

  if (!purchase) return deny("PURCHASE_NOT_FOUND");

  if (purchase.status !== "captured") {
    return deny("PURCHASE_NOT_CAPTURED");
  }

  if (
    purchase.productKey !== PRODUCT ||
    purchase.amount !== AMOUNT ||
    purchase.currency !== CURRENCY ||
    purchase.checkoutSource !== "assessment" ||
    !hasText(purchase.paymentId) ||
    !hasText(purchase.razorpayOrderId) ||
    !hasText(purchase.checkoutIntentId)
  ) {
    return deny("PURCHASE_INVALID");
  }

  const intent = await prisma.memoryMasterclassCheckoutIntent.findUnique({
    where: { id: purchase.checkoutIntentId },
  });

  if (!intent) return deny("CHECKOUT_INTENT_NOT_FOUND");

  if (
    intent.id !== purchase.checkoutIntentId ||
    intent.razorpayOrderId !== purchase.razorpayOrderId ||
    intent.productKey !== PRODUCT ||
    intent.amount !== AMOUNT ||
    intent.currency !== CURRENCY ||
    intent.checkoutSource !== "assessment"
  ) {
    return deny("CHECKOUT_INTENT_MISMATCH");
  }

  if (!hasText(intent.memoryAssessmentSessionId)) {
    return deny("ASSESSMENT_NOT_LINKED");
  }

  if (
    !TRACKS.has(intent.trackId) ||
    (purchase.trackId != null && purchase.trackId !== intent.trackId)
  ) {
    return deny("TRACK_MISMATCH");
  }

  const assessment = await prisma.memoryAssessmentSession.findUnique({
    where: { id: intent.memoryAssessmentSessionId },
  });

  if (!assessment) return deny("ASSESSMENT_NOT_FOUND");

  if (
    assessment.id !== intent.memoryAssessmentSessionId ||
    assessment.trackId !== intent.trackId
  ) {
    return deny("TRACK_MISMATCH");
  }

  if (
    !SESSION_STATUSES.has(assessment.status) ||
    !assessment.formACompletedAt ||
    Number.isNaN(new Date(assessment.formACompletedAt).getTime())
  ) {
    return deny("FORM_A_INCOMPLETE");
  }

  const score = scoreNumber(assessment.formAScore);
  const result = assessment.formAResult;
  const resultScore = isObject(result)
    ? scoreNumber(result.totalScore)
    : null;

  const modules = isObject(result) ? result.modules : null;
  const moduleCount = Array.isArray(modules)
    ? modules.length
    : isObject(modules)
      ? Object.keys(modules).length
      : 0;

  if (
    score === null ||
    resultScore === null ||
    result.form !== "A" ||
    result.trackId !== assessment.trackId ||
    result.maxScore !== 100 ||
    Math.abs(score - resultScore) > 0.011 ||
    moduleCount !== 5 ||
    !isObject(assessment.formAAnswers)
  ) {
    return deny("FORM_A_RESULT_INVALID");
  }

  return {
    eligible: true,
    purchaseId: purchase.id,
    checkoutIntentId: intent.id,
    assessmentSessionId: assessment.id,
    trackId: assessment.trackId,
    formAScore: score,
    formACompletedAt: assessment.formACompletedAt,
  };
}
