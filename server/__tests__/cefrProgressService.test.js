import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const mockPrisma = {
  learningDay: {
    findMany: jest.fn(),
  },
  xpLedger: {
    aggregate: jest.fn(),
  },
};

const mockGetCefrProgramOverview = jest.fn();

jest.unstable_mockModule("../db/client.js", () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule("../services/cefrAccessService.js", () => ({
  getCefrProgramOverview: mockGetCefrProgramOverview,
}));

const { getCefrLearnerProgress } = await import(
  "../services/cefrProgressService.js"
);

const NOW = new Date("2026-09-10T15:00:00.000Z");

function overviewResult() {
  return {
    type: "OK",
    program: {
      id: "program-1",
      slug: "german-a1",
      name: "German A1",
      cefrLevel: "A1",
    },
    version: {
      id: "version-1",
      versionKey: "2026-v1",
    },
    enrollment: {
      id: "enrollment-1",
      status: "ACTIVE",
    },
    cohort: {
      id: "cohort-1",
      key: "german-a1-sep-a",
    },
    days: [
      {
        id: "day-1",
        dayNumber: 1,
        entitled: true,
        unlocked: true,
        accessState: "UNLOCKED",
      },
    ],
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  mockGetCefrProgramOverview.mockResolvedValue(overviewResult());

  mockPrisma.learningDay.findMany.mockResolvedValue([]);
  mockPrisma.xpLedger.aggregate.mockResolvedValue({
    _sum: {
      amount: null,
    },
  });
});

describe("getCefrLearnerProgress", () => {
  test("passes through program/access failures without loading progress", async () => {
    mockGetCefrProgramOverview.mockResolvedValue({
      type: "ENROLLMENT_REQUIRED",
      program: {
        id: "program-1",
        slug: "german-a1",
      },
    });

    const result = await getCefrLearnerProgress({
      userId: 42,
      programSlug: "german-a1",
      now: NOW,
    });

    expect(result.type).toBe("ENROLLMENT_REQUIRED");
    expect(mockPrisma.learningDay.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.xpLedger.aggregate).not.toHaveBeenCalled();
  });

  test("returns zero progress for an enrolled learner with no activities", async () => {
    mockPrisma.learningDay.findMany.mockResolvedValue([
      {
        id: "day-1",
        dayNumber: 1,
        activities: [],
      },
    ]);

    const result = await getCefrLearnerProgress({
      userId: 42,
      programSlug: "german-a1",
      now: NOW,
    });

    expect(result.type).toBe("OK");
    expect(result.totalXp).toBe(0);
    expect(result.days).toEqual([
      expect.objectContaining({
        id: "day-1",
        dayNumber: 1,
        entitled: true,
        unlocked: true,
        accessState: "UNLOCKED",
        activityCount: 0,
        completedActivityCount: 0,
        completed: false,
        activities: [],
      }),
    ]);
  });

  test("keeps an Activity completed when an earlier Attempt completed but latest Attempt is a retry", async () => {
    mockPrisma.learningDay.findMany.mockResolvedValue([
      {
        id: "day-1",
        dayNumber: 1,
        activities: [
          {
            id: "activity-1",
            key: "greetings-reorder",
            title: "Greetings",
            activityType: "REORDER",
            evaluationMode: "AUTO",
            orderIndex: 1,
            items: [
              { id: "item-1" },
              { id: "item-2" },
            ],
            attempts: [
              {
                id: "attempt-2",
                attemptNumber: 2,
                status: "IN_PROGRESS",
                startedAt: NOW,
                completedAt: null,
                responses: [
                  {
                    activityItemId: "item-1",
                    isCorrect: true,
                    evaluationCode: "CORRECT",
                  },
                ],
              },
              {
                id: "attempt-1",
                attemptNumber: 1,
                status: "COMPLETED",
                startedAt: new Date("2026-09-10T14:00:00.000Z"),
                completedAt: new Date("2026-09-10T14:10:00.000Z"),
                responses: [],
              },
            ],
            xpEntries: [
              { amount: 150 },
              { amount: 75 },
              { amount: -25 },
            ],
          },
        ],
      },
    ]);

    mockPrisma.xpLedger.aggregate.mockResolvedValue({
      _sum: {
        amount: 200,
      },
    });

    const result = await getCefrLearnerProgress({
      userId: 42,
      programSlug: "german-a1",
      now: NOW,
    });

    const activity = result.days[0].activities[0];

    expect(result.totalXp).toBe(200);
    expect(activity.completed).toBe(true);
    expect(activity.earnedXp).toBe(200);

    expect(activity.latestAttempt).toEqual(
      expect.objectContaining({
        id: "attempt-2",
        attemptNumber: 2,
        status: "IN_PROGRESS",
      }),
    );

    expect(activity.resume).toEqual({
      completedItemIds: ["item-1"],
      totalItems: 2,
    });

    expect(result.days[0].completedActivityCount).toBe(1);
    expect(result.days[0].completed).toBe(true);
  });

  test("uses SELF_ATTESTED_COMPLETE as resume evidence for self-attested activities", async () => {
    mockPrisma.learningDay.findMany.mockResolvedValue([
      {
        id: "day-1",
        dayNumber: 1,
        activities: [
          {
            id: "activity-1",
            key: "repeat-greeting",
            title: "Repeat the greeting",
            activityType: "AUDIO_REPEAT",
            evaluationMode: "SELF_ATTESTED",
            orderIndex: 1,
            items: [{ id: "item-1" }],
            attempts: [
              {
                id: "attempt-1",
                attemptNumber: 1,
                status: "IN_PROGRESS",
                startedAt: NOW,
                completedAt: null,
                responses: [
                  {
                    activityItemId: "item-1",
                    isCorrect: null,
                    evaluationCode: "SELF_ATTESTED_COMPLETE",
                  },
                ],
              },
            ],
            xpEntries: [{ amount: 100 }],
          },
        ],
      },
    ]);

    const result = await getCefrLearnerProgress({
      userId: 42,
      programSlug: "german-a1",
      now: NOW,
    });

    expect(result.days[0].activities[0].resume).toEqual({
      completedItemIds: ["item-1"],
      totalItems: 1,
    });

    expect(result.days[0].activities[0].completed).toBe(false);
  });

  test("scopes curriculum, Attempts and XP to the current ProgramVersion and Enrollment", async () => {
    await getCefrLearnerProgress({
      userId: 42,
      programSlug: "german-a1",
      now: NOW,
    });

    expect(mockPrisma.learningDay.findMany).toHaveBeenCalledWith({
      where: {
        programVersionId: "version-1",
      },
      orderBy: {
        dayNumber: "asc",
      },
      select: {
        id: true,
        dayNumber: true,
        activities: {
          orderBy: {
            orderIndex: "asc",
          },
          select: {
            id: true,
            key: true,
            title: true,
            activityType: true,
            evaluationMode: true,
            orderIndex: true,
            items: {
              orderBy: {
                orderIndex: "asc",
              },
              select: {
                id: true,
              },
            },
            attempts: {
              where: {
                enrollmentId: "enrollment-1",
              },
              orderBy: {
                attemptNumber: "desc",
              },
              select: {
                id: true,
                attemptNumber: true,
                status: true,
                startedAt: true,
                completedAt: true,
                responses: {
                  select: {
                    activityItemId: true,
                    isCorrect: true,
                    evaluationCode: true,
                  },
                },
              },
            },
            xpEntries: {
              where: {
                enrollmentId: "enrollment-1",
              },
              select: {
                amount: true,
              },
            },
          },
        },
      },
    });

    expect(mockPrisma.xpLedger.aggregate).toHaveBeenCalledWith({
      where: {
        enrollmentId: "enrollment-1",
      },
      _sum: {
        amount: true,
      },
    });
  });
});
