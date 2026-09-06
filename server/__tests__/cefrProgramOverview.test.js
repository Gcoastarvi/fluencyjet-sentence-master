import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const mockPrisma = {
  program: {
    findUnique: jest.fn(),
  },
  enrollment: {
    findFirst: jest.fn(),
  },
};

jest.unstable_mockModule("../db/client.js", () => ({
  default: mockPrisma,
}));

const { getCefrProgramOverview } = await import(
  "../services/cefrAccessService.js"
);

const NOW = new Date("2026-09-10T15:00:00.000Z");

const PROGRAM = {
  id: "program-1",
  slug: "german-a1",
  name: "German A1",
  cefrLevel: "A1",
  language: {
    code: "de",
    name: "German",
  },
};

function makeEnrollment(overrides = {}) {
  return {
    id: "enrollment-1",
    status: "ACTIVE",
    enrolledAt: new Date("2026-09-01T10:00:00.000Z"),
    programVersionId: "version-1",
    programVersion: {
      id: "version-1",
      versionKey: "2026-v1",
      learningDays: [
        {
          id: "day-1",
          dayNumber: 1,
          title: "Hallo!",
          summary: "Greetings and introductions",
        },
      ],
    },
    entitlementGrants: [
      {
        id: "grant-1",
        startDayNumber: 1,
        endDayNumber: 3,
        grantedAt: new Date("2026-09-01T10:00:00.000Z"),
      },
    ],
    cohortEnrollments: [],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.program.findUnique.mockResolvedValue(PROGRAM);
});

describe("getCefrProgramOverview", () => {
  test("returns PROGRAM_NOT_FOUND when the program slug does not exist", async () => {
    mockPrisma.program.findUnique.mockResolvedValue(null);

    const result = await getCefrProgramOverview({
      userId: 42,
      programSlug: "missing-program",
      now: NOW,
    });

    expect(result).toEqual({
      type: "PROGRAM_NOT_FOUND",
    });

    expect(mockPrisma.enrollment.findFirst).not.toHaveBeenCalled();
  });

  test("returns ENROLLMENT_REQUIRED when the learner has no active enrollment", async () => {
    mockPrisma.enrollment.findFirst.mockResolvedValue(null);

    const result = await getCefrProgramOverview({
      userId: 42,
      programSlug: "german-a1",
      now: NOW,
    });

    expect(result).toEqual({
      type: "ENROLLMENT_REQUIRED",
      program: PROGRAM,
    });
  });

  test("returns COHORT_CONFLICT when more than one active cohort membership exists", async () => {
    mockPrisma.enrollment.findFirst.mockResolvedValue(
      makeEnrollment({
        cohortEnrollments: [
          {
            id: "membership-1",
            cohort: {
              id: "cohort-1",
              key: "german-a1-sep-a",
              name: "September A",
              timezone: "Asia/Kolkata",
              programVersionId: "version-1",
              liveSessions: [],
            },
          },
          {
            id: "membership-2",
            cohort: {
              id: "cohort-2",
              key: "german-a1-sep-b",
              name: "September B",
              timezone: "Asia/Kolkata",
              programVersionId: "version-1",
              liveSessions: [],
            },
          },
        ],
      }),
    );

    const result = await getCefrProgramOverview({
      userId: 42,
      programSlug: "german-a1",
      now: NOW,
    });

    expect(result).toEqual({
      type: "COHORT_CONFLICT",
      program: PROGRAM,
      enrollmentId: "enrollment-1",
    });
  });

  test("returns COHORT_VERSION_MISMATCH when cohort and enrollment versions differ", async () => {
    mockPrisma.enrollment.findFirst.mockResolvedValue(
      makeEnrollment({
        cohortEnrollments: [
          {
            id: "membership-1",
            cohort: {
              id: "cohort-1",
              key: "german-a1-sep-a",
              name: "September A",
              timezone: "Asia/Kolkata",
              programVersionId: "version-2",
              liveSessions: [],
            },
          },
        ],
      }),
    );

    const result = await getCefrProgramOverview({
      userId: 42,
      programSlug: "german-a1",
      now: NOW,
    });

    expect(result).toEqual({
      type: "COHORT_VERSION_MISMATCH",
      program: PROGRAM,
      enrollmentId: "enrollment-1",
    });
  });

  test("returns an unlocked day when entitlement, cohort and unlock time all allow access", async () => {
    mockPrisma.enrollment.findFirst.mockResolvedValue(
      makeEnrollment({
        cohortEnrollments: [
          {
            id: "membership-1",
            cohort: {
              id: "cohort-1",
              key: "german-a1-sep-a",
              name: "September A",
              timezone: "Asia/Kolkata",
              programVersionId: "version-1",
              liveSessions: [
                {
                  id: "session-1",
                  learningDayId: "day-1",
                  startsAt: new Date("2026-09-10T13:00:00.000Z"),
                  endsAt: new Date("2026-09-10T14:00:00.000Z"),
                  appUnlockAt: new Date("2026-09-10T14:00:00.000Z"),
                  status: "SCHEDULED",
                },
              ],
            },
          },
        ],
      }),
    );

    const result = await getCefrProgramOverview({
      userId: 42,
      programSlug: "german-a1",
      now: NOW,
    });

    expect(result.type).toBe("OK");
    expect(result.enrollment.id).toBe("enrollment-1");
    expect(result.version).toEqual({
      id: "version-1",
      versionKey: "2026-v1",
    });
    expect(result.cohort).toEqual({
      id: "cohort-1",
      key: "german-a1-sep-a",
      name: "September A",
      timezone: "Asia/Kolkata",
    });
    expect(result.days).toHaveLength(1);
    expect(result.days[0]).toMatchObject({
      id: "day-1",
      dayNumber: 1,
      entitled: true,
      unlocked: true,
      accessState: "UNLOCKED",
    });

    expect(mockPrisma.enrollment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 42,
          status: "ACTIVE",
          endedAt: null,
          programVersion: {
            programId: "program-1",
          },
        }),
      }),
    );
  });
});
