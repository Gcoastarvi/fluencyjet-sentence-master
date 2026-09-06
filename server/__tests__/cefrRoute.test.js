import { jest, describe, test, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import express from "express";

const mockGetCefrProgramOverview = jest.fn();
const mockGetCefrDayDetail = jest.fn();

jest.unstable_mockModule("../services/cefrAccessService.js", () => ({
  getCefrProgramOverview: mockGetCefrProgramOverview,
  getCefrDayDetail: mockGetCefrDayDetail,
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
