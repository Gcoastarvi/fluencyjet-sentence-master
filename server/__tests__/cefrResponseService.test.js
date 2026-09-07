import {
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

const mockGetCefrDayDetail = jest.fn();
const mockEvaluateCefrSubmission = jest.fn();

const mockPrisma = {
  attempt: {
    findFirst: jest.fn(),
  },
  activityItem: {
    findFirst: jest.fn(),
  },
  response: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
};

jest.unstable_mockModule("../db/client.js", () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule("../services/cefrAccessService.js", () => ({
  getCefrDayDetail: mockGetCefrDayDetail,
}));

jest.unstable_mockModule("../services/cefrEvaluator.js", () => ({
  evaluateCefrSubmission: mockEvaluateCefrSubmission,
}));

const { submitCefrActivityResponse } = await import(
  "../services/cefrResponseService.js"
);

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
    },
    cohort: {
      id: "cohort-1",
    },
    day: {
      id: "day-1",
      dayNumber: 1,
      activities: [
        {
          id: "activity-1",
          key: "greetings-reorder",
          activityType: "REORDER",
          evaluationMode: "AUTO",
          items: [
            {
              id: "item-1",
              itemKey: "greeting-1",
            },
          ],
        },
      ],
    },
  };
}

function baseInput(overrides = {}) {
  return {
    userId: 42,
    programSlug: "german-a1",
    dayNumber: 1,
    activityId: "activity-1",
    attemptId: "attempt-1",
    activityItemId: "item-1",
    submittedAnswer: {
      tokens: ["Guten", "Morgen."],
    },
    now: new Date("2026-09-07T03:30:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCefrDayDetail.mockResolvedValue(unlockedDayResult());
});

describe("submitCefrActivityResponse", () => {
  test("passes through a locked-day access result without reading answer data", async () => {
    mockGetCefrDayDetail.mockResolvedValue({
      type: "DAY_LOCKED",
      day: {
        id: "day-1",
        dayNumber: 1,
        accessState: "SCHEDULED",
      },
    });

    const result = await submitCefrActivityResponse(baseInput());

    expect(result.type).toBe("DAY_LOCKED");
    expect(mockPrisma.attempt.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.activityItem.findFirst).not.toHaveBeenCalled();
    expect(mockEvaluateCefrSubmission).not.toHaveBeenCalled();
  });

  test("rejects an activity that is not part of the authorized day", async () => {
    const result = await submitCefrActivityResponse(
      baseInput({
        activityId: "other-activity",
      }),
    );

    expect(result.type).toBe("ACTIVITY_NOT_FOUND");
    expect(mockPrisma.attempt.findFirst).not.toHaveBeenCalled();
  });

  test("rejects an ActivityItem that is not part of the authorized activity", async () => {
    const result = await submitCefrActivityResponse(
      baseInput({
        activityItemId: "other-item",
      }),
    );

    expect(result.type).toBe("ACTIVITY_ITEM_NOT_FOUND");
    expect(mockPrisma.activityItem.findFirst).not.toHaveBeenCalled();
  });

  test("rejects an Attempt that does not belong to the learner Enrollment and Activity", async () => {
    mockPrisma.attempt.findFirst.mockResolvedValue(null);

    const result = await submitCefrActivityResponse(baseInput());

    expect(result.type).toBe("ATTEMPT_NOT_FOUND");

    expect(mockPrisma.attempt.findFirst).toHaveBeenCalledWith({
      where: {
        id: "attempt-1",
        enrollmentId: "enrollment-1",
        activityId: "activity-1",
      },
      select: {
        id: true,
        attemptNumber: true,
        status: true,
        completedAt: true,
      },
    });

    expect(mockPrisma.activityItem.findFirst).not.toHaveBeenCalled();
  });

  test("rejects an Attempt that is no longer open", async () => {
    mockPrisma.attempt.findFirst.mockResolvedValue({
      id: "attempt-1",
      attemptNumber: 1,
      status: "COMPLETED",
      completedAt: new Date("2026-09-07T03:20:00.000Z"),
    });

    const result = await submitCefrActivityResponse(baseInput());

    expect(result.type).toBe("ATTEMPT_NOT_OPEN");
    expect(mockPrisma.activityItem.findFirst).not.toHaveBeenCalled();
  });

  test("does not persist an invalid learner submission", async () => {
    mockPrisma.attempt.findFirst.mockResolvedValue({
      id: "attempt-1",
      attemptNumber: 1,
      status: "IN_PROGRESS",
      completedAt: null,
    });

    mockPrisma.activityItem.findFirst.mockResolvedValue({
      id: "item-1",
      answerKey: {
        type: "TOKEN_SEQUENCE",
        tokens: ["Guten", "Morgen."],
      },
      activity: {
        evaluationMode: "AUTO",
      },
    });

    mockEvaluateCefrSubmission.mockReturnValue({
      ok: false,
      isCorrect: null,
      evaluationCode: "INVALID_SUBMISSION",
      score: null,
    });

    const result = await submitCefrActivityResponse(
      baseInput({
        submittedAnswer: {},
      }),
    );

    expect(result.type).toBe("INVALID_SUBMISSION");
    expect(mockPrisma.response.create).not.toHaveBeenCalled();
  });

  test("fails closed and does not persist when evaluator configuration is invalid", async () => {
    mockPrisma.attempt.findFirst.mockResolvedValue({
      id: "attempt-1",
      attemptNumber: 1,
      status: "IN_PROGRESS",
      completedAt: null,
    });

    mockPrisma.activityItem.findFirst.mockResolvedValue({
      id: "item-1",
      answerKey: {
        type: "UNKNOWN_TYPE",
      },
      activity: {
        evaluationMode: "AUTO",
      },
    });

    mockEvaluateCefrSubmission.mockReturnValue({
      ok: false,
      isCorrect: null,
      evaluationCode: "EVALUATOR_CONFIG_ERROR",
      score: null,
    });

    const result = await submitCefrActivityResponse(baseInput());

    expect(result.type).toBe("EVALUATOR_CONFIG_ERROR");
    expect(mockPrisma.response.create).not.toHaveBeenCalled();
  });

  test("creates the first durable Response using server-side evaluation", async () => {
    mockPrisma.attempt.findFirst.mockResolvedValue({
      id: "attempt-1",
      attemptNumber: 1,
      status: "IN_PROGRESS",
      completedAt: null,
    });

    const answerKey = {
      type: "TOKEN_SEQUENCE",
      tokens: ["Guten", "Morgen."],
    };

    mockPrisma.activityItem.findFirst.mockResolvedValue({
      id: "item-1",
      answerKey,
      activity: {
        evaluationMode: "AUTO",
      },
    });

    mockEvaluateCefrSubmission.mockReturnValue({
      ok: true,
      isCorrect: true,
      evaluationCode: "CORRECT",
      score: 1,
    });

    mockPrisma.response.findFirst.mockResolvedValue(null);

    mockPrisma.response.create.mockResolvedValue({
      id: "response-1",
      attemptId: "attempt-1",
      activityItemId: "item-1",
      responseNumber: 1,
      submittedAnswer: {
        tokens: ["Guten", "Morgen."],
      },
      isCorrect: true,
      evaluationCode: "CORRECT",
      score: 1,
      hintUsed: false,
      answerRevealed: false,
      responseTimeMs: null,
      submittedAt: new Date("2026-09-07T03:30:00.000Z"),
    });

    const input = baseInput();
    const result = await submitCefrActivityResponse(input);

    expect(mockEvaluateCefrSubmission).toHaveBeenCalledWith({
      evaluationMode: "AUTO",
      answerKey,
      submittedAnswer: input.submittedAnswer,
    });

    expect(mockPrisma.response.create).toHaveBeenCalledWith({
      data: {
        attemptId: "attempt-1",
        activityItemId: "item-1",
        responseNumber: 1,
        submittedAnswer: input.submittedAnswer,
        isCorrect: true,
        evaluationCode: "CORRECT",
        score: 1,
        hintUsed: false,
        answerRevealed: false,
        responseTimeMs: null,
        submittedAt: input.now,
      },
      select: {
        id: true,
        attemptId: true,
        activityItemId: true,
        responseNumber: true,
        submittedAnswer: true,
        isCorrect: true,
        evaluationCode: true,
        score: true,
        hintUsed: true,
        answerRevealed: true,
        responseTimeMs: true,
        submittedAt: true,
      },
    });

    expect(result.type).toBe("OK");
    expect(result.response.id).toBe("response-1");
    expect(result.response.responseNumber).toBe(1);
  });

  test("drops responseTimeMs that exceeds the Prisma Int range", async () => {
    mockPrisma.attempt.findFirst.mockResolvedValue({
      id: "attempt-1",
      attemptNumber: 1,
      status: "IN_PROGRESS",
      completedAt: null,
    });

    mockPrisma.activityItem.findFirst.mockResolvedValue({
      id: "item-1",
      answerKey: {
        type: "TOKEN_SEQUENCE",
        tokens: ["Guten", "Morgen."],
      },
      activity: {
        evaluationMode: "AUTO",
      },
    });

    mockEvaluateCefrSubmission.mockReturnValue({
      ok: true,
      isCorrect: true,
      evaluationCode: "CORRECT",
      score: 1,
    });

    mockPrisma.response.findFirst.mockResolvedValue(null);

    mockPrisma.response.create.mockImplementation(async ({ data }) => ({
      id: "response-1",
      ...data,
    }));

    await submitCefrActivityResponse(
      baseInput({
        responseTimeMs: 2147483648,
      }),
    );

    expect(
      mockPrisma.response.create.mock.calls[0][0].data.responseTimeMs,
    ).toBeNull();
  });

  test("appends a retry instead of overwriting the previous Response", async () => {
    mockPrisma.attempt.findFirst.mockResolvedValue({
      id: "attempt-1",
      attemptNumber: 1,
      status: "IN_PROGRESS",
      completedAt: null,
    });

    mockPrisma.activityItem.findFirst.mockResolvedValue({
      id: "item-1",
      answerKey: {
        type: "TEXT",
        acceptedAnswers: ["Ich heiße Anna."],
      },
      activity: {
        evaluationMode: "AUTO",
      },
    });

    mockEvaluateCefrSubmission.mockReturnValue({
      ok: true,
      isCorrect: true,
      evaluationCode: "CORRECT",
      score: 1,
    });

    mockPrisma.response.findFirst.mockResolvedValue({
      responseNumber: 1,
    });

    mockPrisma.response.create.mockResolvedValue({
      id: "response-2",
      attemptId: "attempt-1",
      activityItemId: "item-1",
      responseNumber: 2,
      submittedAnswer: {
        text: "Ich heiße Anna.",
      },
      isCorrect: true,
      evaluationCode: "CORRECT",
      score: 1,
      hintUsed: false,
      answerRevealed: false,
      responseTimeMs: null,
      submittedAt: new Date("2026-09-07T03:30:00.000Z"),
    });

    const result = await submitCefrActivityResponse(
      baseInput({
        submittedAnswer: {
          text: "Ich heiße Anna.",
        },
      }),
    );

    expect(mockPrisma.response.findFirst).toHaveBeenCalledWith({
      where: {
        attemptId: "attempt-1",
        activityItemId: "item-1",
      },
      orderBy: {
        responseNumber: "desc",
      },
      select: {
        responseNumber: true,
      },
    });

    expect(mockPrisma.response.create.mock.calls[0][0].data.responseNumber).toBe(
      2,
    );

    expect(result.type).toBe("OK");
    expect(result.response.responseNumber).toBe(2);
  });

  test("retries with the next responseNumber after a concurrent unique-key race", async () => {
    mockPrisma.attempt.findFirst.mockResolvedValue({
      id: "attempt-1",
      attemptNumber: 1,
      status: "IN_PROGRESS",
      completedAt: null,
    });

    mockPrisma.activityItem.findFirst.mockResolvedValue({
      id: "item-1",
      answerKey: {
        type: "SINGLE_CHOICE",
        correctOptionId: "option-b",
      },
      activity: {
        evaluationMode: "AUTO",
      },
    });

    mockEvaluateCefrSubmission.mockReturnValue({
      ok: true,
      isCorrect: false,
      evaluationCode: "INCORRECT",
      score: 0,
    });

    mockPrisma.response.findFirst
      .mockResolvedValueOnce({
        responseNumber: 1,
      })
      .mockResolvedValueOnce({
        responseNumber: 2,
      });

    const conflict = new Error("Unique constraint");
    conflict.code = "P2002";

    mockPrisma.response.create
      .mockRejectedValueOnce(conflict)
      .mockResolvedValueOnce({
        id: "response-3",
        attemptId: "attempt-1",
        activityItemId: "item-1",
        responseNumber: 3,
        submittedAnswer: {
          optionId: "option-a",
        },
        isCorrect: false,
        evaluationCode: "INCORRECT",
        score: 0,
        hintUsed: false,
        answerRevealed: false,
        responseTimeMs: null,
        submittedAt: new Date("2026-09-07T03:30:00.000Z"),
      });

    const result = await submitCefrActivityResponse(
      baseInput({
        submittedAnswer: {
          optionId: "option-a",
        },
      }),
    );

    expect(mockPrisma.response.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.response.create.mock.calls[0][0].data.responseNumber).toBe(
      2,
    );
    expect(mockPrisma.response.create.mock.calls[1][0].data.responseNumber).toBe(
      3,
    );

    expect(result.type).toBe("OK");
    expect(result.response.responseNumber).toBe(3);
  });
});
