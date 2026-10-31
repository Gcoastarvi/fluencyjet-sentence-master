import {
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

import {
  submitMemoryFormB,
} from "../services/memoryFormBSubmission.js";

const SESSION = "a".repeat(64);
const PURCHASE = "verified-purchase-1";

const COMPLETED_AT = new Date(
  "2026-10-31T10:00:00.000Z"
);

function fixture({
  trackId = "school_foundation",
  purchaseId = PURCHASE,
  assessmentSessionId = null,
  valid = true,
  existing = null,
  responses = {},
} = {}) {
  const findUnique = jest.fn(
    async () => existing
  );

  const create = jest.fn(async ({ data }) => ({
    id: "form-b-only-1",
    ...data,
  }));

  const baselineFind = jest.fn();
  const baselineUpdate = jest.fn();

  const tx = {
    memoryFormBOnlyResult: {
      findUnique,
      create,
    },
    memoryAssessmentSession: {
      findUnique: baselineFind,
      updateMany: baselineUpdate,
    },
  };

  const prisma = {
    $transaction: jest.fn(
      async (callback) => callback(tx)
    ),
  };

  const sessionValidator = jest.fn(async () => ({
    valid,
    purchaseId,
    assessmentSessionId,
    trackId,
  }));

  const submit = (overrides = {}) =>
    submitMemoryFormB(
      {
        sessionToken: SESSION,
        responses,
        ...overrides,
      },
      {
        prisma,
        sessionValidator,
        now: () => COMPLETED_AT,
      },
    );

  return {
    submit,
    prisma,
    tx,
    findUnique,
    create,
    baselineFind,
    baselineUpdate,
    sessionValidator,
  };
}

describe("Form B-only authenticated submission", () => {
  test.each([
    "school_foundation",
    "school_advanced",
    "advanced",
  ])(
    "saves authoritative %s score without Form A",
    async (trackId) => {
      const h = fixture({ trackId });

      const result = await h.submit();

      expect(result.saved).toBe(true);
      expect(result.trackId).toBe(trackId);
      expect(result.formAScore).toBeNull();
      expect(result.improvementPoints).toBeNull();

      expect(Number.isFinite(result.formBScore))
        .toBe(true);

      expect(result.formBScore).toBeGreaterThanOrEqual(0);
      expect(result.formBScore).toBeLessThanOrEqual(100);

      expect(result.formBCompletedAt)
        .toBe(COMPLETED_AT.toISOString());

      expect(h.findUnique).toHaveBeenCalledWith({
        where: { purchaseId: PURCHASE },
        select: { id: true },
      });

      expect(h.create).toHaveBeenCalledTimes(1);

      const data = h.create.mock.calls[0][0].data;

      expect(data.purchaseId).toBe(PURCHASE);
      expect(data.trackId).toBe(trackId);
      expect(data.formBScore).toBe(result.formBScore);
      expect(data.formBResult.form).toBe("B");

      expect(h.baselineFind).not.toHaveBeenCalled();
      expect(h.baselineUpdate).not.toHaveBeenCalled();
    }
  );

  test("ignores forged browser scores and purchase IDs", async () => {
    const h = fixture({
      responses: {
        formAScore: 100,
        formBScore: 100,
        purchaseId: "attacker-purchase",
        trackId: "advanced",
        immediateAnswers: [],
        orderedAnswers: [],
        associationAnswers: {},
        academicAnswers: {},
        delayedAnswers: [],
      },
    });

    const result = await h.submit();

    expect(result.saved).toBe(true);

    const data = h.create.mock.calls[0][0].data;

    expect(data.purchaseId).toBe(PURCHASE);
    expect(data.trackId).toBe("school_foundation");

    expect(data.formBAnswers)
      .not.toHaveProperty("purchaseId");

    expect(data.formBAnswers)
      .not.toHaveProperty("formAScore");

    expect(data.formBAnswers)
      .not.toHaveProperty("formBScore");
  });

  test("rejects an existing completed result", async () => {
    const h = fixture({
      existing: { id: "previous-result" },
    });

    const result = await h.submit();

    expect(result).toEqual({
      saved: false,
      code: "FORM_B_ALREADY_COMPLETED",
    });

    expect(h.create).not.toHaveBeenCalled();
  });

  test("rejects an invalid retest session", async () => {
    const h = fixture({ valid: false });

    const result = await h.submit();

    expect(result).toEqual({
      saved: false,
      code: "INVALID_RETEST_SESSION",
    });

    expect(h.create).not.toHaveBeenCalled();
  });

  test("rejects missing purchase identity", async () => {
    const h = fixture({ purchaseId: null });

    const result = await h.submit();

    expect(result.code).toBe(
      "INVALID_RETEST_SESSION"
    );

    expect(h.findUnique).not.toHaveBeenCalled();
    expect(h.create).not.toHaveBeenCalled();
  });

  test("rejects unsupported track", async () => {
    const h = fixture({ trackId: "invalid_track" });

    const result = await h.submit();

    expect(result.code).toBe(
      "INVALID_RETEST_SESSION"
    );

    expect(h.create).not.toHaveBeenCalled();
  });

  test("rejects malformed assessment association", async () => {
    const h = fixture({
      assessmentSessionId: undefined,
    });

    h.sessionValidator.mockResolvedValueOnce({
      valid: true,
      purchaseId: PURCHASE,
      trackId: "school_foundation",
    });

    const result = await h.submit();

    expect(result.code).toBe(
      "INVALID_RETEST_SESSION"
    );

    expect(h.create).not.toHaveBeenCalled();
  });

  test("rejects concurrent duplicate unique purchase", async () => {
    const h = fixture();

    const conflict = new Error(
      "Simulated unique constraint"
    );

    conflict.code = "P2002";
    conflict.meta = {
      modelName: "MemoryFormBOnlyResult",
      target: ["purchaseId"],
    };

    h.create.mockRejectedValueOnce(conflict);

    const result = await h.submit();

    expect(result).toEqual({
      saved: false,
      code: "FORM_B_ALREADY_COMPLETED",
    });
  });

  test("does not hide unrelated unique errors", async () => {
    const h = fixture();

    const conflict = new Error(
      "Unrelated unique constraint"
    );

    conflict.code = "P2002";
    conflict.meta = {
      modelName: "OtherModel",
      target: ["otherField"],
    };

    h.create.mockRejectedValueOnce(conflict);

    await expect(h.submit()).rejects.toThrow(
      "Unrelated unique constraint"
    );
  });

  test("handles serialization conflicts", async () => {
    const h = fixture();

    const conflict = new Error(
      "Simulated transaction conflict"
    );

    conflict.code = "P2034";

    h.create.mockRejectedValueOnce(conflict);

    const result = await h.submit();

    expect(result).toEqual({
      saved: false,
      code: "SUBMISSION_CONFLICT_RETRY",
    });
  });

  test("does not conceal unexpected database failures", async () => {
    const h = fixture();

    h.create.mockRejectedValueOnce(
      new Error("Simulated database failure")
    );

    await expect(h.submit()).rejects.toThrow(
      "Simulated database failure"
    );
  });
});
