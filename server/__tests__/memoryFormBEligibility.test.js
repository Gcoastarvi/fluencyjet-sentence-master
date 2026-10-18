import { jest } from "@jest/globals";
import { resolveMemoryFormBEligibility } from "../services/memoryFormBEligibility.js";

const TRACKS = [
  "school_foundation",
  "school_advanced",
  "advanced",
];

function setup(trackId = "school_foundation") {
  const assessment = {
    id: "assessment-1",
    trackId,
    status: "LEAD_CAPTURED",
    formACompletedAt: new Date("2026-10-01T10:00:00Z"),
    formAScore: 42.5,
    formAAnswers: { immediate: [], ordered: [], association: [], academic: [], delayed: [] },
    formAResult: {
      form: "A",
      trackId,
      maxScore: 100,
      totalScore: 42.5,
      modules: {
        immediate: {},
        ordered: {},
        association: {},
        academic: {},
        delayed: {},
      },
    },
  };

  const intent = {
    id: "intent-1",
    memoryAssessmentSessionId: assessment.id,
    checkoutSource: "assessment",
    razorpayOrderId: "order-1",
    productKey: "memory_masterclass_99",
    amount: 9900,
    currency: "INR",
    trackId,
  };

  const purchase = {
    id: "purchase-1",
    checkoutIntentId: intent.id,
    checkoutSource: "assessment",
    razorpayOrderId: intent.razorpayOrderId,
    paymentId: "payment-1",
    status: "captured",
    productKey: "memory_masterclass_99",
    amount: 9900,
    currency: "INR",
    trackId,
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

  return { purchase, intent, assessment, prisma };
}

function check(fixture) {
  return resolveMemoryFormBEligibility(
    { trustedPurchaseId: "purchase-1" },
    { prisma: fixture.prisma },
  );
}

describe("Internal Memory Form B eligibility", () => {
  test.each(TRACKS)("accepts linked purchase for %s", async (trackId) => {
    const f = setup(trackId);
    const result = await check(f);

    expect(result).toMatchObject({
      eligible: true,
      purchaseId: "purchase-1",
      assessmentSessionId: "assessment-1",
      trackId,
      formAScore: 42.5,
    });

    expect(f.prisma.memoryMasterclassPurchase.findUnique)
      .toHaveBeenCalledWith({ where: { id: "purchase-1" } });

    expect(Object.keys(result).sort()).toEqual([
      "eligible", "purchaseId", "checkoutIntentId",
      "assessmentSessionId", "trackId",
      "formAScore", "formACompletedAt",
    ].sort());
  });

  test("accepts legitimate zero score", async () => {
    const f = setup();
    f.assessment.formAScore = 0;
    f.assessment.formAResult.totalScore = 0;

    expect((await check(f)).eligible).toBe(true);
  });

  test("accepts historical nullable purchase track", async () => {
    const f = setup();
    f.purchase.trackId = null;

    expect((await check(f)).eligible).toBe(true);
  });

  test("accepts completed assessment status", async () => {
    const f = setup();
    f.assessment.status = "FORM_A_COMPLETED";

    expect((await check(f)).eligible).toBe(true);
  });

  test("rejects missing purchase", async () => {
    const f = setup();
    f.prisma.memoryMasterclassPurchase.findUnique.mockResolvedValue(null);

    expect((await check(f)).eligible).toBe(false);
  });

  test.each([
    ["uncaptured payment", f => { f.purchase.status = "authorized"; }],
    ["wrong product", f => { f.purchase.productKey = "other"; }],
    ["wrong amount", f => { f.purchase.amount = 100; }],
    ["wrong currency", f => { f.purchase.currency = "USD"; }],
    ["standalone purchase", f => { f.purchase.checkoutSource = "standalone_vsl"; }],
    ["missing payment ID", f => { f.purchase.paymentId = ""; }],
    ["wrong order ID", f => { f.intent.razorpayOrderId = "different-order"; }],
    ["wrong intent product", f => { f.intent.productKey = "other"; }],
    ["wrong intent amount", f => { f.intent.amount = 100; }],
    ["wrong intent currency", f => { f.intent.currency = "USD"; }],
    ["unlinked assessment", f => { f.intent.memoryAssessmentSessionId = null; }],
    ["parents unspecified track", f => { f.intent.trackId = "school_unspecified"; }],
    ["purchase track mismatch", f => { f.purchase.trackId = "advanced"; }],
    ["assessment track mismatch", f => { f.assessment.trackId = "advanced"; }],
    ["unfinished assessment", f => { f.assessment.status = "IN_PROGRESS"; }],
    ["missing completion date", f => { f.assessment.formACompletedAt = null; }],
    ["wrong result form", f => { f.assessment.formAResult.form = "B"; }],
    ["wrong result track", f => { f.assessment.formAResult.trackId = "advanced"; }],
    ["invalid maximum score", f => { f.assessment.formAResult.maxScore = 50; }],
    ["score disagreement", f => { f.assessment.formAResult.totalScore = 71; }],
    ["missing original answers", f => { f.assessment.formAAnswers = null; }],
    ["incomplete module results", f => { f.assessment.formAResult.modules = {}; }],
  ])("rejects %s", async (_label, change) => {
    const f = setup();
    change(f);

    const result = await check(f);
    expect(result.eligible).toBe(false);
  });

  test("rejects missing linked assessment record", async () => {
    const f = setup();
    f.prisma.memoryAssessmentSession.findUnique.mockResolvedValue(null);

    expect((await check(f)).eligible).toBe(false);
  });

  test("rejects missing checkout intent", async () => {
    const f = setup();
    f.prisma.memoryMasterclassCheckoutIntent.findUnique.mockResolvedValue(null);

    expect((await check(f)).eligible).toBe(false);
  });

  test("does not accept missing purchase ID", async () => {
    const f = setup();

    const result = await resolveMemoryFormBEligibility(
      {},
      { prisma: f.prisma },
    );

    expect(result.eligible).toBe(false);
    expect(f.prisma.memoryMasterclassPurchase.findUnique)
      .not.toHaveBeenCalled();
  });

  test("propagates database errors", async () => {
    const f = setup();
    f.prisma.memoryMasterclassPurchase.findUnique
      .mockRejectedValue(new Error("Database unavailable"));

    await expect(check(f)).rejects.toThrow("Database unavailable");
  });

  test("rejects when Prisma dependency is missing", async () => {
    await expect(
      resolveMemoryFormBEligibility(
        { trustedPurchaseId: "purchase-1" },
        {},
      ),
    ).rejects.toThrow();
  });
});
