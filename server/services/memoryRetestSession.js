import { hashMemoryRetestToken } from "./memoryRetestGrant.js";
import { resolveMemoryFormBEligibility } from "./memoryFormBEligibility.js";

const ALLOWED_TRACKS = new Set([
  "school_foundation",
  "school_advanced",
  "advanced",
]);

const INVALID = () => ({
  valid: false,
  reason: "INVALID_OR_EXPIRED_SESSION",
});

/*
 * Internal server-side validator.
 *
 * Future browser integration must use a secure HttpOnly cookie.
 * Never place the session token in a URL or browser storage.
 *
 * This module does not create an API or browser session.
 */
export async function validateMemoryRetestSession(
  { sessionToken } = {},
  {
    prisma,
    eligibilityResolver = resolveMemoryFormBEligibility,
    now = () => new Date(),
  } = {},
) {
  const grants = prisma?.memoryRetestAccessGrant;

  if (
    typeof grants?.findUnique !== "function" ||
    typeof grants?.updateMany !== "function"
  ) {
    throw new TypeError("Prisma retest grant model required");
  }

  if (typeof eligibilityResolver !== "function") {
    throw new TypeError("Eligibility resolver required");
  }

  if (
    typeof sessionToken !== "string" ||
    !/^[a-f0-9]{64}$/.test(sessionToken)
  ) {
    return INVALID();
  }

  const currentTime = now();

  if (
    !(currentTime instanceof Date) ||
    !Number.isFinite(currentTime.getTime())
  ) {
    throw new RangeError("Invalid current time");
  }

  const sessionTokenHash = hashMemoryRetestToken(sessionToken);

  const grant = await grants.findUnique({
    where: { sessionTokenHash },
    select: {
      id: true,
      purchaseId: true,
      assessmentSessionId: true,
      sessionTokenHash: true,
      sessionExpiresAt: true,
      redeemedAt: true,
      revokedAt: true,
    },
  });

  if (
    !grant ||
    grant.sessionTokenHash !== sessionTokenHash ||
    !grant.redeemedAt ||
    grant.revokedAt ||
    !grant.sessionExpiresAt
  ) {
    return INVALID();
  }

  const expiresAt = new Date(grant.sessionExpiresAt);

  if (
    !Number.isFinite(expiresAt.getTime()) ||
    expiresAt <= currentTime
  ) {
    return INVALID();
  }

  // Recheck the captured purchase and original Form A assessment.
  const eligibility = await eligibilityResolver(
    { trustedPurchaseId: grant.purchaseId },
    { prisma },
  );

  if (
    !eligibility?.eligible ||
    eligibility.purchaseId !== grant.purchaseId ||
    eligibility.assessmentSessionId !== grant.assessmentSessionId ||
    !ALLOWED_TRACKS.has(eligibility.trackId)
  ) {
    return INVALID();
  }

  /*
   * Atomic conditional update:
   * A session revoked or expired during validation must fail.
   */
  const updated = await grants.updateMany({
    where: {
      id: grant.id,
      sessionTokenHash,
      redeemedAt: { not: null },
      revokedAt: null,
      sessionExpiresAt: { gt: currentTime },
    },
    data: {
      lastUsedAt: currentTime,
    },
  });

  if (updated.count !== 1) {
    return INVALID();
  }

  return {
    valid: true,
    purchaseId: grant.purchaseId,
    assessmentSessionId: grant.assessmentSessionId,
    trackId: eligibility.trackId,
  };
}
