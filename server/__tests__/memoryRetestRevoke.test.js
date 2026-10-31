import { jest } from "@jest/globals";
import {
  revokeMemoryRetestGrants,
} from "../services/memoryRetestRevoke.js";

const NOW = new Date("2026-10-31T08:00:00.000Z");

function setup() {
  const oldRevocation = new Date("2026-10-30T08:00:00Z");

  const grants = [
    {
      id: "grant-1",
      purchaseId: "purchase-1",
      revokedAt: null,
      sessionTokenHash: "a".repeat(64),
    },
    {
      id: "grant-2",
      purchaseId: "purchase-1",
      revokedAt: null,
      sessionTokenHash: null,
    },
    {
      id: "grant-3",
      purchaseId: "purchase-1",
      revokedAt: oldRevocation,
      sessionTokenHash: "b".repeat(64),
    },
    {
      id: "grant-4",
      purchaseId: "purchase-2",
      revokedAt: null,
      sessionTokenHash: "c".repeat(64),
    },
  ];

  const prisma = {
    memoryRetestAccessGrant: {
      updateMany: jest.fn(async ({ where, data }) => {
        let count = 0;

        for (const grant of grants) {
          if (
            grant.purchaseId === where.purchaseId &&
            grant.revokedAt === null
          ) {
            grant.revokedAt = data.revokedAt;
            count++;
          }
        }

        return { count };
      }),
    },
  };

  const revoke = (purchaseId = "purchase-1", dependencies = {}) =>
    revokeMemoryRetestGrants(
      { trustedPurchaseId: purchaseId },
      {
        prisma,
        now: () => new Date(NOW),
        ...dependencies,
      },
    );

  return { grants, prisma, revoke, oldRevocation };
}

describe("Memory retest grant revocation", () => {
  test("revokes all active grants for a purchase", async () => {
    const f = setup();

    const result = await f.revoke();

    expect(result).toEqual({
      revoked: true,
      revokedCount: 2,
    });

    expect(f.grants[0].revokedAt).toEqual(NOW);
    expect(f.grants[1].revokedAt).toEqual(NOW);

    expect(
      f.prisma.memoryRetestAccessGrant.updateMany
    ).toHaveBeenCalledWith({
      where: {
        purchaseId: "purchase-1",
        revokedAt: null,
      },
      data: {
        revokedAt: NOW,
      },
    });
  });

  test("does not revoke another purchaser's grants", async () => {
    const f = setup();

    await f.revoke("purchase-1");

    expect(f.grants[3].revokedAt).toBeNull();
  });

  test("preserves grants that were already revoked", async () => {
    const f = setup();

    await f.revoke();

    expect(f.grants[2].revokedAt).toEqual(
      f.oldRevocation,
    );
  });

  test("returns zero when no active grants remain", async () => {
    const f = setup();

    f.grants[0].revokedAt = new Date(NOW);
    f.grants[1].revokedAt = new Date(NOW);

    const result = await f.revoke();

    expect(result).toEqual({
      revoked: true,
      revokedCount: 0,
    });
  });

  test("repeated revocation is idempotent", async () => {
    const f = setup();

    const first = await f.revoke();
    const second = await f.revoke();

    expect(first.revokedCount).toBe(2);
    expect(second.revokedCount).toBe(0);
  });

  test.each([
    "",
    "   ",
    null,
    undefined,
  ])("rejects invalid purchase ID %s", async (purchaseId) => {
    const f = setup();

    const result = await f.revoke(purchaseId === undefined ? "" : purchaseId);

    expect(result).toEqual({
      revoked: false,
      reason: "PURCHASE_ID_REQUIRED",
    });

    expect(
      f.prisma.memoryRetestAccessGrant.updateMany
    ).not.toHaveBeenCalled();
  });

  test("requires a valid clock function", async () => {
    const f = setup();

    await expect(
      f.revoke("purchase-1", { now: null }),
    ).rejects.toThrow(TypeError);
  });

  test("rejects an invalid current date", async () => {
    const f = setup();

    await expect(
      f.revoke("purchase-1", {
        now: () => new Date("invalid"),
      }),
    ).rejects.toThrow(RangeError);

    expect(
      f.prisma.memoryRetestAccessGrant.updateMany
    ).not.toHaveBeenCalled();
  });

  test("requires the Prisma dependency", async () => {
    await expect(
      revokeMemoryRetestGrants(
        { trustedPurchaseId: "purchase-1" },
        {},
      ),
    ).rejects.toThrow(TypeError);
  });

  test("propagates database failures", async () => {
    const f = setup();

    f.prisma.memoryRetestAccessGrant.updateMany
      .mockRejectedValue(
        new Error("Database unavailable"),
      );

    await expect(f.revoke()).rejects.toThrow(
      "Database unavailable",
    );
  });
});
