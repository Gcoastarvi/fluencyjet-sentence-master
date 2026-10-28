import crypto from "crypto";
import express from "express";
import request from "supertest";
import { sendCapiPurchase as actualSendCapiPurchase } from "../lib/metaCapi.js";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

const mockPrisma = {
  memoryMetaConsent: { findUnique: jest.fn() },
  $executeRaw: jest.fn(),
  $transaction: jest.fn(),
  sentenceMasterCheckoutIntent: {
    findMany: jest.fn(),
  },
  vocabularyCheckoutIntent: {
    findUnique: jest.fn(),
  },
  memoryMasterclassCheckoutIntent: {
    findUnique: jest.fn(),
  },
  memoryMasterclassPurchase: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
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

function makeMemoryIntent(overrides = {}) {
  return {
    metaConsentGranted: true, metaConsentId: "offline-consent", metaConsentRevision: 1,
    metaConsentVersion: "memory_meta_v1",
    id: "memory-intent-1",
    memoryAssessmentSessionId: "memory-session-1",
    razorpayOrderId: "order_memory_123",
    amount: 9900,
    currency: "INR",
    productKey: "memory_masterclass_99",
    eventKey: "2026-10-18_1700_ist",
    trackId: "school_foundation",
    purchaserName: "Purchaser Contact",
    purchaserEmail: "buyer@example.test",
    purchaserPhone: "+919123456789",

    visitorId: "memory-visitor-1",
    fbclid: "memory-fbclid-1",
    fbc: "fb.1.123456789.memory-fbclid-1",
    fbp: "fb.1.123456789.987654321",
    landingPage:
      "https://www.fluencyjet.com/memory-challenge/result",
    clientIp: "49.12.34.56",
    clientUserAgent: "FluencyJet-Memory-Test/1.0",

    ...overrides,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  mockPrisma.memoryMetaConsent.findUnique.mockResolvedValue({
    granted: true, adultConfirmed: true, revision: 1, version: "memory_meta_v1",
    expiresAt: new Date("2099-01-01"),
  });
  mockPrisma.memoryMasterclassPurchase.updateMany = jest.fn().mockResolvedValue({ count: 1 });
  mockPrisma.memoryMasterclassPurchase.findUnique = jest.fn().mockImplementation(async () => ({
    ...mockPrisma.memoryMasterclassPurchase.create.mock.calls.at(-1)[0].data,
    metaAttempts: 1, checkoutIntent: await mockPrisma.memoryMasterclassCheckoutIntent.findUnique.mock.results.at(-1).value,
  }));
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  delete process.env.META_PIXEL_ID;
  delete process.env.META_CAPI_ACCESS_TOKEN;
  delete process.env.MEMORY_META_CAPI_ACCESS_TOKEN;
  delete process.env.MEMORY_META_PIXEL_ID;
  delete process.env.MEMORY_META_TEST_EVENT_CODE;
  mockPrisma.$executeRaw.mockResolvedValue(1);
  mockPrisma.$transaction.mockImplementation(async (callback) =>
    callback(mockPrisma));
  mockPrisma.spokenEnglishPurchase.findFirst.mockResolvedValue(null);
  mockPrisma.sentenceMasterCheckoutIntent.findMany.mockResolvedValue([
    makeIntent(),
  ]);
  mockPrisma.vocabularyCheckoutIntent.findUnique.mockResolvedValue(null);

  mockPrisma.memoryMasterclassCheckoutIntent.findUnique.mockResolvedValue(
    null,
  );

  mockPrisma.memoryMasterclassPurchase.findFirst.mockResolvedValue(
    null,
  );

  mockPrisma.memoryMasterclassPurchase.create.mockImplementation(
    async ({ data }) => ({
      id: "memory-purchase-1",
      ...data,
    }),
  );

  mockPrisma.memoryMasterclassPurchase.update.mockImplementation(
    async ({ data }) => ({
      id: "memory-purchase-1",
      ...data,
    }),
  );

  mockSendCapiPurchase.mockResolvedValue({
    status: 200,
    ok: true,
    body: '{"events_received":1}',
  });
  mockPrisma.user.update.mockResolvedValue({ id: 42, has_access: true });
  mockPrisma.automationEvent.updateMany.mockResolvedValue({ count: 2 });
  mockPrisma.spokenEnglishPurchase.create.mockImplementation(async ({ data }) => ({
    id: "purchase-1",
    ...data,
  }));
});

test.each([false, undefined])("verified Memory capture records payment with no advertising consent (%s)", async choice => {
  process.env.MEMORY_META_CAPI_ACCESS_TOKEN = "memory-test-only";
  mockPrisma.memoryMasterclassCheckoutIntent.findUnique.mockResolvedValue(makeMemoryIntent({ metaConsentGranted: choice }));
  const response = await postWebhook(makeApp(), makePayload({
    id: "pay_memory_consent", order_id: "order_memory_123", amount: 9900,
  }), "consent-denied-fixture");
  expect(response.status).toBe(200);
  expect(mockPrisma.memoryMasterclassPurchase.create).toHaveBeenCalled();
  expect(mockSendCapiPurchase).not.toHaveBeenCalled();
});

afterEach(() => {
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
  delete process.env.META_PIXEL_ID;
  delete process.env.META_CAPI_ACCESS_TOKEN;
  delete process.env.MEMORY_META_CAPI_ACCESS_TOKEN;
  delete process.env.MEMORY_META_PIXEL_ID;
  delete process.env.MEMORY_META_TEST_EVENT_CODE;
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

  test("enriches Vocabulary CAPI Purchase from exact Razorpay order attribution", async () => {
    process.env.META_PIXEL_ID = "pixel_test_123";
    process.env.META_CAPI_ACCESS_TOKEN = "token_test_123";

    mockPrisma.vocabularyCheckoutIntent.findUnique.mockResolvedValue({
      id: "vocab-intent-1",
      visitorId: "visitor_abc123",

      fbclid: "fbclid_test_123",
      fbc: "fb.1.123456789.fbclid_test_123",
      fbp: "fb.1.123456789.987654321",

      utmSource: "facebook",
      utmMedium: "paid_social",
      utmCampaign: "vocab_creative_test",
      utmContent: "ai_video_1",
      utmTerm: "english_vocabulary",
      source: "vocabulary-course",

      landingPage:
        "https://www.fluencyjet.com/vocabulary-course?utm_content=ai_video_1",

      clientIp: "49.12.34.56",
      clientUserAgent: "FluencyJet-Test-Browser/1.0",
    });

    const response = await postWebhook(
      makeApp(),
      makePayload({
        id: "pay_vocabulary_order_1",
        amount: 79900,
        order_id: "order_vocab_123",
      }),
      "event_vocabulary_order_1",
    );

    expect(response.status).toBe(200);

    expect(
      mockPrisma.vocabularyCheckoutIntent.findUnique,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          razorpayOrderId: "order_vocab_123",
        },
      }),
    );

    expect(
      mockPrisma.spokenEnglishPurchase.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentId: "pay_vocabulary_order_1",
        razorpayOrderId: "order_vocab_123",
        vocabularyCheckoutIntentId: "vocab-intent-1",
        amount: 79900,
        currency: "INR",
      }),
    });

    expect(mockSendCapiPurchase).toHaveBeenCalledTimes(1);

    expect(mockSendCapiPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        pixelId: "pixel_test_123",
        accessToken: "token_test_123",

        eventId:
          "vocabulary_challenge_799_purchase_pay_vocabulary_order_1",

        value: 799,
        currency: "INR",

        email: "learner@example.test",
        phone: DESTINATION,

        externalId: "visitor_abc123",
        fbc: "fb.1.123456789.fbclid_test_123",
        fbp: "fb.1.123456789.987654321",

        clientIpAddress: "49.12.34.56",
        clientUserAgent: "FluencyJet-Test-Browser/1.0",
      }),
    );
  });

});

describe("verified Razorpay Memory Masterclass capture", () => {
  test("signed Memory webhook reaches the real v26 HTTP helper once, including capture replay", async () => {
    process.env.MEMORY_META_CAPI_ACCESS_TOKEN = "memory-test-only";
    process.env.MEMORY_META_TEST_EVENT_CODE = "MEMORY_TEST";
    process.env.META_PIXEL_ID = "1246171816816642";
    process.env.META_CAPI_ACCESS_TOKEN = "english-test-only";
    mockPrisma.memoryMasterclassCheckoutIntent.findUnique.mockResolvedValue(makeMemoryIntent());
    mockSendCapiPurchase.mockImplementation(actualSendCapiPurchase);
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 200, ok: true, text: async () => '{"events_received":1}',
    });
    try {
      const payload = makePayload({ id: "pay_memory_v26", order_id: "order_memory_123", amount: 9900 });
      const response = await postWebhook(makeApp(), payload, "event_memory_v26");
      expect(response.body).toMatchObject({ ok: true, capiDelivered: true });
      expect(mockPrisma.memoryMasterclassPurchase.create).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe("https://graph.facebook.com/v26.0/1998316064175555/events");
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.test_event_code).toBe("MEMORY_TEST");
      expect(body.data[0]).toMatchObject({
        event_name: "Purchase", event_id: "memory_masterclass_99_purchase_pay_memory_v26",
        custom_data: { value: 99, currency: "INR", content_ids: ["memory_masterclass_99"] },
      });
      mockPrisma.memoryMasterclassPurchase.findFirst.mockResolvedValue({ id: "purchase_fixture" });
      const replay = await postWebhook(makeApp(), payload, "event_memory_v26");
      expect(replay.body).toMatchObject({ duplicate: true });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(mockPrisma.memoryMasterclassPurchase.create).toHaveBeenCalledTimes(1);
    } finally { fetchMock.mockRestore(); }
  });

  test("Memory auth rejection still records verified payment and cannot retry through FJ", async () => {
    process.env.MEMORY_META_CAPI_ACCESS_TOKEN = "memory-test-only";
    mockPrisma.memoryMasterclassCheckoutIntent.findUnique.mockResolvedValue(makeMemoryIntent());
    mockSendCapiPurchase.mockImplementation(actualSendCapiPurchase);
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 400, ok: false, text: async () => '{"error":{"code":190}}',
    });
    try {
      const payload = makePayload({ id: "pay_memory_v26_rejected", order_id: "order_memory_123", amount: 9900 });
      const response = await postWebhook(makeApp(), payload, "event_memory_v26_rejected");
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ capiDelivered: false });
      expect(mockPrisma.memoryMasterclassPurchase.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.memoryMasterclassPurchase.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ metaDeliveryStatus: "SENDING", metaLeaseToken: expect.any(String) }),
        data: expect.objectContaining({ metaDeliveryStatus: "FAILED", metaLastErrorCode: "HTTP_400" }),
      });
      mockPrisma.memoryMasterclassPurchase.findFirst.mockResolvedValue({ id: "purchase_fixture" });
      expect((await postWebhook(makeApp(), payload, "event_memory_v26_rejected")).body.duplicate).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally { fetchMock.mockRestore(); }
  });

  test("configured English CAPI cannot receive a memory purchase when memory credentials are missing", async () => {
    process.env.META_PIXEL_ID = "1246171816816642";
    process.env.META_CAPI_ACCESS_TOKEN = "english-test-only";
    mockPrisma.memoryMasterclassCheckoutIntent.findUnique.mockResolvedValue(makeMemoryIntent());
    const response = await postWebhook(makeApp(), makePayload({
      id: "pay_memory_disabled", order_id: "order_memory_123", amount: 9900,
    }), "event_memory_disabled");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ capiSkipped: true, capiSkipReason: "memory_capi_token_missing" });
    expect(mockPrisma.memoryMasterclassPurchase.create).toHaveBeenCalledTimes(1);
    expect(mockSendCapiPurchase).not.toHaveBeenCalled();
  });

  test("an incorrect memory dataset disables CAPI without interrupting verified purchase persistence", async () => {
    process.env.MEMORY_META_PIXEL_ID = "1246171816816642";
    process.env.MEMORY_META_CAPI_ACCESS_TOKEN = "memory-test-only";
    mockPrisma.memoryMasterclassCheckoutIntent.findUnique.mockResolvedValue(makeMemoryIntent());
    const response = await postWebhook(makeApp(), makePayload({
      id: "pay_memory_wrong_pixel", order_id: "order_memory_123", amount: 9900,
    }), "event_memory_wrong_pixel");
    expect(response.body).toMatchObject({ capiSkipped: true, capiSkipReason: "memory_pixel_mismatch" });
    expect(mockPrisma.memoryMasterclassPurchase.create).toHaveBeenCalledTimes(1);
    expect(mockSendCapiPurchase).not.toHaveBeenCalled();
  });

  test.each(["school_foundation", "school_advanced", "advanced"])(
    "standalone %s capture persists source/track/identity without an assessment",
    async (trackId) => {
      process.env.META_PIXEL_ID = "test-pixel";
      process.env.META_CAPI_ACCESS_TOKEN = "test-token";
      process.env.MEMORY_META_CAPI_ACCESS_TOKEN = "memory-test-only";
      mockPrisma.memoryMasterclassCheckoutIntent.findUnique.mockResolvedValue(makeMemoryIntent({
        memoryAssessmentSessionId: null,
        checkoutSource: "standalone_vsl",
        trackId,
      }));
      const response = await postWebhook(makeApp(), makePayload({
        id: `pay_standalone_${trackId}`,
        order_id: "order_memory_123", amount: 9900,
        email: "provider@example.test", contact: "+919999999999",
        notes: { trackId: "fake", checkoutSource: "fake", purchaserName: "Fake" },
      }), `event_standalone_${trackId}`);
      expect(response.status).toBe(200);
      expect(mockPrisma.memoryMasterclassPurchase.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          checkoutSource: "standalone_vsl", trackId,
          purchaserName: "Purchaser Contact",
          purchaserEmail: "buyer@example.test",
          purchaserPhone: "+919123456789",
          customerEmail: "provider@example.test", customerContact: "+919999999999",
          amount: 9900, currency: "INR",
        }),
      });
      expect(mockSendCapiPurchase).toHaveBeenCalledWith(expect.objectContaining({
        pixelId: "1998316064175555", accessToken: "memory-test-only",
        testEventCode: null,
        value: 99, externalId: null, fbc: null, fbp: null, clientUserAgent: null,
      }));
    },
  );

  test("historical assessment intents default to assessment source", async () => {
    mockPrisma.memoryMasterclassCheckoutIntent.findUnique.mockResolvedValue(makeMemoryIntent());
    const response = await postWebhook(makeApp(), makePayload({
      id: "pay_historical", order_id: "order_memory_123", amount: 9900,
    }), "event_historical");
    expect(response.status).toBe(200);
    expect(mockPrisma.memoryMasterclassPurchase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ checkoutSource: "assessment", trackId: "school_foundation" }),
    });
  });
  test("copies only the intent snapshot, preserving distinct Razorpay audit and CAPI identity", async () => {
    process.env.META_PIXEL_ID = "test-pixel";
    process.env.META_CAPI_ACCESS_TOKEN = "test-token";
    process.env.MEMORY_META_CAPI_ACCESS_TOKEN = "memory-test-only";
    process.env.MEMORY_META_TEST_EVENT_CODE = "MEMORY_TEST";
    mockPrisma.memoryMasterclassCheckoutIntent.findUnique.mockResolvedValue(makeMemoryIntent());
    const response = await postWebhook(makeApp(), makePayload({
      id: "pay_memory_snapshot",
      order_id: "order_memory_123",
      amount: 9900,
      email: "provider@example.test",
      contact: "+919999999999",
      name: "Provider name",
      notes: {
        purchaserName: "Untrusted note name",
        purchaserEmail: "note@example.test",
        purchaserPhone: "+918888888888",
      },
    }), "event_memory_snapshot");
    expect(response.status).toBe(200);
    expect(mockPrisma.memoryMasterclassPurchase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        purchaserName: "Purchaser Contact",
        purchaserEmail: "buyer@example.test",
        purchaserPhone: "+919123456789",
        customerEmail: "provider@example.test",
        customerContact: "+919999999999",
      }),
    });
    expect(mockSendCapiPurchase).toHaveBeenCalledWith(expect.objectContaining({
      pixelId: "1998316064175555", accessToken: "memory-test-only",
      testEventCode: "MEMORY_TEST",
      email: "buyer@example.test",
      phone: "+919123456789",
      externalId: null,
      fbc: null,
      fbp: null,
      clientUserAgent: null,
    }));
  });

  test("captures historical null snapshots without inventing purchaser identity", async () => {
    mockPrisma.memoryMasterclassCheckoutIntent.findUnique.mockResolvedValue(makeMemoryIntent({
      purchaserName: null, purchaserEmail: null, purchaserPhone: null,
    }));
    const response = await postWebhook(makeApp(), makePayload({
      id: "pay_memory_historical", order_id: "order_memory_123", amount: 9900,
    }), "event_memory_historical");
    expect(response.status).toBe(200);
    expect(mockPrisma.memoryMasterclassPurchase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        purchaserName: null, purchaserEmail: null, purchaserPhone: null,
        customerEmail: "learner@example.test", customerContact: DESTINATION,
      }),
    });
  });

  test("keeps the purchaser snapshot even when provider email and phone are absent", async () => {
    mockPrisma.memoryMasterclassCheckoutIntent.findUnique.mockResolvedValue(makeMemoryIntent());
    const response = await postWebhook(makeApp(), makePayload({
      id: "pay_memory_no_provider_identity",
      order_id: "order_memory_123", amount: 9900, email: null, contact: null,
    }), "event_memory_no_provider_identity");
    expect(response.status).toBe(200);
    expect(mockPrisma.memoryMasterclassPurchase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        purchaserName: "Purchaser Contact",
        purchaserEmail: "buyer@example.test",
        purchaserPhone: "+919123456789",
        customerEmail: null, customerContact: null,
      }),
    });
  });

  test("rejects invalid signatures before looking up or persisting purchaser identity", async () => {
    const response = await request(makeApp()).post("/api/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("X-Razorpay-Signature", "invalid")
      .send(JSON.stringify(makePayload({
        id: "pay_memory_bad_signature", order_id: "order_memory_123", amount: 9900,
      })));
    expect(response.status).toBe(400);
    expect(mockPrisma.memoryMasterclassCheckoutIntent.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.memoryMasterclassPurchase.create).not.toHaveBeenCalled();
  });

  test("matches the exact Razorpay order and persists one dedicated Memory purchase", async () => {
    mockPrisma.memoryMasterclassCheckoutIntent.findUnique.mockResolvedValue(
      makeMemoryIntent(),
    );

    const response = await postWebhook(
      makeApp(),
      makePayload({
        id: "pay_memory_1",
        order_id: "order_memory_123",
        amount: 9900,
      }),
      "event_memory_1",
    );

    expect(response.status).toBe(200);

    expect(
      mockPrisma.memoryMasterclassCheckoutIntent.findUnique,
    ).toHaveBeenCalledWith({
      where: {
        razorpayOrderId: "order_memory_123",
      },
      select: expect.objectContaining({
        id: true,
        memoryAssessmentSessionId: true,
              checkoutSource: true,
        razorpayOrderId: true,
        amount: true,
        currency: true,
        productKey: true,
        trackId: true,
        purchaserName: true,
        purchaserEmail: true,
        purchaserPhone: true,
      }),
    });

    expect(
      mockPrisma.memoryMasterclassPurchase.create,
    ).toHaveBeenCalledTimes(1);

    expect(
      mockPrisma.memoryMasterclassPurchase.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        checkoutIntentId: "memory-intent-1",
        razorpayOrderId: "order_memory_123",
        paymentId: "pay_memory_1",

        amount: 9900,
        currency: "INR",
        productKey: "memory_masterclass_99",
        status: "captured",

        customerEmail: "learner@example.test",
        customerContact: DESTINATION,
        purchaserName: "Purchaser Contact",
        purchaserEmail: "buyer@example.test",
        purchaserPhone: "+919123456789",

        webhookEventId: "event_memory_1",
        metaEventId:
          "memory_masterclass_99_purchase_pay_memory_1",
        metaDelivered: false,
      }),
    });

    expect(
      mockPrisma.spokenEnglishPurchase.create,
    ).not.toHaveBeenCalled();

    expect(response.body).toMatchObject({
      ok: true,
      product: "memory_masterclass_99",
      paymentId: "pay_memory_1",
    });
  });

  test("duplicate Memory webhook exits without creating another purchase", async () => {
    mockPrisma.memoryMasterclassCheckoutIntent.findUnique.mockResolvedValue(
      makeMemoryIntent(),
    );

    mockPrisma.memoryMasterclassPurchase.findFirst.mockResolvedValue({
      id: "memory-purchase-existing",
    });

    const response = await postWebhook(
      makeApp(),
      makePayload({
        id: "pay_memory_duplicate",
        order_id: "order_memory_123",
        amount: 9900,
      }),
      "event_memory_duplicate",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      duplicate: true,
    });

    expect(
      mockPrisma.memoryMasterclassPurchase.create,
    ).not.toHaveBeenCalled();

    expect(
      mockPrisma.spokenEnglishPurchase.create,
    ).not.toHaveBeenCalled();
  });

  test("rejects a Memory order when captured amount differs from the stored checkout intent", async () => {
    mockPrisma.memoryMasterclassCheckoutIntent.findUnique.mockResolvedValue(
      makeMemoryIntent(),
    );

    const response = await postWebhook(
      makeApp(),
      makePayload({
        id: "pay_memory_wrong_amount",
        order_id: "order_memory_123",
        amount: 100,
      }),
      "event_memory_wrong_amount",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      skipped: true,
      reason: "memory_checkout_mismatch",
    });

    expect(
      mockPrisma.memoryMasterclassPurchase.create,
    ).not.toHaveBeenCalled();

    expect(
      mockPrisma.spokenEnglishPurchase.create,
    ).not.toHaveBeenCalled();
  });

  test("rejects a Memory order when captured currency differs from the stored checkout intent", async () => {
    mockPrisma.memoryMasterclassCheckoutIntent.findUnique.mockResolvedValue(
      makeMemoryIntent(),
    );

    const response = await postWebhook(
      makeApp(),
      makePayload({
        id: "pay_memory_wrong_currency",
        order_id: "order_memory_123",
        amount: 9900,
        currency: "USD",
      }),
      "event_memory_wrong_currency",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      skipped: true,
      reason: "memory_checkout_mismatch",
    });

    expect(
      mockPrisma.memoryMasterclassPurchase.create,
    ).not.toHaveBeenCalled();
  });

  test("an unknown ₹99 order is not guessed to be a Memory purchase", async () => {
    mockPrisma.memoryMasterclassCheckoutIntent.findUnique.mockResolvedValue(
      null,
    );

    const response = await postWebhook(
      makeApp(),
      makePayload({
        id: "pay_unknown_99",
        order_id: "order_unknown_99",
        amount: 9900,
      }),
      "event_unknown_99",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      skipped: true,
      reason: "unsupported_product_amount",
    });

    expect(
      mockPrisma.memoryMasterclassPurchase.create,
    ).not.toHaveBeenCalled();

    expect(
      mockPrisma.spokenEnglishPurchase.create,
    ).not.toHaveBeenCalled();
  });
});

