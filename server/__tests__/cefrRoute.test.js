import { jest, describe, test, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import express from "express";

const mockGetCefrProgramOverview = jest.fn();
const mockGetCefrDayDetail = jest.fn();
const mockStartCefrActivityAttempt = jest.fn();
const mockSubmitCefrActivityResponse = jest.fn();

jest.unstable_mockModule("../services/cefrAccessService.js", () => ({
  getCefrProgramOverview: mockGetCefrProgramOverview,
  getCefrDayDetail: mockGetCefrDayDetail,
}));

jest.unstable_mockModule("../services/cefrAttemptService.js", () => ({
  startCefrActivityAttempt: mockStartCefrActivityAttempt,
}));

jest.unstable_mockModule("../services/cefrResponseService.js", () => ({
  submitCefrActivityResponse: mockSubmitCefrActivityResponse,
}));

const { default: cefrRouter } = await import("../routes/cefr.js");

function makeApp(userId = 42) {
  const app = express();

  app.use(express.json());

  app.use((req, _res, next) => {
    req.user = userId ? { id: userId } : null;
    next();
  });

  app.use("/api/cefr", cefrRouter);

  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/cefr/programs/:programSlug", () => {
  test("returns 401 when learner is not authenticated", async () => {
    const res = await request(makeApp(null)).get(
      "/api/cefr/programs/german-a1",
    );

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      ok: false,
      message: "Unauthorized",
    });

    expect(mockGetCefrProgramOverview).not.toHaveBeenCalled();
  });

  test("rejects an invalid program slug", async () => {
    const res = await request(makeApp()).get(
      "/api/cefr/programs/INVALID_SLUG!",
    );

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.message).toBe("Invalid program slug");

    expect(mockGetCefrProgramOverview).not.toHaveBeenCalled();
  });

  test("returns 404 when the program does not exist", async () => {
    mockGetCefrProgramOverview.mockResolvedValue({
      type: "PROGRAM_NOT_FOUND",
    });

    const res = await request(makeApp()).get(
      "/api/cefr/programs/german-a1",
    );

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      ok: false,
      message: "Program not found",
    });
  });

  test("returns 403 when learner has no active enrollment", async () => {
    mockGetCefrProgramOverview.mockResolvedValue({
      type: "ENROLLMENT_REQUIRED",
      program: {
        id: "program-1",
        slug: "german-a1",
        name: "German A1",
        cefrLevel: "A1",
      },
    });

    const res = await request(makeApp()).get(
      "/api/cefr/programs/german-a1",
    );

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ENROLLMENT_REQUIRED");
    expect(res.body.program.slug).toBe("german-a1");
  });

  test("returns 409 for multiple active cohort memberships", async () => {
    mockGetCefrProgramOverview.mockResolvedValue({
      type: "COHORT_CONFLICT",
      enrollmentId: "enrollment-1",
    });

    const res = await request(makeApp()).get(
      "/api/cefr/programs/german-a1",
    );

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("COHORT_CONFLICT");
  });

  test("returns 409 for cohort/version mismatch", async () => {
    mockGetCefrProgramOverview.mockResolvedValue({
      type: "COHORT_VERSION_MISMATCH",
      enrollmentId: "enrollment-1",
    });

    const res = await request(makeApp()).get(
      "/api/cefr/programs/german-a1",
    );

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("COHORT_VERSION_MISMATCH");
  });

  test("returns program overview for an enrolled learner", async () => {
    mockGetCefrProgramOverview.mockResolvedValue({
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
        key: "german-a1-sep-2026",
        name: "German A1 September 2026",
        timezone: "Asia/Kolkata",
      },
      days: [
        {
          id: "day-1",
          dayNumber: 1,
          title: "Greetings",
          entitled: true,
          unlocked: true,
          accessState: "UNLOCKED",
        },
      ],
    });

    const res = await request(makeApp()).get(
      "/api/cefr/programs/german-a1",
    );

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.program.slug).toBe("german-a1");
    expect(res.body.days).toHaveLength(1);
    expect(res.body.days[0].accessState).toBe("UNLOCKED");

    expect(mockGetCefrProgramOverview).toHaveBeenCalledWith({
      userId: 42,
      programSlug: "german-a1",
    });
  });
});

describe("GET /api/cefr/programs/:programSlug/days/:dayNumber", () => {
  test("returns 401 when learner is not authenticated", async () => {
    const res = await request(makeApp(null)).get(
      "/api/cefr/programs/german-a1/days/1",
    );

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      ok: false,
      message: "Unauthorized",
    });

    expect(mockGetCefrDayDetail).not.toHaveBeenCalled();
  });

  test("rejects an invalid day number", async () => {
    const res = await request(makeApp()).get(
      "/api/cefr/programs/german-a1/days/not-a-day",
    );

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.message).toBe("Invalid day number");

    expect(mockGetCefrDayDetail).not.toHaveBeenCalled();
  });

  test("returns 404 when the requested day does not exist", async () => {
    mockGetCefrDayDetail.mockResolvedValue({
      type: "DAY_NOT_FOUND",
    });

    const res = await request(makeApp()).get(
      "/api/cefr/programs/german-a1/days/4",
    );

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      ok: false,
      code: "DAY_NOT_FOUND",
      message: "Day not found",
    });
  });

  test("returns 403 without activity content when the day is locked", async () => {
    mockGetCefrDayDetail.mockResolvedValue({
      type: "DAY_LOCKED",
      day: {
        id: "day-1",
        dayNumber: 1,
        title: "Greetings",
        entitled: true,
        unlocked: false,
        accessState: "SCHEDULED",
        liveSession: {
          id: "session-1",
          appUnlockAt: "2026-09-10T16:00:00.000Z",
          status: "SCHEDULED",
        },
      },
    });

    const res = await request(makeApp()).get(
      "/api/cefr/programs/german-a1/days/1",
    );

    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
    expect(res.body.code).toBe("DAY_LOCKED");
    expect(res.body.day.accessState).toBe("SCHEDULED");
    expect(res.body.day.activities).toBeUndefined();
  });

  test("returns unlocked Day activity content", async () => {
    mockGetCefrDayDetail.mockResolvedValue({
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
        key: "german-a1-sep-2026",
        name: "German A1 September 2026",
        timezone: "Asia/Kolkata",
      },
      day: {
        id: "day-1",
        dayNumber: 1,
        title: "Greetings",
        summary: "Greetings and introductions",
        entitled: true,
        unlocked: true,
        accessState: "UNLOCKED",
        liveSession: {
          id: "session-1",
          status: "SCHEDULED",
        },
        activities: [
          {
            id: "activity-1",
            key: "reorder-1",
            activityType: "REORDER",
            evaluationMode: "AUTO",
            title: "Build the sentence",
            orderIndex: 1,
            items: [
              {
                id: "item-1",
                itemKey: "q1",
                orderIndex: 1,
                prompt: { text: "Build the German sentence" },
                payload: { tokens: ["Ich", "heiße", "Anna"] },
                hint: null,
              },
            ],
          },
        ],
      },
    });

    const res = await request(makeApp()).get(
      "/api/cefr/programs/german-a1/days/1",
    );

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.program.slug).toBe("german-a1");
    expect(res.body.day.accessState).toBe("UNLOCKED");
    expect(res.body.day.activities).toHaveLength(1);

    expect(mockGetCefrDayDetail).toHaveBeenCalledWith({
      userId: 42,
      programSlug: "german-a1",
      dayNumber: 1,
    });
  });
});

describe("POST /api/cefr/programs/:programSlug/days/:dayNumber/activities/:activityId/attempts", () => {
  const url =
    "/api/cefr/programs/german-a1/days/1/activities/activity-1/attempts";

  test("returns 401 when learner is not authenticated", async () => {
    const res = await request(makeApp(null)).post(url);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      ok: false,
      message: "Unauthorized",
    });

    expect(mockStartCefrActivityAttempt).not.toHaveBeenCalled();
  });

  test("rejects an invalid day number", async () => {
    const res = await request(makeApp()).post(
      "/api/cefr/programs/german-a1/days/not-a-day/activities/activity-1/attempts",
    );

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid day number");
    expect(mockStartCefrActivityAttempt).not.toHaveBeenCalled();
  });

  test("returns 404 when activity is not part of the unlocked day", async () => {
    mockStartCefrActivityAttempt.mockResolvedValue({
      type: "ACTIVITY_NOT_FOUND",
    });

    const res = await request(makeApp()).post(url);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      ok: false,
      code: "ACTIVITY_NOT_FOUND",
      message: "Activity not found",
    });
  });

  test("returns 403 when the day is locked", async () => {
    mockStartCefrActivityAttempt.mockResolvedValue({
      type: "DAY_LOCKED",
      day: {
        id: "day-1",
        dayNumber: 1,
        unlocked: false,
        accessState: "SCHEDULED",
      },
    });

    const res = await request(makeApp()).post(url);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("DAY_LOCKED");
  });

  test("returns 409 when multiple open Attempts already exist", async () => {
    mockStartCefrActivityAttempt.mockResolvedValue({
      type: "ATTEMPT_CONFLICT",
      enrollmentId: "enrollment-1",
      activityId: "activity-1",
    });

    const res = await request(makeApp()).post(url);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ATTEMPT_CONFLICT");
  });

  test("returns 201 when a new Attempt is created", async () => {
    mockStartCefrActivityAttempt.mockResolvedValue({
      type: "OK",
      resumed: false,
      activity: {
        id: "activity-1",
        key: "greetings-reorder",
        activityType: "REORDER",
        evaluationMode: "AUTO",
      },
      attempt: {
        id: "attempt-1",
        attemptNumber: 1,
        status: "IN_PROGRESS",
      },
    });

    const res = await request(makeApp()).post(url);

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.resumed).toBe(false);
    expect(res.body.attempt.id).toBe("attempt-1");

    expect(mockStartCefrActivityAttempt).toHaveBeenCalledWith({
      userId: 42,
      programSlug: "german-a1",
      dayNumber: 1,
      activityId: "activity-1",
    });
  });

  test("returns 200 when an existing open Attempt is resumed", async () => {
    mockStartCefrActivityAttempt.mockResolvedValue({
      type: "OK",
      resumed: true,
      activity: {
        id: "activity-1",
        key: "greetings-reorder",
        activityType: "REORDER",
        evaluationMode: "AUTO",
      },
      attempt: {
        id: "attempt-1",
        attemptNumber: 1,
        status: "IN_PROGRESS",
      },
    });

    const res = await request(makeApp()).post(url);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.resumed).toBe(true);
    expect(res.body.attempt.id).toBe("attempt-1");
  });
});

describe("POST CEFR activity item Response", () => {
  const url =
    "/api/cefr/programs/german-a1/days/1/activities/activity-1/attempts/attempt-1/items/item-1/responses";

  const body = {
    submittedAnswer: {
      tokens: ["Guten", "Morgen."],
    },
    hintUsed: false,
    answerRevealed: false,
    responseTimeMs: 900,
  };

  test("returns 401 when learner is not authenticated", async () => {
    const res = await request(makeApp(null))
      .post(url)
      .set("Idempotency-Key", "response-key-1")
      .send(body);

    expect(res.status).toBe(401);
    expect(mockSubmitCefrActivityResponse).not.toHaveBeenCalled();
  });

  test("requires an Idempotency-Key header", async () => {
    const res = await request(makeApp()).post(url).send(body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      ok: false,
      code: "INVALID_IDEMPOTENCY_KEY",
      message: "Valid Idempotency-Key header required",
    });

    expect(mockSubmitCefrActivityResponse).not.toHaveBeenCalled();
  });

  test("rejects an Idempotency-Key longer than 128 characters", async () => {
    const res = await request(makeApp())
      .post(url)
      .set("Idempotency-Key", "x".repeat(129))
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_IDEMPOTENCY_KEY");
    expect(mockSubmitCefrActivityResponse).not.toHaveBeenCalled();
  });

  test("returns 201 for a newly persisted Response", async () => {
    mockSubmitCefrActivityResponse.mockResolvedValue({
      type: "OK",
      idempotentReplay: false,
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
      },
      activity: {
        id: "activity-1",
        key: "greetings-reorder",
        activityType: "REORDER",
        evaluationMode: "AUTO",
      },
      attempt: {
        id: "attempt-1",
        attemptNumber: 1,
        status: "IN_PROGRESS",
        completedAt: null,
      },
      response: {
        id: "response-1",
        attemptId: "attempt-1",
        activityItemId: "item-1",
        responseNumber: 1,
        submittedAnswer: body.submittedAnswer,
        isCorrect: true,
        evaluationCode: "CORRECT",
        score: 1,
        hintUsed: false,
        answerRevealed: false,
        responseTimeMs: 900,
        submittedAt: "2026-09-07T03:30:00.000Z",
      },
      xp: {
        awarded: true,
        amount: 150,
        eventType: "ITEM_FIRST_CORRECT",
        ruleVersion: "cefr-xp-v1",
        idempotentReplay: false,
      },
    });

    const res = await request(makeApp())
      .post(url)
      .set("Idempotency-Key", "response-key-1")
      .send(body);

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.idempotentReplay).toBe(false);
    expect(res.body.response.id).toBe("response-1");
    expect(res.body.xp).toEqual({
      awarded: true,
      amount: 150,
      eventType: "ITEM_FIRST_CORRECT",
      ruleVersion: "cefr-xp-v1",
      idempotentReplay: false,
    });

    expect(mockSubmitCefrActivityResponse).toHaveBeenCalledWith({
      userId: 42,
      programSlug: "german-a1",
      dayNumber: 1,
      activityId: "activity-1",
      attemptId: "attempt-1",
      activityItemId: "item-1",
      submittedAnswer: body.submittedAnswer,
      hintUsed: false,
      answerRevealed: false,
      responseTimeMs: 900,
      idempotencyKey: "response-key-1",
    });
  });

  test("returns 200 for an idempotent replay", async () => {
    mockSubmitCefrActivityResponse.mockResolvedValue({
      type: "OK",
      idempotentReplay: true,
      response: {
        id: "response-1",
        responseNumber: 1,
      },
    });

    const res = await request(makeApp())
      .post(url)
      .set("Idempotency-Key", "response-key-1")
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.idempotentReplay).toBe(true);
    expect(res.body.response.id).toBe("response-1");
  });

  test("returns 403 when the day is locked", async () => {
    mockSubmitCefrActivityResponse.mockResolvedValue({
      type: "DAY_LOCKED",
      day: {
        id: "day-1",
        dayNumber: 1,
        accessState: "SCHEDULED",
      },
    });

    const res = await request(makeApp())
      .post(url)
      .set("Idempotency-Key", "response-key-1")
      .send(body);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("DAY_LOCKED");
  });

  test("returns 404 when the ActivityItem is not part of the Activity", async () => {
    mockSubmitCefrActivityResponse.mockResolvedValue({
      type: "ACTIVITY_ITEM_NOT_FOUND",
    });

    const res = await request(makeApp())
      .post(url)
      .set("Idempotency-Key", "response-key-1")
      .send(body);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("ACTIVITY_ITEM_NOT_FOUND");
  });

  test("returns 409 when the Attempt is not open", async () => {
    mockSubmitCefrActivityResponse.mockResolvedValue({
      type: "ATTEMPT_NOT_OPEN",
    });

    const res = await request(makeApp())
      .post(url)
      .set("Idempotency-Key", "response-key-1")
      .send(body);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ATTEMPT_NOT_OPEN");
  });

  test("returns 400 for an invalid learner submission", async () => {
    mockSubmitCefrActivityResponse.mockResolvedValue({
      type: "INVALID_SUBMISSION",
      evaluationCode: "INVALID_SUBMISSION",
    });

    const res = await request(makeApp())
      .post(url)
      .set("Idempotency-Key", "response-key-1")
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_SUBMISSION");
  });

  test("returns 409 when an idempotency key is reused with different evidence", async () => {
    mockSubmitCefrActivityResponse.mockResolvedValue({
      type: "IDEMPOTENCY_CONFLICT",
    });

    const res = await request(makeApp())
      .post(url)
      .set("Idempotency-Key", "response-key-1")
      .send(body);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  test("fails closed when evaluator configuration is invalid", async () => {
    mockSubmitCefrActivityResponse.mockResolvedValue({
      type: "EVALUATOR_CONFIG_ERROR",
      evaluationCode: "EVALUATOR_CONFIG_ERROR",
    });

    const res = await request(makeApp())
      .post(url)
      .set("Idempotency-Key", "response-key-1")
      .send(body);

    expect(res.status).toBe(500);
    expect(res.body.code).toBe("EVALUATOR_CONFIG_ERROR");
  });

  test("returns 500 when the Response is durable but XP finalization fails", async () => {
    mockSubmitCefrActivityResponse.mockResolvedValue({
      type: "XP_AWARD_FAILED",
      xpError: "XP_CONFIG_ERROR",
      response: {
        id: "response-durable",
        responseNumber: 1,
      },
    });

    const res = await request(makeApp())
      .post(url)
      .set("Idempotency-Key", "response-key-xp-failure")
      .send(body);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      ok: false,
      code: "XP_AWARD_FAILED",
      message: "Response saved but XP could not be finalized",
    });
  });

});
