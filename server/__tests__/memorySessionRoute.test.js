import {
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import request from "supertest";
import express from "express";

const mockPrisma = {
  memoryAssessmentSession: {
    create: jest.fn(),
  },
};

jest.unstable_mockModule("../db/client.js", () => ({
  default: mockPrisma,
}));

const { default: memoryRouter } = await import("../routes/memory.js");

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/memory", memoryRouter);
  return app;
}

const PERFECT_RESPONSES = {
  immediateAnswers: [
    "Bicycle",
    "Candle",
    "Tiger",
    "Spoon",
    "Kite",
    "Key",
    "Mountain",
    "Bottle",
    "Crown",
    "Clock",
  ],

  orderedAnswers: [
    "book",
    "fish",
    "star",
    "bus",
    "leaf",
    "cup",
  ],

  associationAnswers: {
    rocket: "24",
    umbrella: "57",
    guitar: "31",
    apple: "68",
    boat: "42",
  },

  academicAnswers: {
    habitat: "Near cool mountain lakes",
    grass: "velin",
    eggs: "3",
    leave_month: "October",
    parent_duration: "4 months",
  },

  delayedAnswers: [
    "Bicycle",
    "Candle",
    "Tiger",
    "Spoon",
    "Kite",
    "Key",
    "Mountain",
    "Bottle",
    "Crown",
    "Clock",
  ],
};

beforeEach(() => {
  jest.clearAllMocks();

  mockPrisma.memoryAssessmentSession.create.mockResolvedValue({
    publicToken: "memory-public-token-test",
    ownerToken: "memory-owner-token-test",
  });
});

describe("POST /api/memory/session", () => {
  test("re-scores Form A on the server and creates an anonymous session", async () => {
    const res = await request(makeApp())
      .post("/api/memory/session")
      .send({
        trackId: "school_foundation",
        form: "A",

        // Deliberately fake browser-supplied values.
        // The endpoint must ignore these.
        score: -999,
        result: {
          totalScore: -999,
        },

        responses: PERFECT_RESPONSES,

        attribution: {
          utm_source: "meta",
          utm_medium: "paid_social",
          utm_campaign: "memory_launch",
          source: "memory-challenge",
          campaign: "class-6-8",
          adset: "parents",
          ad: "creative-1",
        },
      });

    expect(res.status).toBe(201);

    expect(res.body).toMatchObject({
      ok: true,
      session: {
        publicToken: "memory-public-token-test",
        ownerToken: "memory-owner-token-test",
        result: {
          trackId: "school_foundation",
          form: "A",
          totalScore: 100,
          maxScore: 100,
          retentionRatio: 1,
        },
      },
    });

    expect(
      mockPrisma.memoryAssessmentSession.create,
    ).toHaveBeenCalledTimes(1);

    const call =
      mockPrisma.memoryAssessmentSession.create.mock.calls[0][0];

    expect(call.select).toEqual({
      publicToken: true,
      ownerToken: true,
    });

    expect(call.data).toMatchObject({
      trackId: "school_foundation",
      status: "FORM_A_COMPLETED",

      formAScore: 100,
      formARetentionRatio: 1,

      utmSource: "meta",
      utmMedium: "paid_social",
      utmCampaign: "memory_launch",
      source: "memory-challenge",
      campaign: "class-6-8",
      adset: "parents",
      ad: "creative-1",
    });

    expect(call.data.formAAnswers).toEqual(PERFECT_RESPONSES);

    expect(call.data.formAResult).toMatchObject({
      totalScore: 100,
      maxScore: 100,
      retentionRatio: 1,
    });

    // Browser-supplied fake score/result must never be persisted.
    expect(call.data.score).toBeUndefined();
    expect(call.data.result).toBeUndefined();
  });

  test("sanitizes stored responses instead of persisting arbitrary payload fields", async () => {
    const res = await request(makeApp())
      .post("/api/memory/session")
      .send({
        trackId: "school_foundation",
        form: "A",
        responses: {
          immediateAnswers: [
            " Bicycle ",
            "Candle",
            "Tiger",
            "Spoon",
            "Kite",
            "Key",
            "Mountain",
            "Bottle",
            "Crown",
            "Clock",
            "EXTRA ITEM",
          ],

          orderedAnswers: [
            "book",
            "fish",
            "star",
            "bus",
            "leaf",
            "cup",
            "extra",
          ],

          associationAnswers: {
            rocket: "24",
            umbrella: "57",
            guitar: "31",
            apple: "68",
            boat: "42",
            secretExtraKey: "must not be stored",
          },

          academicAnswers: {
            habitat: "Near cool mountain lakes",
            grass: "velin",
            eggs: "3",
            leave_month: "October",
            parent_duration: "4 months",
            unrelated: "must not be stored",
          },

          delayedAnswers: ["Bicycle"],

          arbitraryPayload: {
            shouldNot: "be stored",
          },
        },
      });

    expect(res.status).toBe(201);

    const data =
      mockPrisma.memoryAssessmentSession.create.mock.calls[0][0].data;

    expect(data.formAAnswers.immediateAnswers).toHaveLength(10);
    expect(data.formAAnswers.immediateAnswers[0]).toBe("Bicycle");

    expect(data.formAAnswers.orderedAnswers).toHaveLength(6);

    expect(data.formAAnswers.associationAnswers).toEqual({
      rocket: "24",
      umbrella: "57",
      guitar: "31",
      apple: "68",
      boat: "42",
    });

    expect(data.formAAnswers.academicAnswers).toEqual({
      habitat: "Near cool mountain lakes",
      grass: "velin",
      eggs: "3",
      leave_month: "October",
      parent_duration: "4 months",
    });

    expect(data.formAAnswers.arbitraryPayload).toBeUndefined();
  });

  test("rejects unsupported assessments before Prisma is called", async () => {
    const res = await request(makeApp())
      .post("/api/memory/session")
      .send({
        trackId: "advanced",
        form: "A",
        responses: {},
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("UNSUPPORTED_MEMORY_ASSESSMENT");

    expect(
      mockPrisma.memoryAssessmentSession.create,
    ).not.toHaveBeenCalled();
  });

  test("rejects missing responses before Prisma is called", async () => {
    const res = await request(makeApp())
      .post("/api/memory/session")
      .send({
        trackId: "school_foundation",
        form: "A",
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_MEMORY_RESPONSES");

    expect(
      mockPrisma.memoryAssessmentSession.create,
    ).not.toHaveBeenCalled();
  });

  test("returns a controlled 500 when persistence fails", async () => {
    mockPrisma.memoryAssessmentSession.create.mockRejectedValueOnce(
      new Error("database unavailable"),
    );

    const res = await request(makeApp())
      .post("/api/memory/session")
      .send({
        trackId: "school_foundation",
        form: "A",
        responses: PERFECT_RESPONSES,
      });

    expect(res.status).toBe(500);

    expect(res.body).toEqual({
      ok: false,
      code: "MEMORY_SESSION_CREATE_FAILED",
      message: "Unable to save the assessment right now.",
    });
  });
});
