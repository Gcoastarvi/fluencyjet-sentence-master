import {
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

const mockPrisma = {
  response: {
    findUnique: jest.fn(),
  },
  xpLedger: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

jest.unstable_mockModule("../db/client.js", () => ({
  default: mockPrisma,
}));

const { awardCefrResponseXp } = await import(
  "../services/cefrXpService.js"
);

const XP_CONFIG = {
  ruleVersion: "cefr-xp-v1",
  firstCorrect: 150,
  retryCorrect: 75,
  selfAttestedComplete: 100,
};

function responseEvidence(overrides = {}) {
  const base = {
    id: "response-1",
    activityItemId: "item-1",
    responseNumber: 1,
    isCorrect: true,
    evaluationCode: "CORRECT",
    attempt: {
      id: "attempt-1",
      attemptNumber: 1,
      enrollmentId: "enrollment-1",
      activityId: "activity-1",
      enrollment: {
        userId: 42,
      },
      activity: {
        xpConfig: XP_CONFIG,
      },
    },
    activityItem: {
      activityId: "activity-1",
    },
  };

  return {
    ...base,
    ...overrides,
    attempt: {
      ...base.attempt,
      ...(overrides.attempt || {}),
      enrollment: {
        ...base.attempt.enrollment,
        ...(overrides.attempt?.enrollment || {}),
      },
      activity: {
        ...base.attempt.activity,
        ...(overrides.attempt?.activity || {}),
      },
    },
    activityItem: {
      ...base.activityItem,
      ...(overrides.activityItem || {}),
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.xpLedger.findUnique.mockResolvedValue(null);
});

describe("awardCefrResponseXp", () => {
  test("returns RESPONSE_NOT_FOUND when durable Response does not exist", async () => {
    mockPrisma.response.findUnique.mockResolvedValue(null);

    const result = await awardCefrResponseXp({
      responseId: "missing-response",
    });

    expect(result.type).toBe("RESPONSE_NOT_FOUND");
    expect(mockPrisma.xpLedger.create).not.toHaveBeenCalled();
  });

  test("does not award XP for an incorrect Response", async () => {
    mockPrisma.response.findUnique.mockResolvedValue(
      responseEvidence({
        isCorrect: false,
        evaluationCode: "INCORRECT",
      }),
    );

    const result = await awardCefrResponseXp({
      responseId: "response-1",
    });

    expect(result.type).toBe("NO_AWARD");
    expect(result.reason).toBe("NOT_ELIGIBLE");
    expect(mockPrisma.xpLedger.create).not.toHaveBeenCalled();
  });

  test("awards first-correct XP for Attempt 1 Response 1", async () => {
    mockPrisma.response.findUnique.mockResolvedValue(responseEvidence());

    mockPrisma.xpLedger.create.mockResolvedValue({
      id: "xp-1",
      userId: 42,
      enrollmentId: "enrollment-1",
      activityId: "activity-1",
      attemptId: "attempt-1",
      responseId: "response-1",
      amount: 150,
      eventType: "ITEM_FIRST_CORRECT",
      ruleVersion: "cefr-xp-v1",
      idempotencyKey: "cefr:item-success:enrollment-1:item-1",
      metadata: {
        activityItemId: "item-1",
        attemptNumber: 1,
        responseNumber: 1,
        evaluationCode: "CORRECT",
      },
    });

    const result = await awardCefrResponseXp({
      responseId: "response-1",
    });

    expect(mockPrisma.xpLedger.create).toHaveBeenCalledWith({
      data: {
        userId: 42,
        enrollmentId: "enrollment-1",
        activityId: "activity-1",
        attemptId: "attempt-1",
        responseId: "response-1",
        amount: 150,
        eventType: "ITEM_FIRST_CORRECT",
        ruleVersion: "cefr-xp-v1",
        idempotencyKey: "cefr:item-success:enrollment-1:item-1",
        metadata: {
          activityItemId: "item-1",
          attemptNumber: 1,
          responseNumber: 1,
          evaluationCode: "CORRECT",
        },
      },
    });

    expect(result.type).toBe("OK");
    expect(result.idempotentReplay).toBe(false);
    expect(result.xp.amount).toBe(150);
  });

  test("awards retry-correct XP after the first Response", async () => {
    mockPrisma.response.findUnique.mockResolvedValue(
      responseEvidence({
        responseNumber: 2,
      }),
    );

    mockPrisma.xpLedger.create.mockImplementation(async ({ data }) => ({
      id: "xp-2",
      ...data,
    }));

    const result = await awardCefrResponseXp({
      responseId: "response-1",
    });

    expect(result.type).toBe("OK");
    expect(result.xp.amount).toBe(75);
    expect(result.xp.eventType).toBe("ITEM_RETRY_CORRECT");
  });

  test("treats a correct Response in a later Attempt as retry XP", async () => {
    mockPrisma.response.findUnique.mockResolvedValue(
      responseEvidence({
        attempt: {
          attemptNumber: 2,
        },
      }),
    );

    mockPrisma.xpLedger.create.mockImplementation(async ({ data }) => ({
      id: "xp-3",
      ...data,
    }));

    const result = await awardCefrResponseXp({
      responseId: "response-1",
    });

    expect(result.type).toBe("OK");
    expect(result.xp.amount).toBe(75);
    expect(result.xp.eventType).toBe("ITEM_RETRY_CORRECT");
  });

  test("awards SELF_ATTESTED completion XP", async () => {
    mockPrisma.response.findUnique.mockResolvedValue(
      responseEvidence({
        isCorrect: null,
        evaluationCode: "SELF_ATTESTED_COMPLETE",
      }),
    );

    mockPrisma.xpLedger.create.mockImplementation(async ({ data }) => ({
      id: "xp-4",
      ...data,
    }));

    const result = await awardCefrResponseXp({
      responseId: "response-1",
    });

    expect(result.type).toBe("OK");
    expect(result.xp.amount).toBe(100);
    expect(result.xp.eventType).toBe("ITEM_SELF_ATTESTED_COMPLETE");
  });

  test("returns an existing item-success award instead of awarding XP twice", async () => {
    mockPrisma.response.findUnique.mockResolvedValue(responseEvidence());

    mockPrisma.xpLedger.findUnique.mockResolvedValue({
      id: "xp-existing",
      amount: 150,
      eventType: "ITEM_FIRST_CORRECT",
      ruleVersion: "cefr-xp-v1",
      responseId: "response-old",
      idempotencyKey: "cefr:item-success:enrollment-1:item-1",
    });

    const result = await awardCefrResponseXp({
      responseId: "response-1",
    });

    expect(result.type).toBe("OK");
    expect(result.idempotentReplay).toBe(true);
    expect(result.xp.id).toBe("xp-existing");
    expect(mockPrisma.xpLedger.create).not.toHaveBeenCalled();
  });

  test("fails closed when Activity XP configuration is malformed", async () => {
    mockPrisma.response.findUnique.mockResolvedValue(
      responseEvidence({
        attempt: {
          activity: {
            xpConfig: {
              ruleVersion: "cefr-xp-v1",
              firstCorrect: "150",
            },
          },
        },
      }),
    );

    const result = await awardCefrResponseXp({
      responseId: "response-1",
    });

    expect(result.type).toBe("XP_CONFIG_ERROR");
    expect(mockPrisma.xpLedger.create).not.toHaveBeenCalled();
  });

  test("fails closed when Response evidence crosses Activity boundaries", async () => {
    mockPrisma.response.findUnique.mockResolvedValue(
      responseEvidence({
        activityItem: {
          activityId: "other-activity",
        },
      }),
    );

    const result = await awardCefrResponseXp({
      responseId: "response-1",
    });

    expect(result.type).toBe("EVIDENCE_CONFLICT");
    expect(mockPrisma.xpLedger.create).not.toHaveBeenCalled();
  });

  test("returns the concurrent ledger winner after P2002", async () => {
    mockPrisma.response.findUnique.mockResolvedValue(responseEvidence());

    const conflict = new Error("Unique constraint");
    conflict.code = "P2002";

    mockPrisma.xpLedger.create.mockRejectedValueOnce(conflict);

    mockPrisma.xpLedger.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "xp-winner",
        amount: 150,
        eventType: "ITEM_FIRST_CORRECT",
        ruleVersion: "cefr-xp-v1",
        responseId: "response-1",
        idempotencyKey: "cefr:item-success:enrollment-1:item-1",
      });

    const result = await awardCefrResponseXp({
      responseId: "response-1",
    });

    expect(mockPrisma.xpLedger.create).toHaveBeenCalledTimes(1);
    expect(result.type).toBe("OK");
    expect(result.idempotentReplay).toBe(true);
    expect(result.xp.id).toBe("xp-winner");
  });
});
