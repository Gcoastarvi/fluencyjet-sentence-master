import {
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

import {
  resolveMemoryFormBEligibility,
} from "../services/memoryFormBEligibility.js";

function fixture({
  source = "standalone_vsl",
  purchasePatch = {},
  intentPatch = {},
  assessmentPatch = {},
} = {}) {
  const purchase = {
    id: "purchase-1",
    status: "captured",
    productKey: "memory_masterclass_99",
    amount: 9900,
    currency: "INR",
    checkoutSource: source,
    paymentId: "pay_verified",
    razorpayOrderId: "order_verified",
    checkoutIntentId: "intent-1",
    trackId: "school_foundation",
    ...purchasePatch,
  };

  const intent = {
    id: "intent-1",
    razorpayOrderId: "order_verified",
    productKey: "memory_masterclass_99",
    amount: 9900,
    currency: "INR",
    checkoutSource: source,
    trackId: "school_foundation",
    memoryAssessmentSessionId:
      source === "assessment" ? "assessment-1" : null,
    ...intentPatch,
  };

  const assessment = {
    id: "assessment-1",
    trackId: "school_foundation",
    status: "FORM_A_COMPLETED",
    formACompletedAt: new Date("2026-10-30T10:00:00Z"),
    formAScore: 72,
    formAAnswers: {
      immediateAnswers: [],
    },
    formAResult: {
      form: "A",
      trackId: "school_foundation",
      totalScore: 72,
      maxScore: 100,
      modules: {
        immediate: {},
        ordered: {},
        association: {},
        academic: {},
        delayed: {},
      },
    },
    ...assessmentPatch,
  };

  const prisma = {
    memoryMasterclassPurchase: {
      findUnique: jest.fn(async () => purchase),
    },
    memoryMasterclassCheckoutIntent: {
      findUnique: jest.fn(async () => intent),
    },
    memoryAssessmentSession: {
      findUnique: jest.fn(async () => assessment),
    },
  };

  return prisma;
}

async function check(prisma) {
  return resolveMemoryFormBEligibility(
    { trustedPurchaseId: "purchase-1" },
    { prisma },
  );
}

describe("Optional Form A purchase eligibility", () => {
  test("accepts captured direct purchase without Form A", async () => {
    const prisma = fixture();
    const result = await check(prisma);

    expect(result).toMatchObject({
      eligible: true,
      purchaseId: "purchase-1",
      checkoutIntentId: "intent-1",
      assessmentSessionId: null,
      trackId: "school_foundation",
      formAScore: null,
    });

    expect(
      prisma.memoryAssessmentSession.findUnique
    ).not.toHaveBeenCalled();
  });

  test("accepts direct advanced learner track", async () => {
    const prisma = fixture({
      purchasePatch: { trackId: "advanced" },
      intentPatch: { trackId: "advanced" },
    });

    const result = await check(prisma);

    expect(result.eligible).toBe(true);
    expect(result.trackId).toBe("advanced");
    expect(result.assessmentSessionId).toBeNull();
  });

  test("preserves valid Form A purchase eligibility", async () => {
    const prisma = fixture({
      source: "assessment",
    });

    const result = await check(prisma);

    expect(result).toMatchObject({
      eligible: true,
      purchaseId: "purchase-1",
      assessmentSessionId: "assessment-1",
      trackId: "school_foundation",
      formAScore: 72,
    });

    expect(
      prisma.memoryAssessmentSession.findUnique
    ).toHaveBeenCalledWith({
      where: { id: "assessment-1" },
    });
  });

  test("rejects a purchase that was not captured", async () => {
    const result = await check(fixture({
      purchasePatch: { status: "created" },
    }));

    expect(result).toEqual({
      eligible: false,
      reason: "PURCHASE_NOT_CAPTURED",
    });
  });

  test("rejects missing verified payment ID", async () => {
    const result = await check(fixture({
      purchasePatch: { paymentId: null },
    }));

    expect(result.eligible).toBe(false);
  });

  test("rejects incorrect payment amount", async () => {
    const result = await check(fixture({
      purchasePatch: { amount: 100 },
    }));

    expect(result.eligible).toBe(false);
  });

  test("rejects unsupported checkout sources", async () => {
    const result = await check(fixture({
      source: "unknown_source",
    }));

    expect(result.eligible).toBe(false);
  });

  test("rejects mismatched purchase and intent sources", async () => {
    const result = await check(fixture({
      intentPatch: { checkoutSource: "assessment" },
    }));

    expect(result.eligible).toBe(false);
  });

  test("rejects direct checkout with unexpected baseline link", async () => {
    const result = await check(fixture({
      intentPatch: {
        memoryAssessmentSessionId: "assessment-1",
      },
    }));

    expect(result).toEqual({
      eligible: false,
      reason: "CHECKOUT_INTENT_MISMATCH",
    });
  });

  test("rejects direct checkout with mismatched track", async () => {
    const result = await check(fixture({
      purchasePatch: { trackId: "advanced" },
    }));

    expect(result).toEqual({
      eligible: false,
      reason: "TRACK_MISMATCH",
    });
  });

  test("rejects unsupported student track", async () => {
    const result = await check(fixture({
      intentPatch: { trackId: "invalid_track" },
    }));

    expect(result.eligible).toBe(false);
  });

  test("rejects mismatched Razorpay order", async () => {
    const result = await check(fixture({
      intentPatch: {
        razorpayOrderId: "order_different",
      },
    }));

    expect(result.eligible).toBe(false);
  });

  test("still rejects assessment purchase without Form A", async () => {
    const result = await check(fixture({
      source: "assessment",
      intentPatch: {
        memoryAssessmentSessionId: null,
      },
    }));

    expect(result).toEqual({
      eligible: false,
      reason: "ASSESSMENT_NOT_LINKED",
    });
  });

  test("still rejects invalid Form A baseline", async () => {
    const result = await check(fixture({
      source: "assessment",
      assessmentPatch: {
        formAScore: null,
      },
    }));

    expect(result).toEqual({
      eligible: false,
      reason: "FORM_A_RESULT_INVALID",
    });
  });
});
