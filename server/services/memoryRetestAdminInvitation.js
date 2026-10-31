import {
  resolveMemoryFormBEligibility,
} from "./memoryFormBEligibility.js";

import {
  issueMemoryRetestGrant,
} from "./memoryRetestGrant.js";

import {
  revokeMemoryRetestGrants,
} from "./memoryRetestRevoke.js";

const SCHOOL_TRACKS = new Set([
  "school_foundation",
  "school_advanced",
]);

const LINK_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 3;

const deny = reason => ({ issued: false, reason });

function validDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

/*
 * Trusted internal administrator workflow.
 *
 * No HTTP route, automatic delivery, browser token handling
 * or authorization based on an email address.
 *
 * The eventual HTTP controller must independently verify
 * its JWT and then supply the authenticated admin's ID.
 */
export async function issueMemoryRetestAdminInvitation(
  {
    trustedAdminId,
    trustedPurchaseId,
    schoolTrackId = null,
  } = {},
  {
    prisma,
    eligibilityResolver = resolveMemoryFormBEligibility,
    grantIssuer = issueMemoryRetestGrant,
    grantRevoker = revokeMemoryRetestGrants,
    now = () => new Date(),
  } = {},
) {
  if (
    !prisma ||
    typeof prisma.$transaction !== "function" ||
    typeof eligibilityResolver !== "function" ||
    typeof grantIssuer !== "function" ||
    typeof grantRevoker !== "function"
  ) {
    throw new TypeError("Trusted invitation dependencies required");
  }

  if (!Number.isSafeInteger(trustedAdminId) || trustedAdminId <= 0) {
    return deny("ADMIN_NOT_AUTHORIZED");
  }

  if (
    typeof trustedPurchaseId !== "string" ||
    !trustedPurchaseId.trim()
  ) {
    return deny("PURCHASE_ID_REQUIRED");
  }

  if (
    schoolTrackId !== null &&
    !SCHOOL_TRACKS.has(schoolTrackId)
  ) {
    return deny("INVALID_SCHOOL_TRACK");
  }

  const currentTime = now();

  if (
    !(currentTime instanceof Date) ||
    !Number.isFinite(currentTime.getTime())
  ) {
    throw new RangeError("Invalid invitation clock");
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(
        async tx => {
          const admin = await tx.user.findUnique({
            where: { id: trustedAdminId },
            select: { id: true, isAdmin: true },
          });

          if (
            !admin ||
            admin.id !== trustedAdminId ||
            admin.isAdmin !== true
          ) {
            return deny("ADMIN_NOT_AUTHORIZED");
          }

          const purchase =
            await tx.memoryMasterclassPurchase.findUnique({
              where: { id: trustedPurchaseId },
              select: {
                id: true,
                checkoutIntentId: true,
              },
            });

          if (!purchase) {
            return deny("PURCHASE_NOT_FOUND");
          }

          const originalEligibility =
            await eligibilityResolver(
              { trustedPurchaseId },
              { prisma: tx },
            );

          const needsAssignment =
            !originalEligibility?.eligible &&
            originalEligibility?.reason ===
              "TRACK_ASSIGNMENT_REQUIRED";

          if (
            !originalEligibility?.eligible &&
            !needsAssignment
          ) {
            return deny(
              originalEligibility?.reason || "NOT_ELIGIBLE",
            );
          }

          const intent =
            await tx.memoryMasterclassCheckoutIntent.findUnique({
              where: { id: purchase.checkoutIntentId },
              select: {
                id: true,
                checkoutSource: true,
                trackId: true,
                eventStartsAt: true,
                eventEndsAt: true,
              },
            });

          if (!intent) {
            return deny("CHECKOUT_INTENT_NOT_FOUND");
          }

          const startsAt = validDate(intent.eventStartsAt);
          const endsAt = validDate(intent.eventEndsAt);

          if (
            !startsAt ||
            !endsAt ||
            endsAt <= startsAt
          ) {
            return deny("EVENT_CONFIGURATION_INVALID");
          }

          if (currentTime < endsAt) {
            return deny("MASTERCLASS_NOT_FINISHED");
          }

          let eligibility = originalEligibility;
          let assignmentCreated = false;

          // A normal denial response commits a Prisma transaction.
          // After creating an assignment, throw an internal error
          // so PostgreSQL rolls back before returning the denial.
          const denyAfterPossibleAssignment = (reason) => {
            if (assignmentCreated) {
              const rollback = new Error(
                "Retest track assignment must roll back",
              );
              rollback.name = "MemoryRetestAssignmentRollback";
              rollback.denialReason = reason;
              throw rollback;
            }

            return deny(reason);
          };

          if (needsAssignment) {
            if (
              intent.checkoutSource !== "standalone_vsl" ||
              intent.trackId !== "school_unspecified"
            ) {
              return denyAfterPossibleAssignment("TRACK_ASSIGNMENT_NOT_ALLOWED");
            }

            if (!schoolTrackId) {
              return denyAfterPossibleAssignment("SCHOOL_TRACK_REQUIRED");
            }

            // A track must never be assigned after a link
            // has already been issued for this purchase.
            const previousGrants =
              await tx.memoryRetestAccessGrant.count({
                where: { purchaseId: trustedPurchaseId },
              });

            if (previousGrants !== 0) {
              return denyAfterPossibleAssignment("TRACK_ALREADY_LOCKED");
            }

            await tx.memoryRetestTrackAssignment.create({
              data: {
                purchaseId: trustedPurchaseId,
                trackId: schoolTrackId,
                assignedByAdminId: trustedAdminId,
              },
            });

            assignmentCreated = true;

            eligibility = await eligibilityResolver(
              { trustedPurchaseId },
              { prisma: tx },
            );
          }

          if (!eligibility?.eligible) {
            return denyAfterPossibleAssignment(
              eligibility?.reason || "NOT_ELIGIBLE",
            );
          }

          if (
            schoolTrackId !== null &&
            eligibility.trackId !== schoolTrackId
          ) {
            return denyAfterPossibleAssignment("TRACK_SELECTION_MISMATCH");
          }

          if (eligibility.assessmentSessionId === null) {
            const completed =
              await tx.memoryFormBOnlyResult.findUnique({
                where: { purchaseId: trustedPurchaseId },
                select: { id: true },
              });

            if (completed) {
              return denyAfterPossibleAssignment("FORM_B_ALREADY_COMPLETED");
            }
          } else {
            const assessment =
              await tx.memoryAssessmentSession.findUnique({
                where: {
                  id: eligibility.assessmentSessionId,
                },
                select: {
                  formBCompletedAt: true,
                },
              });

            if (!assessment) {
              return denyAfterPossibleAssignment("ASSESSMENT_NOT_FOUND");
            }

            if (assessment.formBCompletedAt !== null) {
              return denyAfterPossibleAssignment("FORM_B_ALREADY_COMPLETED");
            }
          }

          // Revoke and replace atomically, following the
          // existing secure replacement service pattern.
          const revoked = await grantRevoker(
            { trustedPurchaseId },
            {
              prisma: tx,
              now: () => currentTime,
            },
          );

          if (!revoked?.revoked) {
            throw new Error("Retest grant revocation failed");
          }

          const linkExpiresAt = new Date(
            currentTime.getTime() + LINK_LIFETIME_MS,
          );

          const issued = await grantIssuer(
            {
              trustedPurchaseId,
              linkExpiresAt,
            },
            {
              prisma: tx,
              eligibilityResolver: async () => eligibility,
              now: () => currentTime,
            },
          );

          if (
            !issued?.issued ||
            typeof issued.linkToken !== "string"
          ) {
            throw new Error("Secure invitation issuance failed");
          }

          return {
            issued: true,
            purchaseId: trustedPurchaseId,
            trackId: eligibility.trackId,
            grantId: issued.grantId,
            linkToken: issued.linkToken,
            linkExpiresAt: issued.linkExpiresAt,
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
      if (
        error?.name === "MemoryRetestAssignmentRollback" &&
        typeof error.denialReason === "string"
      ) {
        return deny(error.denialReason);
      }

      if (
        error?.code === "P2034" &&
        attempt < MAX_ATTEMPTS - 1
      ) {
        continue;
      }

      if (error?.code === "P2002") {
        return deny("TRACK_ASSIGNMENT_CONFLICT");
      }

      throw error;
    }
  }

  throw new Error("Invitation transaction retries exhausted");
}
