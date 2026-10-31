import { jest } from "@jest/globals";
import {
  validateMemoryRetestSession,
} from "../services/memoryRetestSession.js";
import {
  hashMemoryRetestToken,
} from "../services/memoryRetestGrant.js";

const NOW = new Date("2026-10-31T08:00:00.000Z");
const TOKEN = "c".repeat(64);
const HASH = hashMemoryRetestToken(TOKEN);

function setup(trackId = "school_foundation") {
  const grant = {
    id: "grant-1",
    purchaseId: "purchase-1",
    assessmentSessionId: "assessment-1",
    sessionTokenHash: HASH,
    sessionExpiresAt: new Date("2026-10-31T12:00:00Z"),
    redeemedAt: new Date("2026-10-31T07:00:00Z"),
    revokedAt: null,
    lastUsedAt: null,
  };

  const prisma = {
    memoryRetestAccessGrant: {
      findUnique: jest.fn(async () => grant),
      updateMany: jest.fn(async ({ where, data }) => {
        if (
          grant.id !== where.id ||
          grant.sessionTokenHash !== where.sessionTokenHash ||
          !grant.redeemedAt ||
          grant.revokedAt ||
          grant.sessionExpiresAt <= NOW
        ) {
          return { count: 0 };
        }

        grant.lastUsedAt = data.lastUsedAt;
        return { count: 1 };
      }),
    },
  };

  const eligibilityResolver = jest.fn(async () => ({
    eligible: true,
    purchaseId: "purchase-1",
    assessmentSessionId: "assessment-1",
    trackId,
    formAScore: 42,
  }));

  const validate = (...args) =>
    validateMemoryRetestSession(
      { sessionToken: args.length ? args[0] : TOKEN },
      {
        prisma,
        eligibilityResolver,
        now: () => new Date(NOW),
        ...(args[1] ?? {}),
      },
    );

  return {
    grant,
    prisma,
    eligibilityResolver,
    validate,
  };
}

describe("Secure Form B session validation", () => {
  test.each([
    "school_foundation",
    "school_advanced",
    "advanced",
  ])("validates an authorized %s session", async (track) => {
    const f = setup(track);
    const result = await f.validate();

    expect(result).toEqual({
      valid: true,
      assessmentSessionId: "assessment-1",
      trackId: track,
    });

    expect(f.grant.lastUsedAt).toEqual(NOW);

    expect(f.eligibilityResolver).toHaveBeenCalledWith(
      { trustedPurchaseId: "purchase-1" },
      { prisma: f.prisma },
    );
  });

  test("looks up only the hashed session token", async () => {
    const f = setup();

    await f.validate();

    expect(
      f.prisma.memoryRetestAccessGrant.findUnique
    ).toHaveBeenCalledWith({
      where: { sessionTokenHash: HASH },
      select: expect.objectContaining({
        assessmentSessionId: true,
        purchaseId: true,
        revokedAt: true,
      }),
    });

    expect(HASH).not.toBe(TOKEN);
  });

  test.each([
    "",
    "invalid",
    "C".repeat(64),
    "c".repeat(63),
    null,
    undefined,
  ])("rejects malformed token %s", async (token) => {
    const f = setup();

    const result = await f.validate(token);

    expect(result.valid).toBe(false);
    expect(
      f.prisma.memoryRetestAccessGrant.findUnique
    ).not.toHaveBeenCalled();
  });

  test("rejects unknown sessions", async () => {
    const f = setup();

    f.prisma.memoryRetestAccessGrant.findUnique
      .mockResolvedValue(null);

    expect((await f.validate()).valid).toBe(false);
  });

  test("rejects a stored hash mismatch", async () => {
    const f = setup();
    f.grant.sessionTokenHash = "d".repeat(64);

    expect((await f.validate()).valid).toBe(false);
  });

  test("rejects unredeemed grants", async () => {
    const f = setup();
    f.grant.redeemedAt = null;

    expect((await f.validate()).valid).toBe(false);
  });

  test("rejects revoked sessions", async () => {
    const f = setup();
    f.grant.revokedAt = new Date(NOW);

    expect((await f.validate()).valid).toBe(false);
  });

  test("rejects expired sessions", async () => {
    const f = setup();

    f.grant.sessionExpiresAt =
      new Date("2026-10-31T07:59:59Z");

    expect((await f.validate()).valid).toBe(false);
  });

  test("rejects expiry at the exact boundary", async () => {
    const f = setup();
    f.grant.sessionExpiresAt = new Date(NOW);

    expect((await f.validate()).valid).toBe(false);
  });

  test("rejects invalid expiry dates", async () => {
    const f = setup();
    f.grant.sessionExpiresAt = "invalid-date";

    expect((await f.validate()).valid).toBe(false);
  });

  test("rejects an ineligible purchase", async () => {
    const f = setup();

    f.eligibilityResolver.mockResolvedValue({
      eligible: false,
      reason: "PURCHASE_NOT_CAPTURED",
    });

    expect((await f.validate()).valid).toBe(false);

    expect(
      f.prisma.memoryRetestAccessGrant.updateMany
    ).not.toHaveBeenCalled();
  });

  test("rejects a mismatched purchase", async () => {
    const f = setup();

    f.eligibilityResolver.mockResolvedValue({
      eligible: true,
      purchaseId: "different-purchase",
      assessmentSessionId: "assessment-1",
      trackId: "school_foundation",
    });

    expect((await f.validate()).valid).toBe(false);
  });

  test("rejects a mismatched Form A assessment", async () => {
    const f = setup();

    f.eligibilityResolver.mockResolvedValue({
      eligible: true,
      purchaseId: "purchase-1",
      assessmentSessionId: "different-assessment",
      trackId: "school_foundation",
    });

    expect((await f.validate()).valid).toBe(false);
  });

  test("rejects unsupported tracks", async () => {
    const f = setup("school_unspecified");

    expect((await f.validate()).valid).toBe(false);
  });

  test("rejects a session revoked during validation", async () => {
    const f = setup();

    f.prisma.memoryRetestAccessGrant.updateMany
      .mockImplementation(async () => {
        f.grant.revokedAt = new Date(NOW);
        return { count: 0 };
      });

    const result = await f.validate();

    expect(result.valid).toBe(false);
    expect(result.assessmentSessionId).toBeUndefined();
  });

  test("rejects a conditional database update conflict", async () => {
    const f = setup();

    f.prisma.memoryRetestAccessGrant.updateMany
      .mockResolvedValue({ count: 0 });

    expect((await f.validate()).valid).toBe(false);
  });

  test("propagates database failures", async () => {
    const f = setup();

    f.prisma.memoryRetestAccessGrant.findUnique
      .mockRejectedValue(new Error("Database unavailable"));

    await expect(f.validate()).rejects.toThrow(
      "Database unavailable",
    );
  });

  test("rejects invalid current time", async () => {
    const f = setup();

    await expect(
      f.validate(TOKEN, { now: () => new Date("invalid") }),
    ).rejects.toThrow(RangeError);
  });

  test("requires the Prisma dependency", async () => {
    await expect(
      validateMemoryRetestSession(
        { sessionToken: TOKEN },
        {},
      ),
    ).rejects.toThrow(TypeError);
  });

  test("requires an eligibility resolver", async () => {
    const f = setup();

    await expect(
      f.validate(TOKEN, { eligibilityResolver: null }),
    ).rejects.toThrow(TypeError);
  });
});
