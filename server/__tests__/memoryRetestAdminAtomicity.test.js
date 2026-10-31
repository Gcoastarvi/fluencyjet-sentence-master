import {
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

import {
  issueMemoryRetestAdminInvitation,
} from "../services/memoryRetestAdminInvitation.js";

const NOW = new Date("2026-11-16T10:00:00.000Z");

function fixture({
  postAssignmentInvalid = false,
  completed = false,
} = {}) {
  const state = {
    assigned: false,
    committed: false,
    rolledBack: false,
  };

  const grantIssuer = jest.fn(async () => ({
    issued: true,
    grantId: "grant-test",
    linkToken: "a".repeat(64),
    linkExpiresAt: new Date(
      NOW.getTime() + 7 * 86400000
    ),
  }));

  const grantRevoker = jest.fn(async () => ({
    revoked: true,
    revokedCount: 0,
  }));

  const tx = {
    user: {
      findUnique: jest.fn(async () => ({
        id: 7,
        isAdmin: true,
      })),
    },

    memoryMasterclassPurchase: {
      findUnique: jest.fn(async () => ({
        id: "purchase-parents",
        checkoutIntentId: "intent-parents",
      })),
    },

    memoryMasterclassCheckoutIntent: {
      findUnique: jest.fn(async () => ({
        id: "intent-parents",
        checkoutSource: "standalone_vsl",
        trackId: "school_unspecified",
        eventStartsAt:
          new Date("2026-11-15T11:30:00.000Z"),
        eventEndsAt:
          new Date("2026-11-15T13:30:00.000Z"),
      })),
    },

    memoryRetestAccessGrant: {
      count: jest.fn(async () => 0),
    },

    memoryRetestTrackAssignment: {
      create: jest.fn(async () => {
        state.assigned = true;
        return {
          purchaseId: "purchase-parents",
          trackId: "school_foundation",
          assignedByAdminId: 7,
        };
      }),
    },

    memoryFormBOnlyResult: {
      findUnique: jest.fn(async () =>
        completed ? { id: "existing-result" } : null
      ),
    },
  };

  const prisma = {
    $transaction: jest.fn(async callback => {
      const previousAssignment = state.assigned;

      try {
        const result = await callback(tx);
        state.committed = true;
        return result;
      } catch (error) {
        // Simulate the rollback semantics of a real
        // Prisma interactive transaction.
        state.assigned = previousAssignment;
        state.rolledBack = true;
        throw error;
      }
    }),
  };

  const eligibilityResolver = jest.fn(async () => {
    if (!state.assigned) {
      return {
        eligible: false,
        reason: "TRACK_ASSIGNMENT_REQUIRED",
      };
    }

    if (postAssignmentInvalid) {
      return {
        eligible: false,
        reason: "TRACK_MISMATCH",
      };
    }

    return {
      eligible: true,
      purchaseId: "purchase-parents",
      assessmentSessionId: null,
      trackId: "school_foundation",
    };
  });

  const run = () =>
    issueMemoryRetestAdminInvitation(
      {
        trustedAdminId: 7,
        trustedPurchaseId: "purchase-parents",
        schoolTrackId: "school_foundation",
      },
      {
        prisma,
        eligibilityResolver,
        grantIssuer,
        grantRevoker,
        now: () => NOW,
      }
    );

  return {
    state,
    run,
    grantIssuer,
    grantRevoker,
  };
}

describe("Administrator invitation transaction atomicity", () => {
  test("rolls back assignment when eligibility fails afterward", async () => {
    const f = fixture({
      postAssignmentInvalid: true,
    });

    const result = await f.run();

    expect(result).toEqual({
      issued: false,
      reason: "TRACK_MISMATCH",
    });

    expect(f.state.rolledBack).toBe(true);
    expect(f.state.assigned).toBe(false);
    expect(f.state.committed).toBe(false);

    expect(f.grantIssuer).not.toHaveBeenCalled();
    expect(f.grantRevoker).not.toHaveBeenCalled();
  });

  test("rolls back assignment if Form B was already completed", async () => {
    const f = fixture({
      completed: true,
    });

    const result = await f.run();

    expect(result).toEqual({
      issued: false,
      reason: "FORM_B_ALREADY_COMPLETED",
    });

    expect(f.state.rolledBack).toBe(true);
    expect(f.state.assigned).toBe(false);
    expect(f.state.committed).toBe(false);

    expect(f.grantIssuer).not.toHaveBeenCalled();
    expect(f.grantRevoker).not.toHaveBeenCalled();
  });

  test("commits a valid assignment with successful issuance", async () => {
    const f = fixture();

    const result = await f.run();

    expect(result.issued).toBe(true);
    expect(result.trackId).toBe("school_foundation");

    expect(f.state.committed).toBe(true);
    expect(f.state.rolledBack).toBe(false);
    expect(f.state.assigned).toBe(true);

    expect(f.grantIssuer).toHaveBeenCalledTimes(1);
    expect(f.grantRevoker).toHaveBeenCalledTimes(1);
  });
});
