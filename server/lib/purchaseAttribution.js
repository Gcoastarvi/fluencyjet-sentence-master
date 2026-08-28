import { normalizeWhatsAppNumber } from "./whatsappNumber.js";
import { SENTENCE_MASTER_PRODUCT_KEY } from "./whatsappJourney.js";

export const SENTENCE_MASTER_AMOUNT_PAISE = 119900;
export const CHECKOUT_INTENT_MATCH_WINDOW_MS = 48 * 60 * 60 * 1000;

function normalizeEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  return normalized || null;
}

export function getCapturedPaymentTime(paymentEntity) {
  const rawCreatedAt = paymentEntity?.created_at;
  const seconds =
    typeof rawCreatedAt === "number"
      ? rawCreatedAt
      : typeof rawCreatedAt === "string" && /^\d+$/.test(rawCreatedAt)
        ? Number(rawCreatedAt)
        : null;

  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    return null;
  }

  const capturedAt = new Date(seconds * 1000);
  return Number.isNaN(capturedAt.getTime()) ? null : capturedAt;
}

/**
 * Payment-link traffic is intentionally correlated only from immutable evidence
 * captured while an authenticated learner initiated this exact product checkout.
 * Requiring both payment identity values and a single candidate keeps the
 * association fail-closed for anonymous, stale, and ambiguous captures.
 */
export async function findExactSentenceMasterCheckoutIntent({
  database,
  customerEmail,
  customerContact,
  capturedAt,
}) {
  const learnerEmail = normalizeEmail(customerEmail);
  const destinationNumberNormalized = normalizeWhatsAppNumber(customerContact);

  if (!learnerEmail || !destinationNumberNormalized || !(capturedAt instanceof Date)) {
    return { intent: null, reason: "INCOMPLETE_PAYMENT_EVIDENCE" };
  }

  if (Number.isNaN(capturedAt.getTime())) {
    return { intent: null, reason: "INCOMPLETE_PAYMENT_EVIDENCE" };
  }

  const candidates =
    await database.sentenceMasterCheckoutIntent.findMany({
      where: {
        productKey: SENTENCE_MASTER_PRODUCT_KEY,
        learnerEmail,
        destinationNumberNormalized,
        purchase: { is: null },
        createdAt: {
          lte: capturedAt,
          gte: new Date(capturedAt.getTime() - CHECKOUT_INTENT_MATCH_WINDOW_MS),
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        userId: true,
        productKey: true,
        learnerEmail: true,
        destinationNumberNormalized: true,
        createdAt: true,
      },
    });

  if (candidates.length !== 1) {
    return {
      intent: null,
      reason: candidates.length === 0 ? "NO_EXACT_CHECKOUT_INTENT" : "AMBIGUOUS_CHECKOUT_INTENT",
    };
  }

  return { intent: candidates[0], reason: null };
}

export function productKeyForPaymentAmount(amount) {
  return amount === SENTENCE_MASTER_AMOUNT_PAISE
    ? SENTENCE_MASTER_PRODUCT_KEY
    : null;
}