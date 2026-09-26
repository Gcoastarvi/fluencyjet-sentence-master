import {
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import express from "express";
import request from "supertest";

const mockPrisma = {
  memoryAssessmentSession: {
    create: jest.fn(),
    updateMany: jest.fn(),
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
    "Lantern",
    "Falcon",
    "Anchor",
    "Helmet",
    "Violin",
    "Ladder",
    "Compass",
    "Marble",
    "Jacket",
    "River",
    "Camera",
    "Walnut",
  ],

  orderedAnswers: [
    "moon",
    "chair",
    "drum",
    "train",
    "orange",
    "ring",
    "horse",
    "shell",
  ],

  associationAnswers: {
    bridge: "63",
    planet: "28",
    feather: "74",
    orchid: "51",
    basket: "36",
    castle: "92",
  },

  academicAnswers: {
    location:
      "Beside a shallow freshwater lake in the northern hills",
    reed: "mavin",
    bird_species: "42",
    arrival_months: "November to January",
    reeds_planted: "600",
    water_depth_frequency: "twice each month",
  },

  delayedAnswers: [
    "Lantern",
    "Falcon",
    "Anchor",
    "Helmet",
    "Violin",
    "Ladder",
    "Compass",
    "Marble",
    "Jacket",
    "River",
    "Camera",
    "Walnut",
  ],
};

beforeEach(() => {
  jest.clearAllMocks();

  mockPrisma.memoryAssessmentSession.create.mockResolvedValue({
    publicToken: "school-advanced-public-token",
    ownerToken: "school-advanced-owner-token",
  });
});

describe("Class 9–12 Memory API", () => {
  test("scores school_advanced Form A without authentication", async () => {
    const res = await request(makeApp())
      .post("/api/memory/score")
      .send({
        trackId: "school_advanced",
        form: "A",
        responses: PERFECT_RESPONSES,
      });

    expect(res.status).toBe(200);

    expect(res.body).toMatchObject({
      ok: true,
      result: {
        trackId: "school_advanced",
        form: "A",
        totalScore: 100,
        maxScore: 100,
        retentionRatio: 1,
      },
    });

    expect(res.body.result.modules.immediate).toMatchObject({
      correct: 12,
      maxRaw: 12,
      weightedScore: 20,
      percentage: 100,
    });

    expect(res.body.result.modules.ordered).toMatchObject({
      correct: 8,
      maxRaw: 8,
      weightedScore: 15,
      percentage: 100,
    });

    expect(res.body.result.modules.association).toMatchObject({
      correct: 6,
      maxRaw: 6,
      weightedScore: 20,
      percentage: 100,
    });

    expect(res.body.result.modules.academic).toMatchObject({
      correct: 6,
      maxRaw: 6,
      weightedScore: 25,
      percentage: 100,
    });

    expect(res.body.result.modules.delayed).toMatchObject({
      correct: 12,
      maxRaw: 12,
      weightedScore: 20,
      percentage: 100,
    });
  });

  test("creates a sanitized Class 9–12 session and ignores fake browser scores", async () => {
    const res = await request(makeApp())
      .post("/api/memory/session")
      .send({
        trackId: "school_advanced",
        form: "A",

        // These browser-supplied values must never be trusted.
        score: -999,
        result: {
          totalScore: -999,
        },

        responses: {
          immediateAnswers: [
            ...PERFECT_RESPONSES.immediateAnswers,
            "EXTRA IMMEDIATE",
          ],

          orderedAnswers: [
            ...PERFECT_RESPONSES.orderedAnswers,
            "extra-ordered",
          ],

          associationAnswers: {
            ...PERFECT_RESPONSES.associationAnswers,
            secretExtraKey: "must not be stored",
          },

          academicAnswers: {
            ...PERFECT_RESPONSES.academicAnswers,
            unrelated: "must not be stored",
          },

          delayedAnswers: [
            ...PERFECT_RESPONSES.delayedAnswers,
            "EXTRA DELAYED",
          ],

          arbitraryPayload: {
            shouldNot: "be stored",
          },
        },

        attribution: {
          utm_source: "meta",
          utm_medium: "paid_social",
          utm_campaign: "memory_launch",
          source: "memory-challenge",
          campaign: "class-9-12",
          adset: "parents",
          ad: "creative-1",
        },
      });

    expect(res.status).toBe(201);

    expect(res.body).toMatchObject({
      ok: true,
      session: {
        publicToken: "school-advanced-public-token",
        ownerToken: "school-advanced-owner-token",
        result: {
          trackId: "school_advanced",
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
      trackId: "school_advanced",
      status: "FORM_A_COMPLETED",

      formAScore: 100,
      formARetentionRatio: 1,

      utmSource: "meta",
      utmMedium: "paid_social",
      utmCampaign: "memory_launch",
      source: "memory-challenge",
      campaign: "class-9-12",
      adset: "parents",
      ad: "creative-1",
    });

    const stored = call.data.formAAnswers;

    expect(stored.immediateAnswers).toHaveLength(12);
    expect(stored.orderedAnswers).toHaveLength(8);
    expect(stored.delayedAnswers).toHaveLength(12);

    expect(stored.associationAnswers).toEqual(
      PERFECT_RESPONSES.associationAnswers,
    );

    expect(stored.academicAnswers).toEqual(
      PERFECT_RESPONSES.academicAnswers,
    );

    expect(stored.associationAnswers.secretExtraKey).toBeUndefined();
    expect(stored.academicAnswers.unrelated).toBeUndefined();
    expect(stored.arbitraryPayload).toBeUndefined();

    expect(call.data.formAResult).toMatchObject({
      trackId: "school_advanced",
      totalScore: 100,
      maxScore: 100,
      retentionRatio: 1,
    });

    expect(call.data.score).toBeUndefined();
    expect(call.data.result).toBeUndefined();
  });

  test("keeps the future Advanced track unsupported", async () => {
    const res = await request(makeApp())
      .post("/api/memory/score")
      .send({
        trackId: "advanced",
        form: "A",
        responses: PERFECT_RESPONSES,
      });

    expect(res.status).toBe(400);

    expect(res.body).toEqual({
      ok: false,
      code: "UNSUPPORTED_MEMORY_ASSESSMENT",
      message:
        "This assessment track or form is not currently available.",
    });
  });

  test("keeps Form B unsupported for Class 9–12", async () => {
    const res = await request(makeApp())
      .post("/api/memory/score")
      .send({
        trackId: "school_advanced",
        form: "B",
        responses: PERFECT_RESPONSES,
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(
      "UNSUPPORTED_MEMORY_ASSESSMENT",
    );
  });
});
