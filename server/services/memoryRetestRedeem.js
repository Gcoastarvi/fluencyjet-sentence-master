import crypto from "node:crypto";
import { hashMemoryRetestToken } from "./memoryRetestGrant.js";
import { resolveMemoryFormBEligibility } from "./memoryFormBEligibility.js";

const SESSION_HOURS = 12;
const INVALID = () => ({
  redeemed: false,
  reason: "INVALID_OR_USED_LINK",
});

/*
 * Internal redemption service.
 *
 * Does not create a public endpoint, cookie or browser session.
 * The caller must safely deliver the returned session token.
 */
export async function redeemMemoryRetestLink(
  { linkToken } = {},
  {
    prisma,
    eligibilityResolver = resolveMemoryFormBEligibility,
    now = () => new Date(),
  } = {},
) {
  if (typeof prisma?.$transaction !== "function") {
    throw new TypeError("Prisma transaction support required");
  }

  if (typeof eligibilityResolver !== "function") {
    throw new TypeError("Eligibility resolver required");
  }

  if (
    typeof linkToken !== "string" ||
    !/^[a-f0-9]{64}$/.test(linkToken)
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

  const tokenHash = hashMemoryRetestToken(linkToken);

  return prisma.$transaction(async (tx) => {
    const grants = tx?.memoryRetestAccessGrant;

    if (
      typeof grants?.findUnique !== "function" ||
      typeof grants?.updateMany !== "function"
    ) {
      throw new TypeError("Prisma retest grant model required");
    }

    const grant = await grants.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        purchaseId: true,
        assessmentSessionId: true,
        linkExpiresAt: true,
        redeemedAt: true,
        revokedAt: true,
        sessionTokenHash: true,
      },
    });

    if (
      !grant ||
      grant.redeemedAt ||
      grant.revokedAt ||
      grant.sessionTokenHash ||
      !grant.linkExpiresAt ||
      new Date(grant.linkExpiresAt) <= currentTime
    ) {
      return INVALID();
    }

    // Recheck the actual verified purchase and original assessment.
    const eligibility = await eligibilityResolver(
      { trustedPurchaseId: grant.purchaseId },
      { prisma: tx },
    );

    if (
      !eligibility?.eligible ||
      eligibility.purchaseId !== grant.purchaseId ||
      eligibility.assessmentSessionId !== grant.assessmentSessionId
    ) {
      return INVALID();
    }

    const sessionToken = crypto.randomBytes(32).toString("hex");
    const sessionTokenHash = hashMemoryRetestToken(sessionToken);

    const sessionExpiresAt = new Date(
      currentTime.getTime() +
      SESSION_HOURS * 60 * 60 * 1000
    );

    // Conditional database update makes one-time redemption atomic.
    const updated = await grants.updateMany({
      where: {
        id: grant.id,
        tokenHash,
        purchaseId: grant.purchaseId,
        assessmentSessionId: grant.assessmentSessionId,
        redeemedAt: null,
        revokedAt: null,
        sessionTokenHash: null,
        linkExpiresAt: { gt: currentTime },
      },
      data: {
        redeemedAt: currentTime,
        sessionTokenHash,
        sessionExpiresAt,
      },
    });

    if (updated.count !== 1) {
      return INVALID();
    }

    return {
      redeemed: true,
      sessionToken,
      sessionExpiresAt,
      trackId: eligibility.trackId,
    };
  });
}
