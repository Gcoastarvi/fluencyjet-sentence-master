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
  vocabularyCheckoutIntent: {
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

const { default: vocabularyCheckoutRouter } =
  await import("../routes/vocabularyCheckout.js");

function makeApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use("/api/vocabulary", vocabularyCheckoutRouter);
  return app;
}

beforeEach(() => {
  jest.resetAllMocks();

  process.env.RAZORPAY_KEY_ID = "rzp_test_public_key";
  process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret_key";

  mockOrderCreate.mockResolvedValue({
    id: "order_vocab_123",
    amount: 79900,
    currency: "INR",
  });

  mockPrisma.vocabularyCheckoutIntent.create.mockResolvedValue({
    id: "intent_vocab_123",
    razorpayOrderId: "order_vocab_123",
  });
});

afterEach(() => {
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
});

describe("Vocabulary ₹799 Razorpay checkout", () => {
  test("creates a server-locked ₹799 order and stores Meta attribution", async () => {
    const app = makeApp();

    const response = await request(app)
      .post("/api/vocabulary/create-order")
      .set("User-Agent", "FluencyJet-Test-Browser/1.0")
      .set("X-Forwarded-For", "49.12.34.56, 10.0.0.1")
      .send({
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

        // Deliberately malicious/untrusted values.
        // The server MUST ignore them.
        amount: 1,
        currency: "USD",
        productKey: "fake_product",
      });

    expect(response.status).toBe(200);

    expect(mockOrderCreate).toHaveBeenCalledTimes(1);

    const razorpayOrder =
      mockOrderCreate.mock.calls[0][0];

    expect(razorpayOrder).toMatchObject({
      amount: 79900,
      currency: "INR",
      notes: {
        productKey: "vocabulary_challenge_799",
      },
    });

    expect(
      mockPrisma.vocabularyCheckoutIntent.create,
    ).toHaveBeenCalledTimes(1);

    expect(
      mockPrisma.vocabularyCheckoutIntent.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        razorpayOrderId: "order_vocab_123",

        amount: 79900,
        currency: "INR",
        productKey: "vocabulary_challenge_799",

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

        clientIp: "49.12.34.56",
        clientUserAgent: "FluencyJet-Test-Browser/1.0",
      }),
    });

    expect(response.body).toEqual({
      ok: true,
      keyId: "rzp_test_public_key",
      orderId: "order_vocab_123",
      amount: 79900,
      currency: "INR",
      checkoutIntentId: "intent_vocab_123",
    });
  });

  test("does not allow browser payload to change the ₹799 product price", async () => {
    const response = await request(makeApp())
      .post("/api/vocabulary/create-order")
      .send({
        amount: 100,
        currency: "USD",
        productKey: "cheap_fake_product",
      });

    expect(response.status).toBe(200);

    expect(mockOrderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 79900,
        currency: "INR",
        notes: {
          productKey: "vocabulary_challenge_799",
        },
      }),
    );

    expect(
      mockPrisma.vocabularyCheckoutIntent.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 79900,
        currency: "INR",
        productKey: "vocabulary_challenge_799",
      }),
    });
  });

  test("fails safely when Razorpay credentials are missing", async () => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;

    const response = await request(makeApp())
      .post("/api/vocabulary/create-order")
      .send({});

    expect(response.status).toBe(500);

    expect(response.body).toEqual({
      ok: false,
      message: "Unable to start secure checkout",
    });

    expect(mockOrderCreate).not.toHaveBeenCalled();

    expect(
      mockPrisma.vocabularyCheckoutIntent.create,
    ).not.toHaveBeenCalled();
  });
});
