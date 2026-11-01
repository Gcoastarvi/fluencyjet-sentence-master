import {
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

const mockIssue = jest.fn();
const mockRevoke = jest.fn();

jest.unstable_mockModule(
  "../services/memoryRetestGrant.js",
  () => ({
    issueMemoryRetestGrant: mockIssue,
  }),
);

jest.unstable_mockModule(
  "../services/memoryRetestRevoke.js",
  () => ({
    revokeMemoryRetestGrants: mockRevoke,
  }),
);

jest.unstable_mockModule(
  "../services/memoryFormBEligibility.js",
  () => ({
    resolveMemoryFormBEligibility: jest.fn(),
  }),
);

const { replaceMemoryRetestGrant } =
  await import("../services/memoryRetestReplace.js");

const PURCHASE_ID = "verified-purchase-1";

const NOW = new Date(
  "2026-10-31T09:00:00.000Z"
);

const EXPIRES = new Date(
  "2026-11-01T09:00:00.000Z"
);

function setup({
  assessmentSessionId = null,
  purchaseId = PURCHASE_ID,
  eligible = true,
  reason = undefined,
} = {}) {
  const tx = {};

  const prisma = {
    $transaction: jest.fn(async (callback) => callback(tx)),
  };

  const eligibilityResolver = jest.fn(async () => ({
    eligible,
    purchaseId,
    assessmentSessionId,
    trackId: "school_foundation",
    reason,
  }));

  const run = () => replaceMemoryRetestGrant(
    {
      trustedPurchaseId: PURCHASE_ID,
      linkExpiresAt: EXPIRES,
    },
    {
      prisma,
      eligibilityResolver,
      now: () => NOW,
    },
  );

  return {
    run,
    tx,
    prisma,
    eligibilityResolver,
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  mockRevoke.mockResolvedValue({
    revokedCount: 1,
  });

  mockIssue.mockResolvedValue({
    issued: true,
    grantId: "new-grant",
    linkToken: "a".repeat(64),
    linkExpiresAt: EXPIRES,
  });
});

describe("Form B replacement with optional baseline", () => {
  test("replaces link for direct purchase without Form A", async () => {
    const {
      run,
      tx,
      prisma,
      eligibilityResolver,
    } = setup();

    const result = await run();

    expect(result).toMatchObject({
      issued: true,
      grantId: "new-grant",
      revokedCount: 1,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    expect(eligibilityResolver).toHaveBeenCalledWith(
      { trustedPurchaseId: PURCHASE_ID },
      { prisma: tx },
    );

    expect(mockRevoke).toHaveBeenCalledWith(
      { trustedPurchaseId: PURCHASE_ID },
      {
        prisma: tx,
        now: expect.any(Function),
      },
    );

    expect(mockIssue).toHaveBeenCalledWith(
      {
        trustedPurchaseId: PURCHASE_ID,
        linkExpiresAt: EXPIRES,
      },
      {
        prisma: tx,
        eligibilityResolver: expect.any(Function),
        now: expect.any(Function),
      },
    );
  });

  test("preserves replacement for Form A-linked purchase", async () => {
    const { run, eligibilityResolver } = setup({
      assessmentSessionId: "form-a-123",
    });

    const result = await run();

    expect(result.issued).toBe(true);

    const passedResolver =
      mockIssue.mock.calls[0][1].eligibilityResolver;

    const passedEligibility = await passedResolver();

    expect(passedEligibility).toMatchObject({
      assessmentSessionId: "form-a-123",
      purchaseId: PURCHASE_ID,
    });

    expect(eligibilityResolver).toHaveBeenCalledTimes(1);
  });

  test("passes explicit null baseline to issuer", async () => {
    const { run } = setup();

    await run();

    const passedResolver =
      mockIssue.mock.calls[0][1].eligibilityResolver;

    const passedEligibility = await passedResolver();

    expect(passedEligibility.assessmentSessionId)
      .toBeNull();
  });

  test("rejects mismatched purchase identity", async () => {
    const { run } = setup({
      purchaseId: "another-purchase",
    });

    await expect(run()).rejects.toThrow(
      "Inconsistent retest purchase eligibility",
    );

    expect(mockRevoke).not.toHaveBeenCalled();
    expect(mockIssue).not.toHaveBeenCalled();
  });

  test("rejects truly missing baseline field", async () => {
    const { run, eligibilityResolver } = setup();

    eligibilityResolver.mockResolvedValueOnce({
      eligible: true,
      purchaseId: PURCHASE_ID,
      trackId: "school_foundation",
    });

    await expect(run()).rejects.toThrow(
      "Inconsistent retest purchase eligibility",
    );

    expect(mockRevoke).not.toHaveBeenCalled();
    expect(mockIssue).not.toHaveBeenCalled();
  });

  test("rejects blank assessment identifier", async () => {
    const { run } = setup({
      assessmentSessionId: "",
    });

    await expect(run()).rejects.toThrow(
      "Inconsistent retest purchase eligibility",
    );

    expect(mockRevoke).not.toHaveBeenCalled();
    expect(mockIssue).not.toHaveBeenCalled();
  });

  test("rejects malformed assessment identifier", async () => {
    const { run } = setup({
      assessmentSessionId: 123,
    });

    await expect(run()).rejects.toThrow(
      "Inconsistent retest purchase eligibility",
    );

    expect(mockRevoke).not.toHaveBeenCalled();
    expect(mockIssue).not.toHaveBeenCalled();
  });

  test("does not replace link for ineligible purchase", async () => {
    const { run } = setup({
      eligible: false,
      reason: "PURCHASE_NOT_CAPTURED",
    });

    const result = await run();

    expect(result).toEqual({
      issued: false,
      reason: "PURCHASE_NOT_CAPTURED",
    });

    expect(mockRevoke).not.toHaveBeenCalled();
    expect(mockIssue).not.toHaveBeenCalled();
  });

  test("rejects expiry beyond permitted window", async () => {
    const { prisma, eligibilityResolver } = setup();

    await expect(
      replaceMemoryRetestGrant(
        {
          trustedPurchaseId: PURCHASE_ID,
          linkExpiresAt: new Date(
            "2026-12-15T09:00:00.000Z"
          ),
        },
        {
          prisma,
          eligibilityResolver,
          now: () => NOW,
        },
      )
    ).rejects.toThrow(RangeError);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(mockIssue).not.toHaveBeenCalled();
  });
});
