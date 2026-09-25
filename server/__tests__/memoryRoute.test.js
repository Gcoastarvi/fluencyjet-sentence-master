import { describe, expect, test } from "@jest/globals";
import request from "supertest";
import express from "express";
import memoryRouter from "../routes/memory.js";

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

describe("POST /api/memory/score", () => {
  test("scores Class 6–8 Form A without authentication", async () => {
    const res = await request(makeApp())
      .post("/api/memory/score")
      .send({
        trackId: "school_foundation",
        form: "A",
        responses: PERFECT_RESPONSES,
      });

    expect(res.status).toBe(200);

    expect(res.body).toMatchObject({
      ok: true,
      result: {
        trackId: "school_foundation",
        form: "A",
        totalScore: 100,
        maxScore: 100,
        retentionRatio: 1,
      },
    });

    expect(res.body.result.modules.immediate).toMatchObject({
      correct: 10,
      maxRaw: 10,
      weightedScore: 20,
      percentage: 100,
    });

    expect(res.body.result.modules.ordered.weightedScore).toBe(15);
    expect(res.body.result.modules.association.weightedScore).toBe(20);
    expect(res.body.result.modules.academic.weightedScore).toBe(25);
    expect(res.body.result.modules.delayed.weightedScore).toBe(20);
  });

  test("rejects unsupported tracks", async () => {
    const res = await request(makeApp())
      .post("/api/memory/score")
      .send({
        trackId: "advanced",
        form: "A",
        responses: {},
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      ok: false,
      code: "UNSUPPORTED_MEMORY_ASSESSMENT",
      message: "This assessment track or form is not currently available.",
    });
  });

  test("rejects unsupported forms", async () => {
    const res = await request(makeApp())
      .post("/api/memory/score")
      .send({
        trackId: "school_foundation",
        form: "B",
        responses: {},
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("UNSUPPORTED_MEMORY_ASSESSMENT");
  });

  test("rejects a missing responses object", async () => {
    const res = await request(makeApp())
      .post("/api/memory/score")
      .send({
        trackId: "school_foundation",
        form: "A",
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      ok: false,
      code: "INVALID_MEMORY_RESPONSES",
      message: "Assessment responses are required.",
    });
  });

  test("returns raw and weighted module performance", async () => {
    const res = await request(makeApp())
      .post("/api/memory/score")
      .send({
        trackId: "school_foundation",
        form: "A",
        responses: {
          immediateAnswers: [
            "bicycle",
            "candle",
            "tiger",
            "spoon",
            "kite",
          ],
          orderedAnswers: [
            "book",
            "wrong",
            "star",
            "wrong",
            "leaf",
            "wrong",
          ],
          associationAnswers: {
            rocket: "24",
            umbrella: "57",
            guitar: "999",
            apple: "68",
            boat: "",
          },
          academicAnswers: {
            habitat: "They live near cool mountain lakes.",
            grass: "velin",
            eggs: "wrong",
            leave_month: "October",
            parent_duration: "",
          },
          delayedAnswers: [
            "bicycle",
            "candle",
            "tiger",
            "spoon",
          ],
        },
      });

    expect(res.status).toBe(200);

    expect(res.body.result).toMatchObject({
      totalScore: 52.5,
      retentionRatio: 0.8,
      modules: {
        immediate: {
          correct: 5,
          maxRaw: 10,
          percentage: 50,
          weightedScore: 10,
        },
        ordered: {
          correct: 3,
          maxRaw: 6,
          percentage: 50,
          weightedScore: 7.5,
        },
        association: {
          correct: 3,
          maxRaw: 5,
          percentage: 60,
          weightedScore: 12,
        },
        academic: {
          correct: 3,
          maxRaw: 5,
          percentage: 60,
          weightedScore: 15,
        },
        delayed: {
          correct: 4,
          maxRaw: 10,
          percentage: 40,
          weightedScore: 8,
        },
      },
    });
  });
});
