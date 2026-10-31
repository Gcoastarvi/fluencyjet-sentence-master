import crypto from "node:crypto";
import { resolveMemoryFormBEligibility } from "./memoryFormBEligibility.js";

const MAX_LINK_DAYS = 30;

export function hashMemoryRetestToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/*
 * Internal service only.
 *
 * The purchase ID and link expiry must come from trusted
 * server-side code, never directly from an unauthenticated request.
 *
 * This does not create an API, grant browser access,
 * or verify live-class attendance.
 */
export async function issueMemoryRetestGrant(
  { trustedPurchaseId, linkExpiresAt } = {},
  {
    prisma,
    eligibilityResolver = resolveMemoryFormBEligibility,
    now = () => new Date(),
  } = {},
) {
  if (!prisma?.memoryRetestAccessGrant?.create) {
    throw new TypeError("Prisma retest grant model is required");
  }

  if (typeof eligibilityResolver !== "function") {
    throw new TypeError("Eligibility resolver is required");
  }

  if (
    typeof trustedPurchaseId !== "string" ||
    !trustedPurchaseId.trim()
  ) {
    return { issued: false, reason: "PURCHASE_ID_REQUIRED" };
  }

  const currentTime = now();
  const expiry = new Date(linkExpiresAt);

  if (
    !(currentTime instanceof Date) ||
    !Number.isFinite(currentTime.getTime()) ||
    !Number.isFinite(expiry.getTime()) ||
    expiry <= currentTime ||
    expiry.getTime() - currentTime.getTime() >
      MAX_LINK_DAYS * 24 * 60 * 60 * 1000
  ) {
    throw new RangeError("Invalid retest link expiry");
  }

  const eligibility = await eligibilityResolver(
    { trustedPurchaseId },
    { prisma },
  );

  if (!eligibility?.eligible) {
    return {
      issued: false,
      reason: eligibility?.reason || "NOT_ELIGIBLE",
    };
  }

  if (
    !eligibility.purchaseId ||
    !eligibility.assessmentSessionId
  ) {
    throw new Error("Incomplete eligibility result");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashMemoryRetestToken(token);

  const grant = await prisma.memoryRetestAccessGrant.create({
    data: {
      purchaseId: eligibility.purchaseId,
      assessmentSessionId: eligibility.assessmentSessionId,
      tokenHash,
      linkExpiresAt: expiry,
    },
  });

  return {
    issued: true,
    grantId: grant.id,
    linkToken: token,
    linkExpiresAt: expiry,
  };
}
