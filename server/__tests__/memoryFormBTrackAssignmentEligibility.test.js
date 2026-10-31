import { jest } from "@jest/globals";

import {
  resolveMemoryFormBEligibility,
} from "../services/memoryFormBEligibility.js";

function fixture({
  trackId = "school_unspecified",
  checkoutSource = "standalone_vsl",
  assignment = {
    purchaseId: "purchase-parents",
    trackId: "school_foundation",
    assignedByAdminId: 7,
  },
} = {}) {
  const intent = {
    id: "intent-parents",
    memoryAssessmentSessionId: null,
    checkoutSource,
    razorpayOrderId: "order-parents",
    productKey: "memory_masterclass_99",
    amount: 9900,
    currency: "INR",
    trackId,
  };

  const purchase = {
    id: "purchase-parents",
    checkoutIntentId: intent.id,
    checkoutSource,
    razorpayOrderId: intent.razorpayOrderId,
    paymentId: "payment-parents",
    status: "captured",
    productKey: "memory_masterclass_99",
    amount: 9900,
    currency: "INR",
    trackId,
  };

  const assignmentLookup = jest.fn(
    async () => assignment
  );

  const prisma = {
    memoryMasterclassPurchase: {
      findUnique: jest.fn(async () => purchase),
    },
    memoryMasterclassCheckoutIntent: {
      findUnique: jest.fn(async () => intent),
    },
    memoryAssessmentSession: {
      findUnique: jest.fn(async () => null),
    },
    memoryRetestTrackAssignment: {
      findUnique: assignmentLookup,
    },
  };

  const check = () =>
    resolveMemoryFormBEligibility(
      { trustedPurchaseId: purchase.id },
      { prisma }
    );

  return {
    purchase,
    intent,
    prisma,
    assignmentLookup,
    check,
  };
}

describe("Parents checkout school-track assignment", () => {
  test.each([
    "school_foundation",
    "school_advanced",
  ])(
    "accepts assigned %s for a verified Parents purchase",
    async (assignedTrack) => {
      const f = fixture({
        assignment: {
          purchaseId: "purchase-parents",
          trackId: assignedTrack,
          assignedByAdminId: 7,
        },
      });

      const result = await f.check();

      expect(result).toMatchObject({
        eligible: true,
        purchaseId: "purchase-parents",
        assessmentSessionId: null,
        trackId: assignedTrack,
        formAScore: null,
        formACompletedAt: null,
      });

      expect(f.assignmentLookup).toHaveBeenCalledWith({
        where: { purchaseId: "purchase-parents" },
        select: {
          purchaseId: true,
          trackId: true,
          assignedByAdminId: true,
        },
      });

      expect(f.intent.trackId).toBe("school_unspecified");
      expect(f.purchase.trackId).toBe("school_unspecified");
    }
  );

  test("rejects a purchase without assignment", async () => {
    const f = fixture({ assignment: null });

    expect(await f.check()).toMatchObject({
      eligible: false,
      reason: "TRACK_ASSIGNMENT_REQUIRED",
    });
  });

  test("fails closed when assignment model is unavailable", async () => {
    const f = fixture();

    delete f.prisma.memoryRetestTrackAssignment;

    expect(await f.check()).toMatchObject({
      eligible: false,
      reason: "TRACK_ASSIGNMENT_REQUIRED",
    });
  });

  test.each([
    "school_unspecified",
    "advanced",
    "unknown",
  ])("rejects invalid assigned track %s", async (assignedTrack) => {
    const f = fixture({
      assignment: {
        purchaseId: "purchase-parents",
        trackId: assignedTrack,
        assignedByAdminId: 7,
      },
    });

    expect(await f.check()).toMatchObject({
      eligible: false,
      reason: "TRACK_ASSIGNMENT_INVALID",
    });
  });

  test("rejects assignment for another purchase", async () => {
    const f = fixture({
      assignment: {
        purchaseId: "another-purchase",
        trackId: "school_foundation",
        assignedByAdminId: 7,
      },
    });

    expect(await f.check()).toMatchObject({
      eligible: false,
      reason: "TRACK_ASSIGNMENT_INVALID",
    });
  });

  test.each([0, -1, "7", null])(
    "rejects invalid assigning administrator ID %s",
    async (adminId) => {
      const f = fixture({
        assignment: {
          purchaseId: "purchase-parents",
          trackId: "school_foundation",
          assignedByAdminId: adminId,
        },
      });

      expect(await f.check()).toMatchObject({
        eligible: false,
        reason: "TRACK_ASSIGNMENT_INVALID",
      });
    }
  );

  test("rejects assessment checkout with unspecified track", async () => {
    const f = fixture({
      checkoutSource: "assessment",
    });

    expect(await f.check()).toMatchObject({
      eligible: false,
      reason: "TRACK_MISMATCH",
    });

    expect(f.assignmentLookup).not.toHaveBeenCalled();
  });

  test("preserves purchase and checkout track matching", async () => {
    const f = fixture();

    f.purchase.trackId = "school_advanced";

    expect(await f.check()).toMatchObject({
      eligible: false,
      reason: "TRACK_MISMATCH",
    });

    expect(f.assignmentLookup).not.toHaveBeenCalled();
  });

  test("preserves ordinary specific-track purchases", async () => {
    const f = fixture({
      trackId: "advanced",
    });

    const result = await f.check();

    expect(result).toMatchObject({
      eligible: true,
      trackId: "advanced",
      assessmentSessionId: null,
    });

    expect(f.assignmentLookup).not.toHaveBeenCalled();
  });

  test("rejects uncaptured Parents purchases", async () => {
    const f = fixture();

    f.purchase.status = "authorized";

    expect(await f.check()).toMatchObject({
      eligible: false,
      reason: "PURCHASE_NOT_CAPTURED",
    });

    expect(f.assignmentLookup).not.toHaveBeenCalled();
  });
});
