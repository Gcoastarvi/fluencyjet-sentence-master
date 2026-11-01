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

const mockSubmit = jest.fn();
const mockPrisma = {};

jest.unstable_mockModule("../db/client.js", () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule(
  "../services/memoryFormBSubmission.js",
  () => ({
    submitMemoryFormB: mockSubmit,
  }),
);

const { default: router } =
  await import("../routes/memoryRetest.js");

const COOKIE = "fj_memory_retest_session";
const SESSION = "b".repeat(64);

const RESPONSES = {
  immediateAnswers: ["camera"],
  orderedAnswers: ["chair"],
  associationAnswers: {},
  academicAnswers: {},
  delayedAnswers: [],
};

function makeApp() {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  app.use("/api/memory-retest", router);

  return app;
}

function submit(origin = "https://www.fluencyjet.com") {
  return request(makeApp())
    .post("/api/memory-retest/submit")
    .set("Origin", origin)
    .set("Cookie", `${COOKIE}=${SESSION}`);
}

beforeEach(() => {
  jest.clearAllMocks();

  mockSubmit.mockResolvedValue({
    saved: true,
    trackId: "school_foundation",
    formAScore: 72,
    formBScore: 85,
    improvementPoints: 13,
    formBCompletedAt:
      "2026-11-01T10:00:00.000Z",
  });
});

describe("POST /api/memory-retest/submit", () => {
  test.each([
    "https://www.fluencyjet.com",
    "https://fluencyjet.com",
  ])(
    "accepts authenticated submission from %s",
    async (origin) => {
      const response = await submit(origin)
        .send({
          responses: RESPONSES,
          trackId: "advanced",
          score: 100,
          result: {
            totalScore: 100,
          },
        });

      expect(response.status).toBe(201);

      expect(response.body).toEqual({
        ok: true,
        trackId: "school_foundation",
        formAScore: 72,
        formBScore: 85,
        improvementPoints: 13,
        formBCompletedAt:
          "2026-11-01T10:00:00.000Z",
      });

      // The cookie is the only session authority.
      // Forged score and track are not forwarded.
      expect(mockSubmit).toHaveBeenCalledWith(
        {
          sessionToken: SESSION,
          responses: RESPONSES,
        },
        {
          prisma: mockPrisma,
        },
      );

      expect(response.text).not.toContain(
        SESSION,
      );

      expect(
        response.headers["cache-control"],
      ).toBe("no-store");

      expect(
        response.headers["referrer-policy"],
      ).toBe("no-referrer");
    },
  );

  test("rejects a missing Origin", async () => {
    const response = await request(makeApp())
      .post("/api/memory-retest/submit")
      .set("Cookie", `${COOKIE}=${SESSION}`)
      .send({
        responses: RESPONSES,
      });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe(
      "RETEST_ORIGIN_NOT_ALLOWED",
    );

    expect(mockSubmit).not.toHaveBeenCalled();
  });

  test("rejects an untrusted Origin", async () => {
    const response = await submit(
      "https://untrusted.example",
    ).send({
      responses: RESPONSES,
    });

    expect(response.status).toBe(403);
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  test("does not trust tokens in JSON or URL", async () => {
    mockSubmit.mockResolvedValueOnce({
      saved: false,
      code: "INVALID_RETEST_SESSION",
    });

    const response = await request(makeApp())
      .post(
        `/api/memory-retest/submit?sessionToken=${SESSION}`,
      )
      .set(
        "Origin",
        "https://www.fluencyjet.com",
      )
      .send({
        sessionToken: SESSION,
        trackId: "advanced",
        responses: RESPONSES,
      });

    expect(response.status).toBe(401);

    expect(mockSubmit).toHaveBeenCalledWith(
      {
        sessionToken: undefined,
        responses: RESPONSES,
      },
      {
        prisma: mockPrisma,
      },
    );
  });

  test("maps invalid responses to HTTP 400", async () => {
    mockSubmit.mockResolvedValueOnce({
      saved: false,
      code: "INVALID_FORM_B_RESPONSES",
    });

    const response = await submit().send({
      responses: null,
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(
      "INVALID_FORM_B_RESPONSES",
    );
  });

  test("rejects a duplicate submission", async () => {
    mockSubmit.mockResolvedValueOnce({
      saved: false,
      code: "FORM_B_ALREADY_COMPLETED",
    });

    const response = await submit().send({
      responses: RESPONSES,
    });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe(
      "FORM_B_ALREADY_COMPLETED",
    );
  });

  test("rejects an unavailable baseline", async () => {
    mockSubmit.mockResolvedValueOnce({
      saved: false,
      code: "BASELINE_UNAVAILABLE",
    });

    const response = await submit().send({
      responses: RESPONSES,
    });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe(
      "BASELINE_UNAVAILABLE",
    );
  });

  test("handles a serialization conflict", async () => {
    mockSubmit.mockResolvedValueOnce({
      saved: false,
      code: "SUBMISSION_CONFLICT_RETRY",
    });

    const response = await submit().send({
      responses: RESPONSES,
    });

    expect(response.status).toBe(503);
    expect(response.body.code).toBe(
      "SUBMISSION_CONFLICT_RETRY",
    );
  });

  test("handles an unexpected service error", async () => {
    mockSubmit.mockRejectedValueOnce(
      new Error("Simulated database failure"),
    );

    const log = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const response = await submit().send({
        responses: RESPONSES,
      });

      expect(response.status).toBe(500);
      expect(response.body.code).toBe(
        "FORM_B_SUBMISSION_FAILED",
      );

      expect(response.text).not.toContain(
        "Simulated database failure",
      );
    } finally {
      log.mockRestore();
    }
  });

  test("does not expose unknown service errors", async () => {
    mockSubmit.mockResolvedValueOnce({
      saved: false,
      code: "UNEXPECTED_INTERNAL_STATE",
    });

    const response = await submit().send({
      responses: RESPONSES,
    });

    expect(response.status).toBe(500);
    expect(response.body.ok).toBe(false);
  });
});
