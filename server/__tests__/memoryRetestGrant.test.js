import { jest } from "@jest/globals";
import crypto from "node:crypto";
import {
  hashMemoryRetestToken,
  issueMemoryRetestGrant,
} from "../services/memoryRetestGrant.js";

const NOW = new Date("2026-10-31T00:00:00.000Z");

function setup(trackId = "school_foundation") {
  const eligibilityResolver = jest.fn(async () => ({
    eligible: true,
    purchaseId: "purchase-1",
    assessmentSessionId: "assessment-1",
    trackId,
    formAScore: 42,
  }));

  const prisma = {
    memoryRetestAccessGrant: {
      create: jest.fn(async ({ data }) => ({
        id: "grant-1",
        ...data,
      })),
    },
  };

  const dependencies = {
    prisma,
    eligibilityResolver,
    now: () => new Date(NOW),
  };

  const issue = (overrides = {}) =>
    issueMemoryRetestGrant(
      {
        trustedPurchaseId: "purchase-1",
        linkExpiresAt: "2026-11-07T00:00:00.000Z",
        ...overrides,
      },
      dependencies,
    );

  return { prisma, eligibilityResolver, issue };
}

describe("Memory retest grant issuance", () => {
  test.each([
    "school_foundation",
    "school_advanced",
    "advanced",
  ])("issues a grant for eligible %s purchase", async (track) => {
    const f = setup(track);
    const result = await f.issue();

    expect(result.issued).toBe(true);
    expect(result.grantId).toBe("grant-1");
    expect(result.linkToken).toMatch(/^[0-9a-f]{64}$/);

    expect(f.eligibilityResolver).toHaveBeenCalledWith(
      { trustedPurchaseId: "purchase-1" },
      { prisma: f.prisma },
    );

    const saved =
      f.prisma.memoryRetestAccessGrant.create.mock.calls[0][0].data;

    expect(saved.purchaseId).toBe("purchase-1");
    expect(saved.assessmentSessionId).toBe("assessment-1");
    expect(saved.tokenHash).toBe(
      hashMemoryRetestToken(result.linkToken),
    );

    expect(saved.tokenHash).not.toBe(result.linkToken);
    expect(saved.linkToken).toBeUndefined();
    expect(saved.ownerToken).toBeUndefined();
  });

  test("SHA-256 produces the expected hash", () => {
    const token = "synthetic-test-token";

    expect(hashMemoryRetestToken(token)).toBe(
      crypto.createHash("sha256").update(token).digest("hex"),
    );
  });

  test("creates different tokens for separate grants", async () => {
    const f = setup();

    const first = await f.issue();
    const second = await f.issue();

    expect(first.linkToken).not.toBe(second.linkToken);
  });

  test("rejects missing purchase ID without writing", async () => {
    const f = setup();

    const result = await f.issue({ trustedPurchaseId: "" });

    expect(result).toEqual({
      issued: false,
      reason: "PURCHASE_ID_REQUIRED",
    });

    expect(f.prisma.memoryRetestAccessGrant.create)
      .not.toHaveBeenCalled();
  });

  test("rejects ineligible purchases without writing", async () => {
    const f = setup();

    f.eligibilityResolver.mockResolvedValue({
      eligible: false,
      reason: "PURCHASE_NOT_CAPTURED",
    });

    const result = await f.issue();

    expect(result).toEqual({
      issued: false,
      reason: "PURCHASE_NOT_CAPTURED",
    });

    expect(f.prisma.memoryRetestAccessGrant.create)
      .not.toHaveBeenCalled();
  });

  test("rejects an expired link", async () => {
    const f = setup();

    await expect(
      f.issue({ linkExpiresAt: "2026-10-30T00:00:00Z" }),
    ).rejects.toThrow(RangeError);

    expect(f.prisma.memoryRetestAccessGrant.create)
      .not.toHaveBeenCalled();
  });

  test("rejects invalid expiry", async () => {
    const f = setup();

    await expect(
      f.issue({ linkExpiresAt: "invalid-date" }),
    ).rejects.toThrow(RangeError);
  });

  test("rejects expiry longer than 30 days", async () => {
    const f = setup();

    await expect(
      f.issue({ linkExpiresAt: "2026-12-01T00:00:00Z" }),
    ).rejects.toThrow(RangeError);

    expect(f.prisma.memoryRetestAccessGrant.create)
      .not.toHaveBeenCalled();
  });

  test("accepts exactly 30 days", async () => {
    const f = setup();

    const result = await f.issue({
      linkExpiresAt: "2026-11-30T00:00:00Z",
    });

    expect(result.issued).toBe(true);
  });

  test("does not write when eligibility data is incomplete", async () => {
    const f = setup();

    f.eligibilityResolver.mockResolvedValue({
      eligible: true,
      purchaseId: "purchase-1",
    });

    await expect(f.issue()).rejects.toThrow(
      "Incomplete eligibility result",
    );

    expect(f.prisma.memoryRetestAccessGrant.create)
      .not.toHaveBeenCalled();
  });

  test("propagates database errors", async () => {
    const f = setup();

    f.prisma.memoryRetestAccessGrant.create.mockRejectedValue(
      new Error("Database unavailable"),
    );

    await expect(f.issue()).rejects.toThrow(
      "Database unavailable",
    );
  });

  test("rejects missing Prisma dependency", async () => {
    await expect(
      issueMemoryRetestGrant(
        {
          trustedPurchaseId: "purchase-1",
          linkExpiresAt: "2026-11-07T00:00:00Z",
        },
        {},
      ),
    ).rejects.toThrow(TypeError);
  });
});
