import { jest } from "@jest/globals";
import {
  redeemMemoryRetestLink,
} from "../services/memoryRetestRedeem.js";
import {
  hashMemoryRetestToken,
} from "../services/memoryRetestGrant.js";

const NOW = new Date("2026-10-31T00:00:00.000Z");
const LINK = "a".repeat(64);

function setup(trackId = "school_foundation") {
  const grant = {
    id: "grant-1",
    purchaseId: "purchase-1",
    assessmentSessionId: "assessment-1",
    linkExpiresAt: new Date("2026-11-07T00:00:00Z"),
    redeemedAt: null,
    revokedAt: null,
    sessionTokenHash: null,
  };

  const db = {
    memoryRetestAccessGrant: {
      findUnique: jest.fn(async () => grant),
      updateMany: jest.fn(async ({ data }) => {
        if (
          grant.redeemedAt ||
          grant.revokedAt ||
          grant.sessionTokenHash ||
          grant.linkExpiresAt <= NOW
        ) {
          return { count: 0 };
        }

        Object.assign(grant, data);
        return { count: 1 };
      }),
    },
  };

  const prisma = {
    $transaction: jest.fn(async callback => callback(db)),
  };

  const eligibilityResolver = jest.fn(async () => ({
    eligible: true,
    purchaseId: "purchase-1",
    assessmentSessionId: "assessment-1",
    trackId,
    formAScore: 42,
  }));

  const redeem = (token = LINK) =>
    redeemMemoryRetestLink(
      { linkToken: token },
      {
        prisma,
        eligibilityResolver,
        now: () => new Date(NOW),
      }
    );

  return {
    grant,
    db,
    prisma,
    eligibilityResolver,
    redeem,
  };
}

describe("Secure Memory Form B redemption", () => {
  test.each([
    "school_foundation",
    "school_advanced",
    "advanced",
  ])("redeems a valid %s link", async (trackId) => {
    const f = setup(trackId);
    const result = await f.redeem();

    expect(result.redeemed).toBe(true);
    expect(result.trackId).toBe(trackId);
    expect(result.sessionToken).toMatch(/^[a-f0-9]{64}$/);

    expect(f.grant.sessionTokenHash).toBe(
      hashMemoryRetestToken(result.sessionToken)
    );

    expect(f.grant.sessionTokenHash).not.toBe(
      result.sessionToken
    );

    expect(result.sessionToken).not.toBe(LINK);

    expect(result.sessionExpiresAt.toISOString()).toBe(
      "2026-10-31T12:00:00.000Z"
    );

    expect(f.eligibilityResolver).toHaveBeenCalledWith(
      { trustedPurchaseId: "purchase-1" },
      { prisma: f.db }
    );
  });

  test("rejects malformed tokens before database lookup", async () => {
    const f = setup();
    const result = await f.redeem("invalid");

    expect(result.redeemed).toBe(false);
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });

  test("rejects unknown links", async () => {
    const f = setup();
    f.db.memoryRetestAccessGrant.findUnique
      .mockResolvedValue(null);

    expect((await f.redeem()).redeemed).toBe(false);
  });

  test("rejects expired links", async () => {
    const f = setup();
    f.grant.linkExpiresAt =
      new Date("2026-10-30T00:00:00Z");

    expect((await f.redeem()).redeemed).toBe(false);
  });

  test("rejects revoked links", async () => {
    const f = setup();
    f.grant.revokedAt = new Date(NOW);

    expect((await f.redeem()).redeemed).toBe(false);
  });

  test("rejects previously redeemed links", async () => {
    const f = setup();
    f.grant.redeemedAt = new Date(NOW);

    expect((await f.redeem()).redeemed).toBe(false);
  });

  test("rejects previously assigned sessions", async () => {
    const f = setup();
    f.grant.sessionTokenHash = "b".repeat(64);

    expect((await f.redeem()).redeemed).toBe(false);
  });

  test("rejects ineligible purchases", async () => {
    const f = setup();
    f.eligibilityResolver.mockResolvedValue({
      eligible: false,
      reason: "PURCHASE_NOT_CAPTURED",
    });

    expect((await f.redeem()).redeemed).toBe(false);
    expect(f.db.memoryRetestAccessGrant.updateMany)
      .not.toHaveBeenCalled();
  });

  test("rejects mismatched original assessments", async () => {
    const f = setup();
    f.eligibilityResolver.mockResolvedValue({
      eligible: true,
      purchaseId: "purchase-1",
      assessmentSessionId: "another-assessment",
      trackId: "school_foundation",
    });

    expect((await f.redeem()).redeemed).toBe(false);
  });

  test("second redemption fails", async () => {
    const f = setup();

    const first = await f.redeem();
    const second = await f.redeem();

    expect(first.redeemed).toBe(true);
    expect(second.redeemed).toBe(false);
  });

  test("simultaneous redemption permits only one", async () => {
    const f = setup();

    const results = await Promise.all([
      f.redeem(),
      f.redeem(),
    ]);

    expect(results.filter(r => r.redeemed)).toHaveLength(1);
  });

  test("rejects an atomic update conflict", async () => {
    const f = setup();
    f.db.memoryRetestAccessGrant.updateMany
      .mockResolvedValue({ count: 0 });

    const result = await f.redeem();

    expect(result.redeemed).toBe(false);
    expect(result.sessionToken).toBeUndefined();
  });

  test("propagates database errors", async () => {
    const f = setup();
    f.db.memoryRetestAccessGrant.findUnique
      .mockRejectedValue(new Error("Database unavailable"));

    await expect(f.redeem()).rejects.toThrow(
      "Database unavailable"
    );
  });

  test("rejects missing Prisma dependency", async () => {
    await expect(
      redeemMemoryRetestLink({ linkToken: LINK }, {})
    ).rejects.toThrow(TypeError);
  });
});
