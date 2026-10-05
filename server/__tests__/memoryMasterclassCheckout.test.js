import express from "express";
import request from "supertest";
import {
  beforeEach,
  afterEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

const mockOrderCreate = jest.fn();

const mockPrisma = {
  memoryAssessmentSession: {
    findUnique: jest.fn(),
  },
  memoryMasterclassCheckoutIntent: {
    create: jest.fn(),
  },
};

class MockRazorpay {
  constructor(config) {
    this.config = config;
    this.orders = {
      create: mockOrderCreate,
    };
  }
}

jest.unstable_mockModule("razorpay", () => ({
  default: MockRazorpay,
}));

jest.unstable_mockModule("../db/client.js", () => ({
  default: mockPrisma,
}));

const { default: memoryMasterclassCheckoutRouter } =
  await import("../routes/memoryMasterclassCheckout.js");

function makeApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(
    "/api/memory-masterclass",
    memoryMasterclassCheckoutRouter,
  );
  return app;
}

const eligibleSession = {
  id: "memory_session_123",
  publicToken: "public_memory_123",
  trackId: "school_foundation",
  status: "LEAD_CAPTURED",
  leadCapturedAt: new Date("2026-10-05T05:00:00.000Z"),
  whatsappConsent: true,

  utmSource: "facebook",
  utmMedium: "paid_social",
  utmCampaign: "memory_parent_campaign",
  utmContent: "parent_ad_1",
  utmTerm: "study_memory_test",
  source: "memory-challenge",
};

beforeEach(() => {
  jest.resetAllMocks();

  process.env.RAZORPAY_KEY_ID = "rzp_test_public_key";
  process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret_key";

  mockPrisma.memoryAssessmentSession.findUnique.mockResolvedValue(
    eligibleSession,
  );

  mockOrderCreate.mockResolvedValue({
    id: "order_memory_123",
    amount: 9900,
    currency: "INR",
  });

  mockPrisma.memoryMasterclassCheckoutIntent.create.mockResolvedValue({
    id: "intent_memory_123",
    razorpayOrderId: "order_memory_123",
  });
});

afterEach(() => {
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
});

describe("Memory Masterclass ₹99 Razorpay checkout", () => {
  test("creates a server-locked ₹99 order tied to the assessment session", async () => {
    const response = await request(makeApp())
      .post("/api/memory-masterclass/create-order")
      .set("User-Agent", "FluencyJet-Test-Browser/1.0")
      .set("X-Forwarded-For", "49.12.34.56, 10.0.0.1")
      .send({
        ownerToken: "private_owner_token_123",

        visitorId: "visitor_memory_123",
        fbclid: "fbclid_memory_123",
        fbc: "fb.1.123456789.fbclid_memory_123",
        fbp: "fb.1.123456789.987654321",

        landingPage:
          "https://www.fluencyjet.com/memory-challenge/result",

        // Deliberately malicious/untrusted values.
        amount: 1,
        currency: "USD",
        productKey: "fake_product",
        trackId: "advanced",
        eventKey: "fake_event",
      });

    expect(response.status).toBe(200);

    expect(
      mockPrisma.memoryAssessmentSession.findUnique,
    ).toHaveBeenCalledWith({
      where: {
        ownerToken: "private_owner_token_123",
      },
      select: expect.objectContaining({
        id: true,
        trackId: true,
        status: true,
        leadCapturedAt: true,
        whatsappConsent: true,
      }),
    });

    expect(mockOrderCreate).toHaveBeenCalledTimes(1);

    expect(mockOrderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 9900,
        currency: "INR",
        notes: {
          productKey: "memory_masterclass_99",
          eventKey: "2026-10-18_1700_ist",
          trackId: "school_foundation",
        },
      }),
    );

    expect(
      mockPrisma.memoryMasterclassCheckoutIntent.create,
    ).toHaveBeenCalledTimes(1);

    expect(
      mockPrisma.memoryMasterclassCheckoutIntent.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        memoryAssessmentSessionId: "memory_session_123",

        razorpayOrderId: "order_memory_123",

        amount: 9900,
        currency: "INR",
        productKey: "memory_masterclass_99",

        eventKey: "2026-10-18_1700_ist",
        eventStartsAt: new Date("2026-10-18T11:30:00.000Z"),
        eventEndsAt: new Date("2026-10-18T13:30:00.000Z"),
        eventTimezone: "Asia/Kolkata",

        // Must come from DB, not browser payload.
        trackId: "school_foundation",

        visitorId: "visitor_memory_123",
        fbclid: "fbclid_memory_123",
        fbc: "fb.1.123456789.fbclid_memory_123",
        fbp: "fb.1.123456789.987654321",

        // Falls back to assessment attribution.
        utmSource: "facebook",
        utmMedium: "paid_social",
        utmCampaign: "memory_parent_campaign",
        utmContent: "parent_ad_1",
        utmTerm: "study_memory_test",

        source: "memory-challenge",

        landingPage:
          "https://www.fluencyjet.com/memory-challenge/result",

        clientIp: "49.12.34.56",
        clientUserAgent: "FluencyJet-Test-Browser/1.0",
      }),
    });

    expect(response.body).toEqual({
      ok: true,
      keyId: "rzp_test_public_key",
      orderId: "order_memory_123",
      amount: 9900,
      currency: "INR",
      checkoutIntentId: "intent_memory_123",
      event: {
        key: "2026-10-18_1700_ist",
        startsAt: "2026-10-18T11:30:00.000Z",
        endsAt: "2026-10-18T13:30:00.000Z",
        timezone: "Asia/Kolkata",
      },
    });
  });

  test("requires the private owner token", async () => {
    const response = await request(makeApp())
      .post("/api/memory-masterclass/create-order")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(
      "MEMORY_OWNER_TOKEN_REQUIRED",
    );

    expect(
      mockPrisma.memoryAssessmentSession.findUnique,
    ).not.toHaveBeenCalled();

    expect(mockOrderCreate).not.toHaveBeenCalled();

    expect(
      mockPrisma.memoryMasterclassCheckoutIntent.create,
    ).not.toHaveBeenCalled();
  });

  test("rejects an owner token that does not match a session", async () => {
    mockPrisma.memoryAssessmentSession.findUnique.mockResolvedValue(
      null,
    );

    const response = await request(makeApp())
      .post("/api/memory-masterclass/create-order")
      .send({
        ownerToken: "unknown_owner_token",
      });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe(
      "MEMORY_SESSION_NOT_FOUND",
    );

    expect(mockOrderCreate).not.toHaveBeenCalled();

    expect(
      mockPrisma.memoryMasterclassCheckoutIntent.create,
    ).not.toHaveBeenCalled();
  });

  test("blocks checkout until lead capture is complete", async () => {
    mockPrisma.memoryAssessmentSession.findUnique.mockResolvedValue({
      ...eligibleSession,
      status: "FORM_A_COMPLETED",
      leadCapturedAt: null,
      whatsappConsent: false,
    });

    const response = await request(makeApp())
      .post("/api/memory-masterclass/create-order")
      .send({
        ownerToken: "private_owner_token_123",
      });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe(
      "MEMORY_LEAD_CAPTURE_REQUIRED",
    );

    expect(mockOrderCreate).not.toHaveBeenCalled();

    expect(
      mockPrisma.memoryMasterclassCheckoutIntent.create,
    ).not.toHaveBeenCalled();
  });

  test("does not allow browser payload to change price, track, or event", async () => {
    const response = await request(makeApp())
      .post("/api/memory-masterclass/create-order")
      .send({
        ownerToken: "private_owner_token_123",

        amount: 100,
        currency: "USD",
        productKey: "cheap_fake_product",
        trackId: "advanced",
        eventKey: "tomorrow_at_midnight",
      });

    expect(response.status).toBe(200);

    expect(mockOrderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 9900,
        currency: "INR",
        notes: {
          productKey: "memory_masterclass_99",
          eventKey: "2026-10-18_1700_ist",
          trackId: "school_foundation",
        },
      }),
    );

    expect(
      mockPrisma.memoryMasterclassCheckoutIntent.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 9900,
        currency: "INR",
        productKey: "memory_masterclass_99",
        eventKey: "2026-10-18_1700_ist",
        trackId: "school_foundation",
      }),
    });
  });

  test("fails safely when Razorpay credentials are missing", async () => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;

    const response = await request(makeApp())
      .post("/api/memory-masterclass/create-order")
      .send({
        ownerToken: "private_owner_token_123",
      });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      ok: false,
      code: "MEMORY_MASTERCLASS_CHECKOUT_FAILED",
      message: "Unable to start secure checkout.",
    });

    expect(mockOrderCreate).not.toHaveBeenCalled();

    expect(
      mockPrisma.memoryMasterclassCheckoutIntent.create,
    ).not.toHaveBeenCalled();
  });
});
