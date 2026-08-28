import crypto from "crypto";
import express from "express";
import request from "supertest";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

const mockPrisma = {
  $executeRaw: jest.fn(),
  $transaction: jest.fn(),
  sentenceMasterCheckoutIntent: {
    findMany: jest.fn(),
  },
  spokenEnglishPurchase: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  user: {
    update: jest.fn(),
  },
  automationEvent: {
    updateMany: jest.fn(),
  },
};
const mockSendCapiPurchase = jest.fn();

jest.unstable_mockModule("../db/client.js", () => ({
  default: mockPrisma,
}));
jest.unstable_mockModule("../lib/metaCapi.js", () => ({
  sendCapiPurchase: mockSendCapiPurchase,
}));

const { default: webhookRouter } =
  await import("../routes/webhookRazorpay.js");

const WEBHOOK_SECRET = "razorpay-attribution-test-secret";
const CAPTURED_AT_SECONDS = 1787911500;
const CAPTURED_AT = new Date(CAPTURED_AT_SECONDS * 1000);
const DESTINATION = "+919876543210";

function makeApp() {
  const app = express();
  app.use("/api/webhooks", webhookRouter);
  return app;
}

function makePayload(overrides = {}) {
  return {
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_sentence_master_1",
          amount: 119900,
          currency: "INR",
          status: "captured",
          email: "learner@example.test",
          contact: DESTINATION,
          created_at: CAPTURED_AT_SECONDS,
          ...overrides,
        },
      },
    },
  };
}

function postWebhook(app, payload, eventId = "event_sentence_master_1") {
  const rawBody = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(Buffer.from(rawBody))
    .digest("hex");

  return request(app)
    .post("/api/webhooks/razorpay")
    .set("Content-Type", "application/json")
    .set("X-Razorpay-Signature", signature)
    .set("X-Razorpay-Event-Id", eventId)
    .send(rawBody);
}

function makeIntent(overrides = {}) {
  return {
    id: "intent-1",
    userId: 42,
    productKey: "sentence_master",
    learnerEmail: "learner@example.test",
    destinationNumberNormalized: DESTINATION,
    createdAt: new Date(CAPTURED_AT.getTime() - 5 * 60_000),
    ...overrides,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  delete process.env.META_PIXEL_ID;
  delete process.env.META_CAPI_ACCESS_TOKEN;
  mockPrisma.$executeRaw.mockResolvedValue(1);
  mockPrisma.$transaction.mockImplementation(async (callback) =>
    callback(mockPrisma));
  mockPrisma.spokenEnglishPurchase.findFirst.mockResolvedValue(null);
  mockPrisma.sentenceMasterCheckoutIntent.findMany.mockResolvedValue([
    makeIntent(),
  ]);
  mockPrisma.user.update.mockResolvedValue({ id: 42, has_access: true });
  mockPrisma.automationEvent.updateMany.mockResolvedValue({ count: 2 });
  mockPrisma.spokenEnglishPurchase.create.mockImplementation(async ({ data }) => ({
    id: "purchase-1",
    ...data,
  }));
});

afterEach(() => {
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
  delete process.env.META_PIXEL_ID;
  delete process.env.META_CAPI_ACCESS_TOKEN;
});

describe("verified Razorpay Sentence Master capture attribution", () => {
  test("atomically attributes one exact intent, grants access, and cancels only pending Block B reminders", async () => {
    const response = await postWebhook(makeApp(), makePayload());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      capiSkipped: true,
    });
    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(mockPrisma.sentenceMasterCheckoutIntent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          productKey: "sentence_master",
          learnerEmail: "learner@example.test",
          destinationNumberNormalized: DESTINATION,
          createdAt: {
            lte: CAPTURED_AT,
            gte: expect.any(Date),
          },
        }),
      }),
    );
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: {
        has_access: true,
        plan: "PRO",
        tier_level: "pro",
      },
    });
    expect(mockPrisma.automationEvent.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 42,
        productKey: "sentence_master",
        eventType: {
          in: ["CHECKOUT_HELP_REMINDER", "ANY_QUESTIONS_REMINDER"],
        },
        status: "PENDING",
      },
      data: {
        status: "CANCELLED",
        cancelledAt: expect.any(Date),
        processedAt: expect.any(Date),
      },
    });
    expect(mockPrisma.spokenEnglishPurchase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentId: "pay_sentence_master_1",
        amount: 119900,
        userId: 42,
        productKey: "sentence_master",
        sourceIntentId: "intent-1",
      }),
    });
    expect(mockSendCapiPurchase).not.toHaveBeenCalled();
  });

  test("duplicate delivery exits without repeating purchase side effects", async () => {
    const app = makeApp();
    const payload = makePayload();
    const first = await postWebhook(app, payload);

    mockPrisma.spokenEnglishPurchase.findFirst.mockResolvedValue({
      id: "purchase-1",
    });
    const replay = await postWebhook(app, payload);

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual({ ok: true, duplicate: true });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.spokenEnglishPurchase.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.automationEvent.updateMany).toHaveBeenCalledTimes(1);
  });

  test("records ambiguous payment evidence without learner attribution or side effects", async () => {
    mockPrisma.sentenceMasterCheckoutIntent.findMany.mockResolvedValue([
      makeIntent(),
      makeIntent({ id: "intent-2" }),
    ]);

    const response = await postWebhook(
      makeApp(),
      makePayload({ id: "pay_ambiguous_1" }),
      "event_ambiguous_1",
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.spokenEnglishPurchase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentId: "pay_ambiguous_1",
        userId: null,
        productKey: "sentence_master",
        sourceIntentId: null,
      }),
    });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.automationEvent.updateMany).not.toHaveBeenCalled();
  });

  test.each([
    ["wrong learner email", { email: "other@example.test" }],
    ["anonymous payment", { email: null, contact: null }],
    ["incomplete payment time", { created_at: undefined }],
  ])("leaves %s unassociated", async (_name, overrides) => {
    if (overrides.email || overrides.contact || overrides.created_at) {
      mockPrisma.sentenceMasterCheckoutIntent.findMany.mockResolvedValue([]);
    }

    const response = await postWebhook(
      makeApp(),
      makePayload({ id: `pay_${_name.replaceAll(" ", "_")}`, ...overrides }),
      `event_${_name.replaceAll(" ", "_")}`,
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.spokenEnglishPurchase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: null,
        sourceIntentId: null,
      }),
    });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.automationEvent.updateMany).not.toHaveBeenCalled();
  });

  test("a different product amount cannot consume a Sentence Master intent", async () => {
    const response = await postWebhook(
      makeApp(),
      makePayload({
        id: "pay_vocabulary_1",
        amount: 79900,
      }),
      "event_vocabulary_1",
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.sentenceMasterCheckoutIntent.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.spokenEnglishPurchase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: null,
        productKey: null,
        sourceIntentId: null,
      }),
    });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  test("does not persist or attribute an authorized entity on a captured event", async () => {
    const response = await postWebhook(
      makeApp(),
      makePayload({
        id: "pay_authorized_only",
        status: "authorized",
      }),
      "event_authorized_only",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      skipped: true,
      reason: "status_not_captured",
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.spokenEnglishPurchase.create).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});