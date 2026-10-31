import {
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

const validateSession = jest.fn();
const findAssessment = jest.fn();

const mockPrisma = {
  memoryAssessmentSession: {
    findUnique: findAssessment,
  },
};

jest.unstable_mockModule("../db/client.js", () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule(
  "../services/memoryRetestSession.js",
  () => ({
    validateMemoryRetestSession: validateSession,
  }),
);

jest.unstable_mockModule(
  "../services/memoryRetestRedeem.js",
  () => ({
    redeemMemoryRetestLink: jest.fn(),
  }),
);

jest.unstable_mockModule(
  "../services/memoryFormBSubmission.js",
  () => ({
    submitMemoryFormB: jest.fn(),
  }),
);

const { default: router } =
  await import("../routes/memoryRetest.js");

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use("/api/memory-retest", router);

const TOKEN = "a".repeat(64);
const COOKIE = `fj_memory_retest_session=${TOKEN}`;
const COMPLETED_AT = "2026-11-01T10:00:00.000Z";

function getResult() {
  return request(app)
    .get("/api/memory-retest/result")
    .set("Cookie", COOKIE);
}

beforeEach(() => {
  jest.clearAllMocks();

  validateSession.mockResolvedValue({
    valid: true,
    assessmentSessionId: "assessment-123",
    trackId: "school_foundation",
  });

  findAssessment.mockResolvedValue({
    trackId: "school_foundation",
    formAScore: "65.50",
    formBScore: "85.75",
    formBCompletedAt: new Date(COMPLETED_AT),
  });
});

describe("Authenticated Form B results endpoint", () => {
  test("returns verified Before/After scores", async () => {
    const response = await getResult();

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      ok: true,
      trackId: "school_foundation",
      formAScore: 65.5,
      formBScore: 85.75,
      improvementPoints: 20.25,
      formBCompletedAt: COMPLETED_AT,
    });

    expect(validateSession).toHaveBeenCalledWith(
      { sessionToken: TOKEN },
      { prisma: mockPrisma },
    );

    expect(findAssessment).toHaveBeenCalledWith({
      where: { id: "assessment-123" },
      select: {
        trackId: true,
        formAScore: true,
        formBScore: true,
        formBCompletedAt: true,
      },
    });

    expect(response.headers["cache-control"])
      .toBe("no-store");

    expect(response.headers["referrer-policy"])
      .toBe("no-referrer");

    expect(response.text).not.toContain(TOKEN);
    expect(response.text).not.toContain("assessment-123");
  });

  test("reports a negative score difference", async () => {
    findAssessment.mockResolvedValueOnce({
      trackId: "school_foundation",
      formAScore: 90,
      formBScore: 60,
      formBCompletedAt: new Date(COMPLETED_AT),
    });

    const response = await getResult();

    expect(response.status).toBe(200);
    expect(response.body.improvementPoints).toBe(-30);
  });

  test("accepts valid zero scores", async () => {
    findAssessment.mockResolvedValueOnce({
      trackId: "school_foundation",
      formAScore: 0,
      formBScore: 0,
      formBCompletedAt: new Date(COMPLETED_AT),
    });

    const response = await getResult();

    expect(response.status).toBe(200);
    expect(response.body.improvementPoints).toBe(0);
  });

  test("calculates differences from stored scores", async () => {
    findAssessment.mockResolvedValueOnce({
      trackId: "school_foundation",
      formAScore: "29.25",
      formBScore: "40.50",
      formBCompletedAt: new Date(COMPLETED_AT),
    });

    const response = await getResult();

    expect(response.status).toBe(200);
    expect(response.body.improvementPoints).toBe(11.25);
  });

  test("ignores forged query parameters", async () => {
    const response = await request(app)
      .get("/api/memory-retest/result")
      .query({
        assessmentSessionId: "another-student",
        trackId: "advanced",
        formAScore: 100,
        formBScore: 100,
      })
      .set("Cookie", COOKIE);

    expect(response.status).toBe(200);

    expect(findAssessment).toHaveBeenCalledWith({
      where: { id: "assessment-123" },
      select: expect.any(Object),
    });

    expect(response.body.trackId)
      .toBe("school_foundation");

    expect(response.body.formAScore).toBe(65.5);
  });

  test("rejects missing session", async () => {
    validateSession.mockResolvedValueOnce({
      valid: false,
    });

    const response = await request(app)
      .get("/api/memory-retest/result");

    expect(response.status).toBe(401);

    expect(validateSession).toHaveBeenCalledWith(
      { sessionToken: undefined },
      { prisma: mockPrisma },
    );

    expect(findAssessment).not.toHaveBeenCalled();
  });

  test("rejects expired or revoked session", async () => {
    validateSession.mockResolvedValueOnce({
      valid: false,
    });

    const response = await getResult();

    expect(response.status).toBe(401);
    expect(response.body.code)
      .toBe("INVALID_RETEST_SESSION");

    expect(findAssessment).not.toHaveBeenCalled();
  });

  test("rejects session without assessment ID", async () => {
    validateSession.mockResolvedValueOnce({
      valid: true,
      trackId: "school_foundation",
    });

    const response = await getResult();

    expect(response.status).toBe(401);
    expect(findAssessment).not.toHaveBeenCalled();
  });

  test("rejects session without track", async () => {
    validateSession.mockResolvedValueOnce({
      valid: true,
      assessmentSessionId: "assessment-123",
    });

    const response = await getResult();

    expect(response.status).toBe(401);
    expect(findAssessment).not.toHaveBeenCalled();
  });

  test("rejects missing assessment", async () => {
    findAssessment.mockResolvedValueOnce(null);

    const response = await getResult();

    expect(response.status).toBe(404);
  });

  test("rejects mismatched assessment track", async () => {
    findAssessment.mockResolvedValueOnce({
      trackId: "advanced",
      formAScore: 65,
      formBScore: 85,
      formBCompletedAt: new Date(COMPLETED_AT),
    });

    const response = await getResult();

    expect(response.status).toBe(404);
  });

  test("rejects incomplete Form B", async () => {
    findAssessment.mockResolvedValueOnce({
      trackId: "school_foundation",
      formAScore: 65,
      formBScore: null,
      formBCompletedAt: null,
    });

    const response = await getResult();

    expect(response.status).toBe(404);
    expect(response.body.code)
      .toBe("FORM_B_RESULT_NOT_READY");
  });

  test("rejects missing Form B score", async () => {
    findAssessment.mockResolvedValueOnce({
      trackId: "school_foundation",
      formAScore: 65,
      formBScore: null,
      formBCompletedAt: new Date(COMPLETED_AT),
    });

    const response = await getResult();

    expect(response.status).toBe(404);
  });

  test("rejects missing baseline score", async () => {
    findAssessment.mockResolvedValueOnce({
      trackId: "school_foundation",
      formAScore: null,
      formBScore: 85,
      formBCompletedAt: new Date(COMPLETED_AT),
    });

    const response = await getResult();

    expect(response.status).toBe(404);
  });

  test("rejects invalid baseline score", async () => {
    findAssessment.mockResolvedValueOnce({
      trackId: "school_foundation",
      formAScore: "invalid",
      formBScore: 85,
      formBCompletedAt: new Date(COMPLETED_AT),
    });

    const response = await getResult();

    expect(response.status).toBe(500);
  });

  test("rejects scores above 100", async () => {
    findAssessment.mockResolvedValueOnce({
      trackId: "school_foundation",
      formAScore: 65,
      formBScore: 120,
      formBCompletedAt: new Date(COMPLETED_AT),
    });

    const response = await getResult();

    expect(response.status).toBe(500);
  });

  test("rejects invalid completion date", async () => {
    findAssessment.mockResolvedValueOnce({
      trackId: "school_foundation",
      formAScore: 65,
      formBScore: 85,
      formBCompletedAt: "invalid-date",
    });

    const response = await getResult();

    expect(response.status).toBe(500);
  });

  test("handles database failures safely", async () => {
    findAssessment.mockRejectedValueOnce(
      new Error("Simulated DB failure"),
    );

    const log = jest.spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const response = await getResult();

      expect(response.status).toBe(500);
      expect(response.text).not.toContain(
        "Simulated DB failure",
      );
    } finally {
      log.mockRestore();
    }
  });

  test("handles validation failures safely", async () => {
    validateSession.mockRejectedValueOnce(
      new Error("Simulated validator failure"),
    );

    const log = jest.spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const response = await getResult();

      expect(response.status).toBe(500);
      expect(findAssessment).not.toHaveBeenCalled();
      expect(response.text).not.toContain(
        "Simulated validator failure",
      );
    } finally {
      log.mockRestore();
    }
  });
});
