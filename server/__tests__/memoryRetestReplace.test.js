import { jest } from "@jest/globals";
import { replaceMemoryRetestGrant } from "../services/memoryRetestReplace.js";
import { hashMemoryRetestToken } from "../services/memoryRetestGrant.js";

const NOW = new Date("2026-10-31T08:00:00.000Z");
const EXPIRY = "2026-11-07T08:00:00.000Z";

function setup({ failCreate = false } = {}) {
  const previouslyRevoked = new Date("2026-10-30T08:00:00Z");

  const state = {
    grants: [
      {
        id: "old-1",
        purchaseId: "purchase-1",
        revokedAt: null,
        sessionTokenHash: null,
      },
      {
        id: "old-2",
        purchaseId: "purchase-1",
        revokedAt: null,
        sessionTokenHash: "a".repeat(64),
      },
      {
        id: "old-3",
        purchaseId: "purchase-1",
        revokedAt: previouslyRevoked,
      },
      {
        id: "other-purchase",
        purchaseId: "purchase-2",
        revokedAt: null,
      },
    ],
  };

  let nextId = 0;
  let queue = Promise.resolve();

  // Transaction mock: commit the draft only on success.
  // A thrown error discards all draft changes.
  async function executeTransaction(callback) {
    const draft = state.grants.map((grant) => ({ ...grant }));

    const tx = {
      memoryRetestAccessGrant: {
        updateMany: jest.fn(async ({ where, data }) => {
          let count = 0;

          for (const grant of draft) {
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

        create: jest.fn(async ({ data }) => {
          if (failCreate) {
            throw new Error("Simulated grant creation failure");
          }

          const grant = {
            id: `replacement-${++nextId}`,
            revokedAt: null,
            ...data,
          };

          draft.push(grant);
          return grant;
        }),
      },
    };

    const result = await callback(tx);
    state.grants = draft;

    return result;
  }

  const prisma = {
    $transaction: jest.fn((callback) => {
      // Serializes mock transactions for deterministic testing.
      // Real PostgreSQL concurrency still needs separate QA.
      const job = queue.then(() =>
        executeTransaction(callback)
      );

      queue = job.catch(() => {});
      return job;
    }),
  };

  const eligibilityResolver = jest.fn(async () => ({
    eligible: true,
    purchaseId: "purchase-1",
    assessmentSessionId: "assessment-1",
    trackId: "school_foundation",
    formAScore: 42,
  }));

  const replace = (overrides = {}) =>
    replaceMemoryRetestGrant(
      {
        trustedPurchaseId: "purchase-1",
        linkExpiresAt: EXPIRY,
        ...overrides,
      },
      {
        prisma,
        eligibilityResolver,
        now: () => new Date(NOW),
      },
    );

  return {
    state,
    prisma,
    eligibilityResolver,
    replace,
    previouslyRevoked,
  };
}

describe("Atomic Memory Form B link replacement", () => {
  test("revokes old grants and issues a new token", async () => {
    const f = setup();

    const result = await f.replace();

    expect(result.issued).toBe(true);
    expect(result.revokedCount).toBe(2);
    expect(result.linkToken).toMatch(/^[a-f0-9]{64}$/);

    expect(f.state.grants[0].revokedAt).toEqual(NOW);
    expect(f.state.grants[1].revokedAt).toEqual(NOW);

    const replacement = f.state.grants.find(
      (grant) => grant.id === result.grantId
    );

    expect(replacement.revokedAt).toBeNull();
    expect(replacement.purchaseId).toBe("purchase-1");
    expect(replacement.assessmentSessionId).toBe("assessment-1");
    expect(replacement.tokenHash).toBe(
      hashMemoryRetestToken(result.linkToken)
    );
    expect(replacement.tokenHash).not.toBe(result.linkToken);
  });

  test("does not affect other purchasers", async () => {
    const f = setup();

    await f.replace();

    const other = f.state.grants.find(
      (grant) => grant.id === "other-purchase"
    );

    expect(other.revokedAt).toBeNull();
  });

  test("preserves an earlier revocation timestamp", async () => {
    const f = setup();

    await f.replace();

    expect(f.state.grants[2].revokedAt).toEqual(
      f.previouslyRevoked
    );
  });

  test("rolls back revocation when creation fails", async () => {
    const f = setup({ failCreate: true });
    const before = structuredClone(f.state.grants);

    await expect(f.replace()).rejects.toThrow(
      "Simulated grant creation failure"
    );

    expect(f.state.grants).toEqual(before);
  });

  test("rejects ineligible purchasers without changes", async () => {
    const f = setup();
    const before = structuredClone(f.state.grants);

    f.eligibilityResolver.mockResolvedValue({
      eligible: false,
      reason: "PURCHASE_NOT_CAPTURED",
    });

    const result = await f.replace();

    expect(result).toEqual({
      issued: false,
      reason: "PURCHASE_NOT_CAPTURED",
    });

    expect(f.state.grants).toEqual(before);
  });

  test("rejects inconsistent purchase association", async () => {
    const f = setup();

    f.eligibilityResolver.mockResolvedValue({
      eligible: true,
      purchaseId: "different-purchase",
      assessmentSessionId: "assessment-1",
    });

    await expect(f.replace()).rejects.toThrow(
      "Inconsistent retest purchase eligibility"
    );

    expect(f.state.grants[0].revokedAt).toBeNull();
  });

  test("rejects an expired link", async () => {
    const f = setup();

    await expect(
      f.replace({
        linkExpiresAt: "2026-10-30T08:00:00Z",
      })
    ).rejects.toThrow(RangeError);

    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });

  test("rejects expiry beyond 30 days", async () => {
    const f = setup();

    await expect(
      f.replace({
        linkExpiresAt: "2026-12-01T08:00:00Z",
      })
    ).rejects.toThrow(RangeError);

    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });

  test("rejects missing purchase ID", async () => {
    const f = setup();

    const result = await f.replace({
      trustedPurchaseId: "",
    });

    expect(result.issued).toBe(false);
    expect(result.reason).toBe("PURCHASE_ID_REQUIRED");
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });

  test("requests serializable transactions", async () => {
    const f = setup();

    await f.replace();

    expect(f.prisma.$transaction.mock.calls[0][1]).toEqual({
      isolationLevel: "Serializable",
      maxWait: 5000,
      timeout: 10000,
    });
  });

  test("retries a Prisma serialization conflict", async () => {
    const f = setup();

    f.prisma.$transaction.mockImplementationOnce(async () => {
      throw Object.assign(
        new Error("Simulated serialization conflict"),
        { code: "P2034" }
      );
    });

    const result = await f.replace();

    expect(result.issued).toBe(true);
    expect(f.prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  test("stops after three serialization conflicts", async () => {
    const f = setup();

    f.prisma.$transaction.mockImplementation(async () => {
      throw Object.assign(
        new Error("Persistent serialization conflict"),
        { code: "P2034" }
      );
    });

    await expect(f.replace()).rejects.toMatchObject({
      code: "P2034",
    });

    expect(f.prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  test("two queued replacements leave one active link", async () => {
    const f = setup();

    const [first, second] = await Promise.all([
      f.replace(),
      f.replace(),
    ]);

    expect(first.issued).toBe(true);
    expect(second.issued).toBe(true);
    expect(first.linkToken).not.toBe(second.linkToken);

    const active = f.state.grants.filter(
      (grant) =>
        grant.purchaseId === "purchase-1" &&
        grant.revokedAt === null
    );

    expect(active).toHaveLength(1);
    expect(active[0].tokenHash).toBe(
      hashMemoryRetestToken(second.linkToken)
    );
  });

  test("requires Prisma transaction support", async () => {
    await expect(
      replaceMemoryRetestGrant(
        {
          trustedPurchaseId: "purchase-1",
          linkExpiresAt: EXPIRY,
        },
        {}
      )
    ).rejects.toThrow(TypeError);
  });
});
