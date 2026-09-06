import { describe, test, expect } from "@jest/globals";
import { evaluateCefrDayAccess } from "../services/cefrAccessService.js";

const NOW = new Date("2026-09-10T15:00:00.000Z");

function grant(startDayNumber = 1, endDayNumber = 3) {
  return { startDayNumber, endDayNumber };
}

function session(overrides = {}) {
  return {
    status: "SCHEDULED",
    appUnlockAt: new Date("2026-09-10T14:00:00.000Z"),
    ...overrides,
  };
}

describe("evaluateCefrDayAccess", () => {
  test("denies a day outside active entitlement range", () => {
    expect(
      evaluateCefrDayAccess({
        dayNumber: 4,
        entitlementGrants: [grant(1, 3)],
        cohort: { id: "cohort-1" },
        liveSession: session(),
        now: NOW,
      }),
    ).toEqual({
      entitled: false,
      unlocked: false,
      accessState: "NO_ENTITLEMENT",
    });
  });

  test("keeps an entitled day locked without an active cohort", () => {
    expect(
      evaluateCefrDayAccess({
        dayNumber: 1,
        entitlementGrants: [grant()],
        cohort: null,
        liveSession: session(),
        now: NOW,
      }),
    ).toEqual({
      entitled: true,
      unlocked: false,
      accessState: "NO_ACTIVE_COHORT",
    });
  });

  test("keeps an entitled day locked when no live session exists", () => {
    expect(
      evaluateCefrDayAccess({
        dayNumber: 1,
        entitlementGrants: [grant()],
        cohort: { id: "cohort-1" },
        liveSession: null,
        now: NOW,
      }),
    ).toEqual({
      entitled: true,
      unlocked: false,
      accessState: "NO_LIVE_SESSION",
    });
  });

  test("keeps a cancelled live session locked", () => {
    expect(
      evaluateCefrDayAccess({
        dayNumber: 1,
        entitlementGrants: [grant()],
        cohort: { id: "cohort-1" },
        liveSession: session({ status: "CANCELLED" }),
        now: NOW,
      }),
    ).toEqual({
      entitled: true,
      unlocked: false,
      accessState: "SESSION_CANCELLED",
    });
  });

  test("keeps a day scheduled before appUnlockAt", () => {
    expect(
      evaluateCefrDayAccess({
        dayNumber: 1,
        entitlementGrants: [grant()],
        cohort: { id: "cohort-1" },
        liveSession: session({
          appUnlockAt: new Date("2026-09-10T16:00:00.000Z"),
        }),
        now: NOW,
      }),
    ).toEqual({
      entitled: true,
      unlocked: false,
      accessState: "SCHEDULED",
    });
  });

  test("unlocks an entitled day at appUnlockAt", () => {
    expect(
      evaluateCefrDayAccess({
        dayNumber: 1,
        entitlementGrants: [grant()],
        cohort: { id: "cohort-1" },
        liveSession: session({
          appUnlockAt: NOW,
        }),
        now: NOW,
      }),
    ).toEqual({
      entitled: true,
      unlocked: true,
      accessState: "UNLOCKED",
    });
  });

  test("full-course entitlement can cover Day 45", () => {
    expect(
      evaluateCefrDayAccess({
        dayNumber: 45,
        entitlementGrants: [grant(1, 45)],
        cohort: { id: "cohort-1" },
        liveSession: session(),
        now: NOW,
      }),
    ).toEqual({
      entitled: true,
      unlocked: true,
      accessState: "UNLOCKED",
    });
  });
});
