import {
  resolveMemoryFormBEligibility,
} from "./memoryFormBEligibility.js";

import {
  issueMemoryRetestGrant,
} from "./memoryRetestGrant.js";

import {
  revokeMemoryRetestGrants,
} from "./memoryRetestRevoke.js";

const MAX_ATTEMPTS = 3;
const MAX_LINK_MS = 30 * 24 * 60 * 60 * 1000;

/*
 * Internal replacement service.
 *
 * Only trusted server-side workflows may supply purchase IDs.
 * No public route or notification is created here.
 *
 * All production issuance paths must eventually use the
 * replacement workflow, rather than calling the basic grant
 * generator independently.
 */
export async function replaceMemoryRetestGrant(
  { trustedPurchaseId, linkExpiresAt } = {},
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
    typeof trustedPurchaseId !== "string" ||
    !trustedPurchaseId.trim()
  ) {
    return {
      issued: false,
      reason: "PURCHASE_ID_REQUIRED",
    };
  }

  if (typeof now !== "function") {
    throw new TypeError("Clock function required");
  }

  const currentTime = now();
  const expiry = new Date(linkExpiresAt);

  if (
    !(currentTime instanceof Date) ||
    !Number.isFinite(currentTime.getTime()) ||
    !Number.isFinite(expiry.getTime()) ||
    expiry <= currentTime ||
    expiry.getTime() - currentTime.getTime() > MAX_LINK_MS
  ) {
    throw new RangeError("Invalid retest link expiry");
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          // Check purchase eligibility inside the transaction.
          const eligibility = await eligibilityResolver(
            { trustedPurchaseId },
            { prisma: tx },
          );

          if (!eligibility?.eligible) {
            return {
              issued: false,
              reason: eligibility?.reason || "NOT_ELIGIBLE",
            };
          }

          if (
            eligibility.purchaseId !== trustedPurchaseId ||
            !eligibility.assessmentSessionId
          ) {
            throw new Error(
              "Inconsistent retest purchase eligibility",
            );
          }

          // Revoke previous links and their associated sessions.
          const revoked = await revokeMemoryRetestGrants(
            { trustedPurchaseId },
            {
              prisma: tx,
              now: () => currentTime,
            },
          );

          // Generate the replacement within the same transaction.
          const replacement = await issueMemoryRetestGrant(
            {
              trustedPurchaseId,
              linkExpiresAt: expiry,
            },
            {
              prisma: tx,
              eligibilityResolver: async () => eligibility,
              now: () => currentTime,
            },
          );

          if (!replacement.issued) {
            throw new Error(
              "Replacement issuance failed; transaction aborted",
            );
          }

          return {
            ...replacement,
            revokedCount: revoked.revokedCount,
          };
        },
        {
          isolationLevel: "Serializable",
          maxWait: 5000,
          timeout: 10000,
        },
      );
    } catch (error) {
      // Prisma reports serialization/write conflicts as P2034.
      if (
        error?.code === "P2034" &&
        attempt < MAX_ATTEMPTS - 1
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Retest replacement attempts exhausted");
}
