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

const mockRedeem = jest.fn();
const mockValidate = jest.fn();

jest.unstable_mockModule("../db/client.js", () => ({
  default: {},
}));

jest.unstable_mockModule(
  "../services/memoryRetestRedeem.js",
  () => ({
    redeemMemoryRetestLink: mockRedeem,
  }),
);

jest.unstable_mockModule(
  "../services/memoryRetestSession.js",
  () => ({
    validateMemoryRetestSession: mockValidate,
  }),
);

const { default: router } =
  await import("../routes/memoryRetest.js");

const LINK = "a".repeat(64);
const SESSION = "b".repeat(64);
const COOKIE_NAME = "fj_memory_retest_session";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/memory-retest", router);
  return app;
}

function validRedeemResult() {
  return {
    redeemed: true,
    sessionToken: SESSION,
    trackId: "school_foundation",
    sessionExpiresAt: new Date(
      Date.now() + 60 * 60 * 1000,
    ),
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  mockRedeem.mockResolvedValue(validRedeemResult());

  mockValidate.mockResolvedValue({
    valid: true,
    assessmentSessionId: "assessment-1",
    trackId: "school_foundation",
  });
});

describe("POST /api/memory-retest/redeem", () => {
  test.each([
    "https://www.fluencyjet.com",
    "https://fluencyjet.com",
  ])("accepts trusted origin %s", async (origin) => {
    const response = await request(makeApp())
      .post("/api/memory-retest/redeem")
      .set("Origin", origin)
      .send({ linkToken: LINK });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.trackId).toBe(
      "school_foundation",
    );

    expect(response.body.sessionToken).toBeUndefined();
    expect(response.text).not.toContain(SESSION);
    expect(response.text).not.toContain(LINK);

    expect(mockRedeem).toHaveBeenCalledWith(
      { linkToken: LINK },
      expect.objectContaining({ prisma: expect.anything() }),
    );

    const cookie = response.headers["set-cookie"]?.[0];

    expect(cookie).toContain(
      `${COOKIE_NAME}=${SESSION}`,
    );
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain(
      "Path=/api/memory-retest",
    );

    expect(response.headers["cache-control"]).toBe(
      "no-store",
    );

    expect(response.headers["referrer-policy"]).toBe(
      "no-referrer",
    );
  });

  test("rejects requests without Origin", async () => {
    const response = await request(makeApp())
      .post("/api/memory-retest/redeem")
      .send({ linkToken: LINK });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe(
      "RETEST_ORIGIN_NOT_ALLOWED",
    );

    expect(mockRedeem).not.toHaveBeenCalled();
  });

  test("rejects untrusted browser origins", async () => {
    const response = await request(makeApp())
      .post("/api/memory-retest/redeem")
      .set("Origin", "https://untrusted.example")
      .send({ linkToken: LINK });

    expect(response.status).toBe(403);
    expect(mockRedeem).not.toHaveBeenCalled();
  });

  test("rejects malformed link tokens", async () => {
    const response = await request(makeApp())
      .post("/api/memory-retest/redeem")
      .set("Origin", "https://www.fluencyjet.com")
      .send({ linkToken: "invalid" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(
      "INVALID_RETEST_LINK",
    );

    expect(mockRedeem).not.toHaveBeenCalled();
  });

  test("rejects already used links", async () => {
    mockRedeem.mockResolvedValue({
      redeemed: false,
      reason: "INVALID_OR_USED_LINK",
    });

    const response = await request(makeApp())
      .post("/api/memory-retest/redeem")
      .set("Origin", "https://www.fluencyjet.com")
      .send({ linkToken: LINK });

    expect(response.status).toBe(401);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  test("rejects an already expired session", async () => {
    mockRedeem.mockResolvedValue({
      ...validRedeemResult(),
      sessionExpiresAt: new Date(Date.now() - 1000),
    });

    const response = await request(makeApp())
      .post("/api/memory-retest/redeem")
      .set("Origin", "https://www.fluencyjet.com")
      .send({ linkToken: LINK });

    expect(response.status).toBe(503);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  test("returns controlled error on service failure", async () => {
    mockRedeem.mockRejectedValue(
      new Error("Simulated database failure"),
    );

    const log = jest.spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const response = await request(makeApp())
        .post("/api/memory-retest/redeem")
        .set("Origin", "https://www.fluencyjet.com")
        .send({ linkToken: LINK });

      expect(response.status).toBe(500);
      expect(response.body.code).toBe(
        "RETEST_REDEMPTION_FAILED",
      );
      expect(response.headers["set-cookie"]).toBeUndefined();
    } finally {
      log.mockRestore();
    }
  });

  test("production redemption uses Secure cookie", async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const response = await request(makeApp())
        .post("/api/memory-retest/redeem")
        .set("Origin", "https://www.fluencyjet.com")
        .send({ linkToken: LINK });

      expect(response.status).toBe(200);

      const cookie = response.headers["set-cookie"]?.[0];

      expect(cookie).toContain("Secure");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});

describe("GET /api/memory-retest/session", () => {
  test("validates session using the cookie", async () => {
    const response = await request(makeApp())
      .get("/api/memory-retest/session")
      .set("Cookie", `${COOKIE_NAME}=${SESSION}`);

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      ok: true,
      trackId: "school_foundation",
    });

    expect(mockValidate).toHaveBeenCalledWith(
      { sessionToken: SESSION },
      expect.objectContaining({ prisma: expect.anything() }),
    );

    expect(response.text).not.toContain(SESSION);
    expect(response.text).not.toContain("assessment-1");
  });

  test("does not accept tokens from query parameters", async () => {
    mockValidate.mockResolvedValue({
      valid: false,
    });

    const response = await request(makeApp())
      .get(`/api/memory-retest/session?sessionToken=${SESSION}`);

    expect(response.status).toBe(401);

    expect(mockValidate).toHaveBeenCalledWith(
      { sessionToken: undefined },
      expect.anything(),
    );
  });

  test("rejects expired or revoked sessions", async () => {
    mockValidate.mockResolvedValue({
      valid: false,
      reason: "INVALID_OR_EXPIRED_SESSION",
    });

    const response = await request(makeApp())
      .get("/api/memory-retest/session")
      .set("Cookie", `${COOKIE_NAME}=${SESSION}`);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe(
      "INVALID_RETEST_SESSION",
    );
  });

  test("returns controlled error on validation failure", async () => {
    mockValidate.mockRejectedValue(
      new Error("Simulated database failure"),
    );

    const log = jest.spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const response = await request(makeApp())
        .get("/api/memory-retest/session")
        .set("Cookie", `${COOKIE_NAME}=${SESSION}`);

      expect(response.status).toBe(500);
      expect(response.body.code).toBe(
        "RETEST_SESSION_CHECK_FAILED",
      );
    } finally {
      log.mockRestore();
    }
  });

  test("disables caching of session responses", async () => {
    const response = await request(makeApp())
      .get("/api/memory-retest/session")
      .set("Cookie", `${COOKIE_NAME}=${SESSION}`);

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe(
      "no-store",
    );
    expect(response.headers["referrer-policy"]).toBe(
      "no-referrer",
    );
  });
});
