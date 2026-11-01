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
  },
};

jest.unstable_mockModule("../db/client.js", () => ({
  default: mockPrisma,
}));

const { default: memoryRouter } =
  await import("../routes/memory.js");

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/memory", memoryRouter);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Form B public endpoint protection", () => {
  test.each([
    "school_foundation",
    "school_advanced",
    "advanced",
  ])(
    "public scoring rejects Form B for %s",
    async (trackId) => {
      const response = await request(makeApp())
        .post("/api/memory/score")
        .send({
          trackId,
          form: "B",
          responses: {
            immediateAnswers: ["camera"],
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(
        "UNSUPPORTED_MEMORY_ASSESSMENT",
      );
    },
  );

  test.each([
    "school_foundation",
    "school_advanced",
    "advanced",
  ])(
    "anonymous session creation rejects Form B for %s",
    async (trackId) => {
      const response = await request(makeApp())
        .post("/api/memory/session")
        .send({
          trackId,
          form: "B",
          responses: {
            immediateAnswers: ["camera"],
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(
        "UNSUPPORTED_MEMORY_ASSESSMENT",
      );

      expect(
        mockPrisma.memoryAssessmentSession.create,
      ).not.toHaveBeenCalled();
    },
  );
});
