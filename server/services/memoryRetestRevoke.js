/*
 * Internal Form B revocation service.
 *
 * The purchase ID must come from trusted server-side code,
 * never directly from an unauthenticated browser request.
 *
 * Revokes all currently unrevoked retest grants associated
 * with a purchase. This invalidates both redemption links
 * and sessions because their validators check revokedAt.
 *
 * This service does not expose a route, send messages,
 * or access production unless explicitly called by
 * an authorized server-side workflow.
 */

export async function revokeMemoryRetestGrants(
  { trustedPurchaseId } = {},
  {
    prisma,
    now = () => new Date(),
  } = {},
) {
  if (
    typeof prisma?.memoryRetestAccessGrant?.updateMany !== "function"
  ) {
    throw new TypeError("Prisma retest grant model required");
  }

  if (
    typeof trustedPurchaseId !== "string" ||
    !trustedPurchaseId.trim()
  ) {
    return {
      revoked: false,
      reason: "PURCHASE_ID_REQUIRED",
    };
  }

  if (typeof now !== "function") {
    throw new TypeError("Clock function required");
  }

  const currentTime = now();

  if (
    !(currentTime instanceof Date) ||
    !Number.isFinite(currentTime.getTime())
  ) {
    throw new RangeError("Invalid current time");
  }

  const result = await prisma.memoryRetestAccessGrant.updateMany({
    where: {
      purchaseId: trustedPurchaseId,
      revokedAt: null,
    },
    data: {
      revokedAt: currentTime,
    },
  });

  return {
    revoked: true,
    revokedCount: result.count,
  };
}
