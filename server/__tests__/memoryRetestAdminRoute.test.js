import {
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

import express from "express";
import jwt from "jsonwebtoken";

// This HTTP test injects its own database dependency.
// Mock the shared Prisma module before importing the router.
jest.unstable_mockModule("../db/client.js", () => ({
  default: {},
}));

const { createMemoryRetestAdminRouter } =
  await import("../routes/memoryRetestAdmin.js");

const SECRET =
  "memory-retest-isolated-route-test-secret-2026-11";

const ADMIN = {
  id: 7,
  role: "admin",
  isAdmin: true,
};

const RESULT = {
  issued: true,
  purchaseId: "purchase-test",
  trackId: "school_foundation",
  grantId: "grant-test",
  linkToken: "a".repeat(64),
  linkExpiresAt: new Date(Date.now() + 86400000),
  revokedCount: 0,
};

async function request({
  claims = ADMIN,
  token = null,
  bearer = true,
  cookie = false,
  origin = "https://www.fluencyjet.com",
  secret = SECRET,
  body = {
    purchaseId: "purchase-test",
    schoolTrackId: "school_foundation",
  },
  issuerResult = RESULT,
} = {}) {
  const issuer = jest.fn(async () => issuerResult);

  const app = express();
  app.use(express.json());

  app.use(
    "/api/admin/memory-retest",
    createMemoryRetestAdminRouter({
      prismaClient: {},
      invitationIssuer: issuer,
      jwtSecretProvider: () => secret,
    }),
  );

  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1");
    instance.once("listening", () => resolve(instance));
    instance.once("error", reject);
  });

  try {
    const actualToken = token ??
      jwt.sign(claims, SECRET, {
        expiresIn: "1h",
        algorithm: "HS256",
      });

    const headers = {
      "Content-Type": "application/json",
    };

    if (origin !== null) {
      headers.Origin = origin;
    }

    if (bearer) {
      headers.Authorization = `Bearer ${actualToken}`;
    }

    if (cookie) {
      headers.Cookie = `fj_token=${actualToken}`;
    }

    const address = server.address();

    const response = await fetch(
      `http://127.0.0.1:${address.port}` +
        "/api/admin/memory-retest/invitations",
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      },
    );

    return {
      status: response.status,
      data: await response.json(),
      cacheControl: response.headers.get("cache-control"),
      referrerPolicy: response.headers.get("referrer-policy"),
      issuer,
    };
  } finally {
    await new Promise((resolve, reject) => {
      server.close(error => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

describe("Protected Form B administrator HTTP endpoint", () => {
  test("valid admin receives one secure invitation URL", async () => {
    const result = await request();

    expect(result.status).toBe(201);
    expect(result.data.ok).toBe(true);

    expect(result.data.invitationUrl).toBe(
      "https://www.fluencyjet.com/memory-retest#token=" +
        "a".repeat(64)
    );

    expect(result.data).not.toHaveProperty("linkToken");
    expect(result.data).not.toHaveProperty("sessionToken");

    expect(result.cacheControl).toContain("no-store");
    expect(result.referrerPolicy).toBe("no-referrer");

    expect(result.issuer).toHaveBeenCalledWith(
      {
        trustedAdminId: 7,
        trustedPurchaseId: "purchase-test",
        schoolTrackId: "school_foundation",
      },
      {
        prisma: {},
      },
    );
  });

  test("rejects missing Bearer token", async () => {
    const result = await request({ bearer: false });

    expect(result.status).toBe(401);
    expect(result.issuer).not.toHaveBeenCalled();
  });

  test("does not accept a cookie instead of Bearer", async () => {
    const result = await request({
      bearer: false,
      cookie: true,
    });

    expect(result.status).toBe(401);
    expect(result.issuer).not.toHaveBeenCalled();
  });

  test("rejects invalid JWT signatures", async () => {
    const result = await request({
      token: jwt.sign(ADMIN, "different-secret", {
        algorithm: "HS256",
      }),
    });

    expect(result.status).toBe(401);
    expect(result.issuer).not.toHaveBeenCalled();
  });

  test("rejects admin email without role and admin flag", async () => {
    const result = await request({
      claims: {
        id: 7,
        email: "admin@example.invalid",
      },
    });

    expect(result.status).toBe(403);
    expect(result.issuer).not.toHaveBeenCalled();
  });

  test("rejects non-admin JWT claims", async () => {
    const result = await request({
      claims: {
        id: 7,
        role: "user",
        isAdmin: false,
      },
    });

    expect(result.status).toBe(403);
    expect(result.issuer).not.toHaveBeenCalled();
  });

  test("rejects unsafe origins", async () => {
    const result = await request({
      origin: "https://untrusted.example.invalid",
    });

    expect(result.status).toBe(403);
    expect(result.issuer).not.toHaveBeenCalled();
  });

  test("requires an explicitly configured strong secret", async () => {
    const result = await request({
      secret: "",
    });

    expect(result.status).toBe(503);
    expect(result.issuer).not.toHaveBeenCalled();
  });

  test("rejects invalid purchase identifiers", async () => {
    const result = await request({
      body: {
        purchaseId: "../invalid",
        schoolTrackId: "school_foundation",
      },
    });

    expect(result.status).toBe(400);
    expect(result.issuer).not.toHaveBeenCalled();
  });

  test("rejects unsupported school tracks", async () => {
    const result = await request({
      body: {
        purchaseId: "purchase-test",
        schoolTrackId: "school_unspecified",
      },
    });

    expect(result.status).toBe(400);
    expect(result.issuer).not.toHaveBeenCalled();
  });

  test("returns a safe denial before the masterclass ends", async () => {
    const result = await request({
      issuerResult: {
        issued: false,
        reason: "MASTERCLASS_NOT_FINISHED",
      },
    });

    expect(result.status).toBe(409);
    expect(result.data.code).toBe(
      "MASTERCLASS_NOT_FINISHED"
    );
    expect(result.data).not.toHaveProperty("invitationUrl");
  });

  test("returns a safe denial after Form B completion", async () => {
    const result = await request({
      issuerResult: {
        issued: false,
        reason: "FORM_B_ALREADY_COMPLETED",
      },
    });

    expect(result.status).toBe(409);
    expect(result.data.code).toBe(
      "FORM_B_ALREADY_COMPLETED"
    );
    expect(result.data).not.toHaveProperty("invitationUrl");
  });
});
