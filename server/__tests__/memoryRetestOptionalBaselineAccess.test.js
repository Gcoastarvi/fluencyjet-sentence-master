import {
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

import {
  hashMemoryRetestToken,
} from "../services/memoryRetestGrant.js";

import {
  redeemMemoryRetestLink,
} from "../services/memoryRetestRedeem.js";

import {
  validateMemoryRetestSession,
} from "../services/memoryRetestSession.js";

const PURCHASE = "verified-purchase-1";
const LINK = "a".repeat(64);
const SESSION = "b".repeat(64);

const NOW = new Date("2026-10-31T09:00:00Z");
const FUTURE = new Date("2026-11-01T09:00:00Z");

function redemptionFixture({
  baseline = null,
  eligibilityBaseline = baseline,
  eligible = true,
  eligibilityPurchase = PURCHASE,
  redeemedAt = null,
  revokedAt = null,
  linkExpiresAt = FUTURE,
  updateCount = 1,
} = {}) {
  const grant = {
    id: "grant-1",
    purchaseId: PURCHASE,
    assessmentSessionId: baseline,
    linkExpiresAt,
    redeemedAt,
    revokedAt,
    sessionTokenHash: null,
  };

  const findUnique = jest.fn(async () => grant);
  const updateMany = jest.fn(async () => ({
    count: updateCount,
  }));

  const tx = {
    memoryRetestAccessGrant: {
      findUnique,
      updateMany,
    },
  };

  const prisma = {
    $transaction: jest.fn(async (callback) => callback(tx)),
  };

  const eligibilityResolver = jest.fn(async () => ({
    eligible,
    purchaseId: eligibilityPurchase,
    assessmentSessionId: eligibilityBaseline,
    trackId: "school_foundation",
  }));

  const run = () => redeemMemoryRetestLink(
    { linkToken: LINK },
    {
      prisma,
      eligibilityResolver,
      now: () => NOW,
    },
  );

  return {
    run,
    tx,
    findUnique,
    updateMany,
    eligibilityResolver,
  };
}

function sessionFixture({
  baseline = null,
  eligibilityBaseline = baseline,
  eligibilityPurchase = PURCHASE,
  eligible = true,
  redeemedAt = NOW,
  revokedAt = null,
  expiresAt = FUTURE,
  updateCount = 1,
  trackId = "school_foundation",
} = {}) {
  const grant = {
    id: "grant-1",
    purchaseId: PURCHASE,
    assessmentSessionId: baseline,
    sessionTokenHash: hashMemoryRetestToken(SESSION),
    sessionExpiresAt: expiresAt,
    redeemedAt,
    revokedAt,
  };

  const findUnique = jest.fn(async () => grant);
  const updateMany = jest.fn(async () => ({
    count: updateCount,
  }));

  const prisma = {
    memoryRetestAccessGrant: {
      findUnique,
      updateMany,
    },
  };

  const eligibilityResolver = jest.fn(async () => ({
    eligible,
    purchaseId: eligibilityPurchase,
    assessmentSessionId: eligibilityBaseline,
    trackId,
  }));

  const run = () => validateMemoryRetestSession(
    { sessionToken: SESSION },
    {
      prisma,
      eligibilityResolver,
      now: () => NOW,
    },
  );

  return {
    run,
    findUnique,
    updateMany,
    eligibilityResolver,
  };
}

describe("One-time redemption without Form A", () => {
  test("redeems a verified purchase with null baseline", async () => {
    const { run, updateMany } = redemptionFixture();

    const result = await run();

    expect(result.redeemed).toBe(true);
    expect(result.trackId).toBe("school_foundation");
    expect(result.sessionToken).toMatch(/^[a-f0-9]{64}$/);

    expect(result.sessionExpiresAt.getTime())
      .toBeGreaterThan(NOW.getTime());

    expect(updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "grant-1",
        purchaseId: PURCHASE,
        assessmentSessionId: null,
        redeemedAt: null,
        revokedAt: null,
      }),
      data: expect.objectContaining({
        redeemedAt: NOW,
        sessionTokenHash: hashMemoryRetestToken(
          result.sessionToken,
        ),
      }),
    });
  });

  test("preserves Form A-linked redemption", async () => {
    const { run, updateMany } = redemptionFixture({
      baseline: "form-a-1",
    });

    const result = await run();

    expect(result.redeemed).toBe(true);

    expect(updateMany.mock.calls[0][0].where)
      .toMatchObject({
        assessmentSessionId: "form-a-1",
      });
  });

  test("rejects mismatched baseline association", async () => {
    const { run, updateMany } = redemptionFixture({
      baseline: null,
      eligibilityBaseline: "another-assessment",
    });

    const result = await run();

    expect(result.redeemed).toBe(false);
    expect(updateMany).not.toHaveBeenCalled();
  });

  test("rejects mismatched purchase identity", async () => {
    const { run, updateMany } = redemptionFixture({
      eligibilityPurchase: "another-purchase",
    });

    const result = await run();

    expect(result.redeemed).toBe(false);
    expect(updateMany).not.toHaveBeenCalled();
  });

  test("rejects reused one-time link", async () => {
    const { run, updateMany } = redemptionFixture({
      redeemedAt: NOW,
    });

    const result = await run();

    expect(result.redeemed).toBe(false);
    expect(updateMany).not.toHaveBeenCalled();
  });

  test("rejects revoked link", async () => {
    const { run, updateMany } = redemptionFixture({
      revokedAt: NOW,
    });

    const result = await run();

    expect(result.redeemed).toBe(false);
    expect(updateMany).not.toHaveBeenCalled();
  });

  test("rejects expired link", async () => {
    const { run, updateMany } = redemptionFixture({
      linkExpiresAt: NOW,
    });

    const result = await run();

    expect(result.redeemed).toBe(false);
    expect(updateMany).not.toHaveBeenCalled();
  });

  test("rejects atomic redemption conflict", async () => {
    const { run, updateMany } = redemptionFixture({
      updateCount: 0,
    });

    const result = await run();

    expect(result.redeemed).toBe(false);
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});

describe("Authenticated session without Form A", () => {
  test("validates a null-baseline session", async () => {
    const { run, updateMany } = sessionFixture();

    const result = await run();

    expect(result).toMatchObject({
      valid: true,
      assessmentSessionId: null,
      trackId: "school_foundation",
    });

    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  test("preserves Form A-linked sessions", async () => {
    const { run } = sessionFixture({
      baseline: "form-a-1",
    });

    const result = await run();

    expect(result).toMatchObject({
      valid: true,
      assessmentSessionId: "form-a-1",
      trackId: "school_foundation",
    });
  });

  test("rejects mismatched assessment linkage", async () => {
    const { run, updateMany } = sessionFixture({
      baseline: null,
      eligibilityBaseline: "another-assessment",
    });

    const result = await run();

    expect(result.valid).toBe(false);
    expect(updateMany).not.toHaveBeenCalled();
  });

  test("rejects expired sessions", async () => {
    const { run, updateMany } = sessionFixture({
      expiresAt: NOW,
    });

    const result = await run();

    expect(result.valid).toBe(false);
    expect(updateMany).not.toHaveBeenCalled();
  });

  test("rejects revoked sessions", async () => {
    const { run, updateMany } = sessionFixture({
      revokedAt: NOW,
    });

    const result = await run();

    expect(result.valid).toBe(false);
    expect(updateMany).not.toHaveBeenCalled();
  });

  test("rejects invalid assessment track", async () => {
    const { run, updateMany } = sessionFixture({
      trackId: "invalid_track",
    });

    const result = await run();

    expect(result.valid).toBe(false);
    expect(updateMany).not.toHaveBeenCalled();
  });

  test("rejects session update conflict", async () => {
    const { run, updateMany } = sessionFixture({
      updateCount: 0,
    });

    const result = await run();

    expect(result.valid).toBe(false);
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});
