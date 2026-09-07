import { jest, describe, test, expect, beforeEach } from "@jest/globals";

const mockPrisma = {
  attempt: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  response: {
    findMany: jest.fn(),
  },
};

const mockGetCefrDayDetail = jest.fn();

jest.unstable_mockModule("../db/client.js", () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule("../services/cefrAccessService.js", () => ({
  getCefrDayDetail: mockGetCefrDayDetail,
}));

const {
  startCefrActivityAttempt,
  completeCefrActivityAttempt,
} = await import("../services/cefrAttemptService.js");

const NOW = new Date("2026-09-10T15:00:00.000Z");

function unlockedDayResult() {
  return {
    type: "OK",
    program: {
      id: "program-1",
      slug: "german-a1",
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
    },
    day: {
      id: "day-1",
      dayNumber: 1,
      unlocked: true,
      accessState: "UNLOCKED",
      activities: [
        {
          id: "activity-1",
          key: "greetings-reorder",
          activityType: "REORDER",
          evaluationMode: "AUTO",
        },
      ],
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCefrDayDetail.mockResolvedValue(unlockedDayResult());
  mockPrisma.attempt.findMany.mockResolvedValue([]);
  mockPrisma.attempt.findFirst.mockResolvedValue(null);
});

describe("startCefrActivityAttempt", () => {
  test("passes through day access failures", async () => {
    mockGetCefrDayDetail.mockResolvedValue({
      type: "DAY_LOCKED",
      day: {
        id: "day-1",
        dayNumber: 1,
        unlocked: false,
        accessState: "SCHEDULED",
      },
    });

    const result = await startCefrActivityAttempt({
      userId: 42,
      programSlug: "german-a1",
      dayNumber: 1,
      activityId: "activity-1",
      now: NOW,
    });

    expect(result.type).toBe("DAY_LOCKED");
    expect(mockPrisma.attempt.create).not.toHaveBeenCalled();
  });

  test("returns ACTIVITY_NOT_FOUND when activity is not part of the unlocked day", async () => {
    const result = await startCefrActivityAttempt({
      userId: 42,
      programSlug: "german-a1",
      dayNumber: 1,
      activityId: "missing-activity",
      now: NOW,
    });

    expect(result.type).toBe("ACTIVITY_NOT_FOUND");
    expect(mockPrisma.attempt.create).not.toHaveBeenCalled();
  });

  test("resumes the single existing IN_PROGRESS attempt", async () => {
    mockPrisma.attempt.findMany.mockResolvedValue([
      {
        id: "attempt-1",
        attemptNumber: 1,
        status: "IN_PROGRESS",
        startedAt: NOW,
        completedAt: null,
      },
    ]);

    const result = await startCefrActivityAttempt({
      userId: 42,
      programSlug: "german-a1",
      dayNumber: 1,
      activityId: "activity-1",
      now: NOW,
    });

    expect(result.type).toBe("OK");
    expect(result.resumed).toBe(true);
    expect(result.attempt.id).toBe("attempt-1");
    expect(mockPrisma.attempt.create).not.toHaveBeenCalled();
  });

  test("returns ATTEMPT_CONFLICT when multiple open attempts already exist", async () => {
    mockPrisma.attempt.findMany.mockResolvedValue([
      {
        id: "attempt-2",
        attemptNumber: 2,
        status: "IN_PROGRESS",
      },
      {
        id: "attempt-1",
        attemptNumber: 1,
        status: "IN_PROGRESS",
      },
    ]);

    const result = await startCefrActivityAttempt({
      userId: 42,
      programSlug: "german-a1",
      dayNumber: 1,
      activityId: "activity-1",
      now: NOW,
    });

    expect(result.type).toBe("ATTEMPT_CONFLICT");
    expect(mockPrisma.attempt.create).not.toHaveBeenCalled();
  });

  test("creates the next numbered Attempt when none is open", async () => {
    mockPrisma.attempt.findFirst.mockResolvedValue({
      attemptNumber: 2,
    });

    mockPrisma.attempt.create.mockResolvedValue({
      id: "attempt-3",
      attemptNumber: 3,
      status: "IN_PROGRESS",
      startedAt: NOW,
      completedAt: null,
    });

    const result = await startCefrActivityAttempt({
      userId: 42,
      programSlug: "german-a1",
      dayNumber: 1,
      activityId: "activity-1",
      now: NOW,
    });

    expect(result.type).toBe("OK");
    expect(result.resumed).toBe(false);
    expect(result.attempt.attemptNumber).toBe(3);

    expect(mockPrisma.attempt.create).toHaveBeenCalledWith({
      data: {
        enrollmentId: "enrollment-1",
        activityId: "activity-1",
        attemptNumber: 3,
        status: "IN_PROGRESS",
        startedAt: NOW,
      },
      select: {
        id: true,
        attemptNumber: true,
        status: true,
        startedAt: true,
        completedAt: true,
      },
    });
  });

  test("recovers from a concurrent P2002 create race by re-reading the winning Attempt", async () => {
    mockPrisma.attempt.findFirst
      .mockResolvedValueOnce({
        attemptNumber: 1,
      })
      .mockResolvedValueOnce({
        id: "attempt-2",
        attemptNumber: 2,
        status: "IN_PROGRESS",
        startedAt: NOW,
        completedAt: null,
      });

    mockPrisma.attempt.create.mockRejectedValue({
      code: "P2002",
    });

    const result = await startCefrActivityAttempt({
      userId: 42,
      programSlug: "german-a1",
      dayNumber: 1,
      activityId: "activity-1",
      now: NOW,
    });

    expect(result.type).toBe("OK");
    expect(result.resumed).toBe(true);
    expect(result.attempt.id).toBe("attempt-2");
    expect(result.attempt.attemptNumber).toBe(2);
  });
});

describe("completeCefrActivityAttempt", () => {
  function completionDayResult({
    evaluationMode = "AUTO",
    items = [
      { id: "item-1", itemKey: "item-1" },
      { id: "item-2", itemKey: "item-2" },
    ],
  } = {}) {
    const result = unlockedDayResult();

    result.day.activities[0] = {
      ...result.day.activities[0],
      evaluationMode,
      items,
    };

    return result;
  }

  beforeEach(() => {
    mockGetCefrDayDetail.mockResolvedValue(completionDayResult());
    mockPrisma.attempt.updateMany.mockResolvedValue({
      count: 1,
    });
    mockPrisma.response.findMany.mockResolvedValue([]);
  });

  test("passes through day access failures without mutating the Attempt", async () => {
    mockGetCefrDayDetail.mockResolvedValue({
      type: "DAY_LOCKED",
      day: {
        id: "day-1",
        dayNumber: 1,
        accessState: "SCHEDULED",
      },
    });

    const result = await completeCefrActivityAttempt({
      userId: 42,
      programSlug: "german-a1",
      dayNumber: 1,
      activityId: "activity-1",
      attemptId: "attempt-1",
      now: NOW,
    });

    expect(result.type).toBe("DAY_LOCKED");
    expect(mockPrisma.response.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.attempt.updateMany).not.toHaveBeenCalled();
  });

  test("rejects an Attempt that does not belong to the learner Enrollment and Activity", async () => {
    mockPrisma.attempt.findFirst.mockResolvedValue(null);

    const result = await completeCefrActivityAttempt({
      userId: 42,
      programSlug: "german-a1",
      dayNumber: 1,
      activityId: "activity-1",
      attemptId: "attempt-other",
      now: NOW,
    });

    expect(result.type).toBe("ATTEMPT_NOT_FOUND");
    expect(mockPrisma.response.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.attempt.updateMany).not.toHaveBeenCalled();
  });

  test("returns an already-completed Attempt idempotently", async () => {
    mockPrisma.attempt.findFirst.mockResolvedValue({
      id: "attempt-1",
      attemptNumber: 1,
      status: "COMPLETED",
      startedAt: NOW,
      completedAt: new Date("2026-09-10T15:10:00.000Z"),
    });

    const result = await completeCefrActivityAttempt({
      userId: 42,
      programSlug: "german-a1",
      dayNumber: 1,
      activityId: "activity-1",
      attemptId: "attempt-1",
      now: NOW,
    });

    expect(result.type).toBe("OK");
    expect(result.alreadyCompleted).toBe(true);
    expect(result.attempt.status).toBe("COMPLETED");
    expect(mockPrisma.response.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.attempt.updateMany).not.toHaveBeenCalled();
  });

  test("does not complete AUTO activity until every item has a correct Response in this Attempt", async () => {
    mockPrisma.attempt.findFirst.mockResolvedValue({
      id: "attempt-1",
      attemptNumber: 1,
      status: "IN_PROGRESS",
      startedAt: NOW,
      completedAt: null,
    });

    mockPrisma.response.findMany.mockResolvedValue([
      {
        activityItemId: "item-1",
        isCorrect: true,
        evaluationCode: "CORRECT",
      },
      {
        activityItemId: "item-2",
        isCorrect: false,
        evaluationCode: "INCORRECT",
      },
    ]);

    const result = await completeCefrActivityAttempt({
      userId: 42,
      programSlug: "german-a1",
      dayNumber: 1,
      activityId: "activity-1",
      attemptId: "attempt-1",
      now: NOW,
    });

    expect(result.type).toBe("ACTIVITY_INCOMPLETE");
    expect(result.completedItemIds).toEqual(["item-1"]);
    expect(result.missingItemIds).toEqual(["item-2"]);
    expect(mockPrisma.attempt.updateMany).not.toHaveBeenCalled();
  });

  test("completes AUTO activity when every item has a correct Response", async () => {
    mockPrisma.attempt.findFirst
      .mockResolvedValueOnce({
        id: "attempt-1",
        attemptNumber: 1,
        status: "IN_PROGRESS",
        startedAt: NOW,
        completedAt: null,
      })
      .mockResolvedValueOnce({
        id: "attempt-1",
        attemptNumber: 1,
        status: "COMPLETED",
        startedAt: NOW,
        completedAt: NOW,
      });

    mockPrisma.response.findMany.mockResolvedValue([
      {
        activityItemId: "item-1",
        isCorrect: false,
        evaluationCode: "INCORRECT",
      },
      {
        activityItemId: "item-1",
        isCorrect: true,
        evaluationCode: "CORRECT",
      },
      {
        activityItemId: "item-2",
        isCorrect: true,
        evaluationCode: "CORRECT",
      },
    ]);

    const result = await completeCefrActivityAttempt({
      userId: 42,
      programSlug: "german-a1",
      dayNumber: 1,
      activityId: "activity-1",
      attemptId: "attempt-1",
      now: NOW,
    });

    expect(mockPrisma.response.findMany).toHaveBeenCalledWith({
      where: {
        attemptId: "attempt-1",
        activityItemId: {
          in: ["item-1", "item-2"],
        },
      },
      select: {
        activityItemId: true,
        isCorrect: true,
        evaluationCode: true,
      },
    });

    expect(mockPrisma.attempt.updateMany).toHaveBeenCalledWith({
      where: {
        id: "attempt-1",
        enrollmentId: "enrollment-1",
        activityId: "activity-1",
        status: "IN_PROGRESS",
        completedAt: null,
      },
      data: {
        status: "COMPLETED",
        completedAt: NOW,
      },
    });

    expect(result.type).toBe("OK");
    expect(result.alreadyCompleted).toBe(false);
    expect(result.attempt.status).toBe("COMPLETED");
  });

  test("completes SELF_ATTESTED activity only with SELF_ATTESTED_COMPLETE evidence", async () => {
    mockGetCefrDayDetail.mockResolvedValue(
      completionDayResult({
        evaluationMode: "SELF_ATTESTED",
        items: [{ id: "item-1", itemKey: "item-1" }],
      }),
    );

    mockPrisma.attempt.findFirst
      .mockResolvedValueOnce({
        id: "attempt-1",
        attemptNumber: 1,
        status: "IN_PROGRESS",
        startedAt: NOW,
        completedAt: null,
      })
      .mockResolvedValueOnce({
        id: "attempt-1",
        attemptNumber: 1,
        status: "COMPLETED",
        startedAt: NOW,
        completedAt: NOW,
      });

    mockPrisma.response.findMany.mockResolvedValue([
      {
        activityItemId: "item-1",
        isCorrect: null,
        evaluationCode: "SELF_ATTESTED_COMPLETE",
      },
    ]);

    const result = await completeCefrActivityAttempt({
      userId: 42,
      programSlug: "german-a1",
      dayNumber: 1,
      activityId: "activity-1",
      attemptId: "attempt-1",
      now: NOW,
    });

    expect(result.type).toBe("OK");
    expect(result.attempt.status).toBe("COMPLETED");
  });

  test("recovers idempotently when another request completes the Attempt first", async () => {
    mockPrisma.attempt.findFirst
      .mockResolvedValueOnce({
        id: "attempt-1",
        attemptNumber: 1,
        status: "IN_PROGRESS",
        startedAt: NOW,
        completedAt: null,
      })
      .mockResolvedValueOnce({
        id: "attempt-1",
        attemptNumber: 1,
        status: "COMPLETED",
        startedAt: NOW,
        completedAt: NOW,
      });

    mockPrisma.response.findMany.mockResolvedValue([
      {
        activityItemId: "item-1",
        isCorrect: true,
        evaluationCode: "CORRECT",
      },
      {
        activityItemId: "item-2",
        isCorrect: true,
        evaluationCode: "CORRECT",
      },
    ]);

    mockPrisma.attempt.updateMany.mockResolvedValue({
      count: 0,
    });

    const result = await completeCefrActivityAttempt({
      userId: 42,
      programSlug: "german-a1",
      dayNumber: 1,
      activityId: "activity-1",
      attemptId: "attempt-1",
      now: NOW,
    });

    expect(result.type).toBe("OK");
    expect(result.alreadyCompleted).toBe(true);
    expect(result.attempt.status).toBe("COMPLETED");
  });
});
