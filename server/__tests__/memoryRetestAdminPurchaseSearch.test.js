import {
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

import express from "express";
import jwt from "jsonwebtoken";

jest.unstable_mockModule("../db/client.js", () => ({
  default: {},
}));

const {
  createMemoryRetestAdminRouter,
} = await import("../routes/memoryRetestAdmin.js");

const SECRET =
  "isolated-memory-purchase-search-test-secret-2026";

const ADMIN = {
  id: 7,
  role: "admin",
  isAdmin: true,
};

function samplePurchase() {
  return {
    id: "purchase-123",
    checkoutSource: "standalone_vsl",
    trackId: "school_unspecified",
    purchaserName: "Sample Parent",
    purchaserEmail: "parent@example.invalid",
    purchaserPhone: "9000000000",
    customerEmail: null,
    customerContact: null,
    createdAt: new Date("2026-10-31T10:00:00Z"),
    checkoutIntent: {
      eventKey: "2026-11-15_1700_ist",
      eventStartsAt:
        new Date("2026-11-15T11:30:00Z"),
      eventEndsAt:
        new Date("2026-11-15T13:30:00Z"),
      trackId: "school_unspecified",
    },
    retestTrackAssignment: null,
  };
}

async function request({
  claims = ADMIN,
  bearer = true,
  token = null,
  dbAdmin = true,
  secret = SECRET,
  origin = "https://www.fluencyjet.com",
  search = "parent@example.invalid",
  purchases = [samplePurchase()],
} = {}) {
  const prisma = {
    user: {
      findUnique: jest.fn(async () => ({
        id: 7,
        isAdmin: dbAdmin,
      })),
    },
    memoryMasterclassPurchase: {
      findMany: jest.fn(async () => purchases),
    },
  };

  const app = express();

  app.use(express.json());

  app.use(
    "/api/admin/memory-retest",
    createMemoryRetestAdminRouter({
      prismaClient: prisma,
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
        algorithm: "HS256",
        expiresIn: "1h",
      });

    const headers = {
      "Content-Type": "application/json",
    };

    if (bearer) {
      headers.Authorization = `Bearer ${actualToken}`;
    }

    if (origin !== null) {
      headers.Origin = origin;
    }

    const response = await fetch(
      `http://127.0.0.1:${server.address().port}` +
        "/api/admin/memory-retest/purchases/search",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ search }),
      },
    );

    return {
      status: response.status,
      body: await response.json(),
      cache: response.headers.get("cache-control"),
      prisma,
    };
  } finally {
    await new Promise((resolve, reject) => {
      server.close(error =>
        error ? reject(error) : resolve()
      );
    });
  }
}

describe("Secure memory purchase administrator lookup", () => {
  test("returns limited registration details for verified admin", async () => {
    const r = await request();

    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.purchases).toHaveLength(1);

    expect(r.body.purchases[0]).toMatchObject({
      purchaseId: "purchase-123",
      purchaserName: "Sample Parent",
      originalTrackId: "school_unspecified",
      eventKey: "2026-11-15_1700_ist",
    });

    expect(r.body.purchases[0])
      .not.toHaveProperty("paymentId");

    expect(r.body.purchases[0])
      .not.toHaveProperty("razorpayOrderId");

    expect(r.body.purchases[0])
      .not.toHaveProperty("linkToken");

    expect(r.cache).toContain("no-store");

    expect(
      r.prisma.memoryMasterclassPurchase.findMany
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "captured",
          productKey: "memory_masterclass_99",
          amount: 9900,
          currency: "INR",
        }),
        take: 10,
      }),
    );
  });

  test("rejects missing Bearer token", async () => {
    const r = await request({ bearer: false });

    expect(r.status).toBe(401);
    expect(
      r.prisma.memoryMasterclassPurchase.findMany
    ).not.toHaveBeenCalled();
  });

  test("rejects forged JWT signature", async () => {
    const badToken = jwt.sign(
      ADMIN,
      "different-secret",
      { algorithm: "HS256" }
    );

    const r = await request({ token: badToken });

    expect(r.status).toBe(401);
  });

  test("rejects non-admin JWT claims", async () => {
    const r = await request({
      claims: {
        id: 7,
        role: "user",
        isAdmin: false,
      },
    });

    expect(r.status).toBe(403);
    expect(
      r.prisma.user.findUnique
    ).not.toHaveBeenCalled();
  });

  test("rejects admin JWT when database says non-admin", async () => {
    const r = await request({ dbAdmin: false });

    expect(r.status).toBe(403);
    expect(
      r.prisma.memoryMasterclassPurchase.findMany
    ).not.toHaveBeenCalled();
  });

  test("rejects untrusted browser origin", async () => {
    const r = await request({
      origin: "https://untrusted.example.invalid",
    });

    expect(r.status).toBe(403);
  });

  test("rejects weak or absent JWT configuration", async () => {
    const r = await request({ secret: "" });

    expect(r.status).toBe(503);
  });

  test.each(["", "a", "ab"])(
    "rejects search shorter than three characters: %s",
    async search => {
      const r = await request({ search });

      expect(r.status).toBe(400);
      expect(
        r.prisma.memoryMasterclassPurchase.findMany
      ).not.toHaveBeenCalled();
    },
  );

  test("rejects excessive search length", async () => {
    const r = await request({
      search: "x".repeat(101),
    });

    expect(r.status).toBe(400);
  });

  test("returns empty results safely", async () => {
    const r = await request({ purchases: [] });

    expect(r.status).toBe(200);
    expect(r.body.purchases).toEqual([]);
  });

  test("passes exact search through a bounded Prisma query", async () => {
    const r = await request({
      search: "Sample Parent",
    });

    expect(r.status).toBe(200);

    const query =
      r.prisma.memoryMasterclassPurchase.findMany
        .mock.calls[0][0];

    expect(query.where.OR).toContainEqual({
      purchaserName: {
        contains: "Sample Parent",
        mode: "insensitive",
      },
    });

    expect(query.take).toBe(10);
  });
});
