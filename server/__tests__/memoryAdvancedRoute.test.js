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

const PERFECT_ADVANCED_RESPONSES = {
  immediateAnswers: [
    "telescope",
    "glacier",
    "kettle",
    "sparrow",
    "velvet",
    "tractor",
    "needle",
    "pyramid",
    "coconut",
    "magnet",
    "pillow",
    "desert",
    "mirror",
    "hammer",
  ],

  orderedAnswers: [
    "desk",
    "lemon",
    "bell",
    "ship",
    "coin",
    "zebra",
    "window",
    "brush",
    "pearl",
    "eagle",
  ],

  associationAnswers: {
    library: "84",
    volcano: "27",
    ribbon: "65",
    temple: "39",
    diamond: "72",
    coffee: "46",
    forest: "91",
  },

  academicAnswers: {
    homes_served: "180 homes",
    battery_capacity: "2.4 megawatt-hours",
    diesel_reduction: "38 percent",
    network_zones: "4 zones",
    sensor_frequency: "every 15 minutes",
    physical_inspection: "each Friday",
    future_plan: "a second microgrid for the eastern valley",
  },

  delayedAnswers: [
    "telescope",
    "glacier",
    "kettle",
    "sparrow",
    "velvet",
    "tractor",
    "needle",
    "pyramid",
    "coconut",
    "magnet",
    "pillow",
    "desert",
    "mirror",
    "hammer",
  ],
};

beforeEach(() => {
  jest.clearAllMocks();

  mockPrisma.memoryAssessmentSession.create.mockResolvedValue({
    publicToken: "advanced-public-token-test",
    ownerToken: "advanced-owner-token-test",
  });
});

describe("Advanced Form A memory routes", () => {
  test("scores Advanced Form A with the server-side answer key", async () => {
    const res = await request(makeApp())
      .post("/api/memory/score")
      .send({
        trackId: "advanced",
        form: "A",
        responses: PERFECT_ADVANCED_RESPONSES,
      });

    expect(res.status).toBe(200);

    expect(res.body).toMatchObject({
      ok: true,
      result: {
        trackId: "advanced",
        form: "A",
        totalScore: 100,
        maxScore: 100,
        retentionRatio: 1,
        modules: {
          immediate: {
            correct: 14,
            maxRaw: 14,
          },
          ordered: {
            correct: 10,
            maxRaw: 10,
          },
          association: {
            correct: 7,
            maxRaw: 7,
          },
          academic: {
            correct: 7,
            maxRaw: 7,
          },
          delayed: {
            correct: 14,
            maxRaw: 14,
          },
        },
      },
    });
  });

  test("session creation sanitizes Advanced responses and ignores browser score", async () => {
    const res = await request(makeApp())
      .post("/api/memory/session")
      .send({
        trackId: "advanced",
        form: "A",

        score: -999,
        result: {
          totalScore: -999,
        },

        responses: {
          immediateAnswers: [
            ...PERFECT_ADVANCED_RESPONSES.immediateAnswers,
            "injected-item",
          ],

          orderedAnswers: [
            ...PERFECT_ADVANCED_RESPONSES.orderedAnswers,
            "injected-order-item",
          ],

          associationAnswers: {
            ...PERFECT_ADVANCED_RESPONSES.associationAnswers,
            injected_pair: "999",
          },

          academicAnswers: {
            ...PERFECT_ADVANCED_RESPONSES.academicAnswers,
            injected_question: "should not persist",
          },

          delayedAnswers: [
            ...PERFECT_ADVANCED_RESPONSES.delayedAnswers,
            "injected-delayed-item",
          ],

          arbitraryPayload: {
            admin: true,
          },
        },
      });

    expect(res.status).toBe(201);

    expect(res.body).toMatchObject({
      ok: true,
      session: {
        publicToken: "advanced-public-token-test",
        ownerToken: "advanced-owner-token-test",
        result: {
          trackId: "advanced",
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

    expect(call.data.trackId).toBe("advanced");
    expect(call.data.status).toBe("FORM_A_COMPLETED");
    expect(call.data.formAScore).toBe(100);
    expect(call.data.formARetentionRatio).toBe(1);

    expect(
      call.data.formAAnswers.immediateAnswers,
    ).toHaveLength(14);

    expect(
      call.data.formAAnswers.orderedAnswers,
    ).toHaveLength(10);

    expect(
      Object.keys(call.data.formAAnswers.associationAnswers),
    ).toHaveLength(7);

    expect(
      Object.keys(call.data.formAAnswers.academicAnswers),
    ).toHaveLength(7);

    expect(
      call.data.formAAnswers.delayedAnswers,
    ).toHaveLength(14);

    expect(
      call.data.formAAnswers.associationAnswers.injected_pair,
    ).toBeUndefined();

    expect(
      call.data.formAAnswers.academicAnswers.injected_question,
    ).toBeUndefined();

    expect(
      call.data.formAAnswers.arbitraryPayload,
    ).toBeUndefined();

    expect(call.data.score).toBeUndefined();
    expect(call.data.result).toBeUndefined();
  });

  test("Advanced Form B remains unsupported", async () => {
    const res = await request(makeApp())
      .post("/api/memory/session")
      .send({
        trackId: "advanced",
        form: "B",
        responses: PERFECT_ADVANCED_RESPONSES,
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(
      "UNSUPPORTED_MEMORY_ASSESSMENT",
    );

    expect(
      mockPrisma.memoryAssessmentSession.create,
    ).not.toHaveBeenCalled();
  });
});
