import { jest } from "@jest/globals";

import {
  issueMemoryRetestAdminInvitation,
} from "../services/memoryRetestAdminInvitation.js";

const NOW = new Date("2026-11-16T10:00:00.000Z");

function fixture({
  adminAllowed = true,
  captured = true,
  eventEnded = true,
  assignedTrack = null,
  completed = false,
  previousGrants = 0,
  baseline = false,
} = {}) {
  let assigned = assignedTrack;

  const createAssignment = jest.fn(async ({ data }) => {
    assigned = data.trackId;
    return data;
  });

  const revoke = jest.fn(async () => ({
    revoked: true,
    revokedCount: previousGrants,
  }));

  const issue = jest.fn(async () => ({
    issued: true,
    grantId: "grant-test",
    linkToken: "a".repeat(64),
    linkExpiresAt: new Date(
      NOW.getTime() + 7 * 86400000
    ),
  }));

  const prisma = {
    user: {
      findUnique: jest.fn(async () => ({
        id: 7,
        isAdmin: adminAllowed,
      })),
    },

    memoryMasterclassPurchase: {
      findUnique: jest.fn(async () => ({
        id: "purchase-test",
        checkoutIntentId: "intent-test",
      })),
    },

    memoryMasterclassCheckoutIntent: {
      findUnique: jest.fn(async () => ({
        id: "intent-test",
        checkoutSource: "standalone_vsl",
        trackId: "school_unspecified",
        eventStartsAt:
          new Date("2026-11-15T11:30:00.000Z"),
        eventEndsAt: eventEnded
          ? new Date("2026-11-15T13:30:00.000Z")
          : new Date("2026-11-17T13:30:00.000Z"),
      })),
    },

    memoryRetestAccessGrant: {
      count: jest.fn(async () => previousGrants),
    },

    memoryRetestTrackAssignment: {
      create: createAssignment,
    },

    memoryFormBOnlyResult: {
      findUnique: jest.fn(async () =>
        completed ? { id: "completed-test" } : null
      ),
    },

    memoryAssessmentSession: {
      findUnique: jest.fn(async () => ({
        formBCompletedAt: completed ? NOW : null,
      })),
    },
  };

  prisma.$transaction = jest.fn(
    async callback => callback(prisma)
  );

  const eligibilityResolver = jest.fn(async () => {
    if (!captured) {
      return {
        eligible: false,
        reason: "PURCHASE_NOT_CAPTURED",
      };
    }

    if (!assigned) {
      return {
        eligible: false,
        reason: "TRACK_ASSIGNMENT_REQUIRED",
      };
    }

    return {
      eligible: true,
      purchaseId: "purchase-test",
      assessmentSessionId: baseline
        ? "assessment-test"
        : null,
      trackId: assigned,
    };
  });

  const run = (schoolTrackId = null, adminId = 7) =>
    issueMemoryRetestAdminInvitation(
      {
        trustedAdminId: adminId,
        trustedPurchaseId: "purchase-test",
        schoolTrackId,
      },
      {
        prisma,
        eligibilityResolver,
        grantIssuer: issue,
        grantRevoker: revoke,
        now: () => NOW,
      },
    );

  return {
    run,
    prisma,
    issue,
    revoke,
    createAssignment,
  };
}

describe("Secure internal Form B invitation issuance", () => {
  test("rejects missing administrator identity", async () => {
    const f = fixture();

    expect(await f.run("school_foundation", 0))
      .toMatchObject({
        issued: false,
        reason: "ADMIN_NOT_AUTHORIZED",
      });

    expect(f.issue).not.toHaveBeenCalled();
  });

  test("checks the actual administrator database flag", async () => {
    const f = fixture({ adminAllowed: false });

    expect(await f.run("school_foundation"))
      .toMatchObject({
        issued: false,
        reason: "ADMIN_NOT_AUTHORIZED",
      });

    expect(f.createAssignment).not.toHaveBeenCalled();
    expect(f.issue).not.toHaveBeenCalled();
  });

  test("rejects invitations before the event ends", async () => {
    const f = fixture({ eventEnded: false });

    expect(await f.run("school_foundation"))
      .toMatchObject({
        issued: false,
        reason: "MASTERCLASS_NOT_FINISHED",
      });

    expect(f.createAssignment).not.toHaveBeenCalled();
    expect(f.issue).not.toHaveBeenCalled();
  });

  test("requires a school track for unassigned Parents purchases", async () => {
    const f = fixture();

    expect(await f.run()).toMatchObject({
      issued: false,
      reason: "SCHOOL_TRACK_REQUIRED",
    });

    expect(f.issue).not.toHaveBeenCalled();
  });

  test.each([
    "school_foundation",
    "school_advanced",
  ])("assigns %s and issues a seven-day link", async track => {
    const f = fixture();

    const result = await f.run(track);

    expect(result).toMatchObject({
      issued: true,
      purchaseId: "purchase-test",
      trackId: track,
    });

    expect(result.linkToken).toHaveLength(64);

    expect(f.createAssignment).toHaveBeenCalledWith({
      data: {
        purchaseId: "purchase-test",
        trackId: track,
        assignedByAdminId: 7,
      },
    });

    expect(f.revoke).toHaveBeenCalledTimes(1);
    expect(f.issue).toHaveBeenCalledTimes(1);
  });

  test("rejects uncaptured purchases without changing assignments", async () => {
    const f = fixture({ captured: false });

    expect(await f.run("school_foundation"))
      .toMatchObject({
        issued: false,
        reason: "PURCHASE_NOT_CAPTURED",
      });

    expect(f.createAssignment).not.toHaveBeenCalled();
    expect(f.issue).not.toHaveBeenCalled();
  });

  test("rejects reassignment to a different school track", async () => {
    const f = fixture({
      assignedTrack: "school_foundation",
    });

    expect(await f.run("school_advanced"))
      .toMatchObject({
        issued: false,
        reason: "TRACK_SELECTION_MISMATCH",
      });

    expect(f.issue).not.toHaveBeenCalled();
  });

  test("does not assign a track after an invitation already exists", async () => {
    const f = fixture({
      previousGrants: 1,
    });

    expect(await f.run("school_foundation"))
      .toMatchObject({
        issued: false,
        reason: "TRACK_ALREADY_LOCKED",
      });

    expect(f.createAssignment).not.toHaveBeenCalled();
    expect(f.issue).not.toHaveBeenCalled();
  });

  test("rejects already completed Form B-only purchases", async () => {
    const f = fixture({
      assignedTrack: "school_foundation",
      completed: true,
    });

    expect(await f.run()).toMatchObject({
      issued: false,
      reason: "FORM_B_ALREADY_COMPLETED",
    });

    expect(f.revoke).not.toHaveBeenCalled();
    expect(f.issue).not.toHaveBeenCalled();
  });

  test("rejects already completed Form A-linked purchases", async () => {
    const f = fixture({
      assignedTrack: "school_foundation",
      completed: true,
      baseline: true,
    });

    expect(await f.run()).toMatchObject({
      issued: false,
      reason: "FORM_B_ALREADY_COMPLETED",
    });

    expect(f.issue).not.toHaveBeenCalled();
  });
});
