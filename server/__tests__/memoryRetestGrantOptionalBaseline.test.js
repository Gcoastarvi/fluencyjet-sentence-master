import {
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

import {
  hashMemoryRetestToken,
  issueMemoryRetestGrant,
} from "../services/memoryRetestGrant.js";

const PURCHASE_ID = "verified-purchase-1";
const NOW = new Date("2026-10-31T08:00:00.000Z");
const EXPIRES = new Date("2026-11-01T08:00:00.000Z");

function setup({
  eligible = true,
  purchaseId = PURCHASE_ID,
  assessmentSessionId = null,
  trackId = "school_foundation",
} = {}) {
  const create = jest.fn(async () => ({
    id: "grant-1",
  }));

  const prisma = {
    memoryRetestAccessGrant: { create },
  };

  const eligibilityResolver = jest.fn(async () => ({
    eligible,
    purchaseId,
    assessmentSessionId,
    trackId,
  }));

  const run = () => issueMemoryRetestGrant(
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

  return { run, create, eligibilityResolver };
}

describe("Form B grant issuance with optional baseline", () => {
  test("issues grant for eligible purchase without Form A", async () => {
    const { run, create, eligibilityResolver } = setup();

    const result = await run();

    expect(result.issued).toBe(true);
    expect(result.grantId).toBe("grant-1");
    expect(result.linkToken).toMatch(/^[a-f0-9]{64}$/);

    expect(eligibilityResolver).toHaveBeenCalledWith(
      { trustedPurchaseId: PURCHASE_ID },
      { prisma: expect.any(Object) },
    );

    expect(create).toHaveBeenCalledTimes(1);

    const data = create.mock.calls[0][0].data;

    expect(data.purchaseId).toBe(PURCHASE_ID);
    expect(data.assessmentSessionId).toBeNull();
    expect(data.tokenHash).toBe(
      hashMemoryRetestToken(result.linkToken),
    );

    expect(data.tokenHash).not.toBe(result.linkToken);
  });

  test("preserves assessment-linked grant issuance", async () => {
    const { run, create } = setup({
      assessmentSessionId: "form-a-session-1",
    });

    const result = await run();

    expect(result.issued).toBe(true);

    expect(create.mock.calls[0][0].data)
      .toMatchObject({
        purchaseId: PURCHASE_ID,
        assessmentSessionId: "form-a-session-1",
      });
  });

  test("does not issue grant for ineligible purchase", async () => {
    const { run, create } = setup({
      eligible: false,
    });

    const result = await run();

    expect(result.issued).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  test("rejects unexpected missing baseline field", async () => {
    const { run, create, eligibilityResolver } = setup();

    // Return a deliberately malformed eligibility response.
    // The assessmentSessionId property is truly absent,
    // rather than replaced by the helper's null default.
    eligibilityResolver.mockResolvedValueOnce({
      eligible: true,
      purchaseId: PURCHASE_ID,
      trackId: "school_foundation",
    });

    await expect(run()).rejects.toThrow(
      "Incomplete eligibility result",
    );

    expect(create).not.toHaveBeenCalled();
  });

  test("rejects empty assessment identifier", async () => {
    const { run, create } = setup({
      assessmentSessionId: "",
    });

    await expect(run()).rejects.toThrow(
      "Incomplete eligibility result",
    );

    expect(create).not.toHaveBeenCalled();
  });

  test("rejects whitespace-only assessment ID", async () => {
    const { run, create } = setup({
      assessmentSessionId: "   ",
    });

    await expect(run()).rejects.toThrow(
      "Incomplete eligibility result",
    );

    expect(create).not.toHaveBeenCalled();
  });

  test("rejects wrong purchase identity", async () => {
    const { run, create } = setup({
      purchaseId: "different-purchase",
    });

    await expect(run()).rejects.toThrow(
      "Incomplete eligibility result",
    );

    expect(create).not.toHaveBeenCalled();
  });

  test("rejects malformed assessment identifier type", async () => {
    const { run, create } = setup({
      assessmentSessionId: 12345,
    });

    await expect(run()).rejects.toThrow(
      "Incomplete eligibility result",
    );

    expect(create).not.toHaveBeenCalled();
  });
});
