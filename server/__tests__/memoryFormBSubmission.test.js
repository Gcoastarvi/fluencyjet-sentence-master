import {
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

import {
  submitMemoryFormB,
} from "../services/memoryFormBSubmission.js";

const TOKEN = "a".repeat(64);
const NOW = new Date("2026-11-01T10:00:00.000Z");

const EMPTY_RESPONSES = {
  immediateAnswers: [],
  orderedAnswers: [],
  associationAnswers: {},
  academicAnswers: {},
  delayedAnswers: [],
};

function makeHarness({
  trackId = "school_foundation",
  baselineTrackId = trackId,
  status = "LEAD_CAPTURED",
  formAScore = 65,
  completedAt = null,
  sessionValid = true,
} = {}) {
  const state = { completedAt };

  const sessionValidator = jest.fn(async () => ({
    valid: sessionValid,
    assessmentSessionId: "baseline-1",
    trackId,
  }));

  const findUnique = jest.fn(async () => ({
    id: "baseline-1",
    trackId: baselineTrackId,
    status,
    formAScore,
    formBCompletedAt: state.completedAt,
  }));

  const updateMany = jest.fn(async ({ where, data }) => {
    if (
      state.completedAt !== null ||
      where.id !== "baseline-1" ||
      where.trackId !== baselineTrackId ||
      !where.status.in.includes(status)
    ) {
      return { count: 0 };
    }

    state.completedAt = data.formBCompletedAt;
    return { count: 1 };
  });

  const tx = {
    memoryAssessmentSession: {
      findUnique,
      updateMany,
    },
  };

  const prisma = {
    $transaction: jest.fn(async (callback) => callback(tx)),
  };

  function submit(overrides = {}) {
    return submitMemoryFormB(
      {
        sessionToken: TOKEN,
        responses: EMPTY_RESPONSES,
        ...overrides,
      },
      {
        prisma,
        sessionValidator,
        now: () => new Date(NOW),
      },
    );
  }

  return {
    prisma,
    tx,
    state,
    findUnique,
    updateMany,
    sessionValidator,
    submit,
  };
}

describe("Secure Form B submission", () => {
  test.each([
    "school_foundation",
    "school_advanced",
    "advanced",
  ])("saves authoritative scores for %s", async (trackId) => {
    const h = makeHarness({ trackId });

    const result = await h.submit();

    expect(result).toMatchObject({
      saved: true,
      trackId,
      formAScore: 65,
      formBScore: 0,
      improvementPoints: -65,
      formBCompletedAt: NOW.toISOString(),
    });

    expect(h.sessionValidator).toHaveBeenCalledWith(
      { sessionToken: TOKEN },
      { prisma: h.tx },
    );

    expect(h.prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "Serializable" },
    );

    const { where, data } =
      h.updateMany.mock.calls[0][0];

    expect(where).toMatchObject({
      id: "baseline-1",
      trackId,
      formBCompletedAt: null,
    });

    expect(data.formBResult).toMatchObject({
      trackId,
      form: "B",
      totalScore: 0,
      maxScore: 100,
    });

    expect(data.formBScore).toBe(0);
    expect(data.formBRetentionRatio).toBeNull();
    expect(data.formBCompletedAt).toEqual(NOW);

    // Original Form A results must not change.
    expect(data.formAScore).toBeUndefined();
    expect(data.formAAnswers).toBeUndefined();
    expect(data.formAResult).toBeUndefined();
    expect(data.status).toBeUndefined();
  });

  test("ignores forged browser scores and tracks", async () => {
    const h = makeHarness();

    const result = await h.submit({
      trackId: "advanced",
      form: "A",
      score: 100,
      result: { totalScore: 100 },
      responses: {
        immediateAnswers: ["camera", "banana"],
        orderedAnswers: ["chair", "", "train"],
        associationAnswers: {
          drum: "46",
          unauthorized: "999",
        },
        academicAnswers: {
          habitat: "dry hills",
          unauthorized: "999",
        },
        delayedAnswers: [],
        arbitraryField: "should not be stored",
      },
    });

    expect(result.saved).toBe(true);
    expect(result.trackId).toBe("school_foundation");
    expect(result.formBScore).toBeGreaterThan(0);
    expect(result.formBScore).toBeLessThan(100);

    const data = h.updateMany.mock.calls[0][0].data;

    expect(data.formBResult.form).toBe("B");

    expect(data.formBAnswers).toEqual({
      immediateAnswers: ["camera", "banana"],
      orderedAnswers: ["chair", "", "train"],
      associationAnswers: { drum: "46" },
      academicAnswers: { habitat: "dry hills" },
      delayedAnswers: [],
    });

    expect(data.formBScore).toBe(result.formBScore);
  });

  test.each([
    "",
    "invalid",
    "A".repeat(64),
  ])("rejects malformed session tokens", async (token) => {
    const h = makeHarness();

    const result = await h.submit({
      sessionToken: token,
    });

    expect(result).toEqual({
      saved: false,
      code: "INVALID_RETEST_SESSION",
    });

    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  test.each([
    null,
    [],
    "invalid",
  ])("rejects malformed answers", async (responses) => {
    const h = makeHarness();

    const result = await h.submit({ responses });

    expect(result).toEqual({
      saved: false,
      code: "INVALID_FORM_B_RESPONSES",
    });

    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  test("rejects revoked or invalid sessions", async () => {
    const h = makeHarness({ sessionValid: false });

    const result = await h.submit();

    expect(result.code).toBe("INVALID_RETEST_SESSION");
    expect(h.findUnique).not.toHaveBeenCalled();
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  test("rejects an unsupported track", async () => {
    const h = makeHarness({ trackId: "unknown" });

    const result = await h.submit();

    expect(result.code).toBe("INVALID_RETEST_SESSION");
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  test("rejects a missing Form A baseline", async () => {
    const h = makeHarness();

    h.findUnique.mockResolvedValueOnce(null);

    const result = await h.submit();

    expect(result.code).toBe("BASELINE_UNAVAILABLE");
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  test("rejects a baseline from another track", async () => {
    const h = makeHarness({
      baselineTrackId: "advanced",
    });

    const result = await h.submit();

    expect(result.code).toBe("BASELINE_UNAVAILABLE");
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  test("rejects completed assessments", async () => {
    const h = makeHarness({
      completedAt: new Date("2026-10-31T08:00:00Z"),
    });

    const result = await h.submit();

    expect(result.code).toBe("FORM_B_ALREADY_COMPLETED");
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  test("rejects unsupported baseline status", async () => {
    const h = makeHarness({ status: "CANCELLED" });

    const result = await h.submit();

    expect(result.code).toBe("BASELINE_UNAVAILABLE");
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  test("rejects invalid Form A scores", async () => {
    const h = makeHarness({ formAScore: 120 });

    const result = await h.submit();

    expect(result.code).toBe("BASELINE_UNAVAILABLE");
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  test("second submission cannot overwrite first", async () => {
    const h = makeHarness();

    const first = await h.submit();
    const second = await h.submit();

    expect(first.saved).toBe(true);

    expect(second).toEqual({
      saved: false,
      code: "FORM_B_ALREADY_COMPLETED",
    });

    expect(h.updateMany).toHaveBeenCalledTimes(1);
  });

  test("concurrent submissions allow at most one save", async () => {
    const h = makeHarness();

    h.findUnique.mockImplementation(async () => ({
      id: "baseline-1",
      trackId: "school_foundation",
      status: "LEAD_CAPTURED",
      formAScore: 65,
      formBCompletedAt: null,
    }));

    let claimed = false;

    h.updateMany.mockImplementation(async () => {
      if (claimed) return { count: 0 };

      claimed = true;
      return { count: 1 };
    });

    const results = await Promise.all([
      h.submit(),
      h.submit(),
    ]);

    expect(results.filter((r) => r.saved))
      .toHaveLength(1);

    expect(
      results.filter(
        (r) => r.code === "FORM_B_ALREADY_COMPLETED",
      ),
    ).toHaveLength(1);
  });

  test("handles serialization conflicts", async () => {
    const h = makeHarness();

    h.prisma.$transaction.mockRejectedValueOnce(
      Object.assign(
        new Error("Serialization conflict"),
        { code: "P2034" },
      ),
    );

    const result = await h.submit();

    expect(result).toEqual({
      saved: false,
      code: "SUBMISSION_CONFLICT_RETRY",
    });
  });

  test("does not conceal unexpected database errors", async () => {
    const h = makeHarness();

    h.prisma.$transaction.mockRejectedValueOnce(
      new Error("Simulated database outage"),
    );

    await expect(h.submit()).rejects.toThrow(
      "Simulated database outage",
    );
  });
});
