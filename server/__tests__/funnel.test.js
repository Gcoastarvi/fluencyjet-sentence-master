import {
  jest,
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";

const mockPrisma = {
  $transaction: jest.fn(),
  $executeRaw: jest.fn(),
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  automationEvent: {
    updateMany: jest.fn(),
    create: jest.fn(),
  },
  whatsAppPhoneSuppression: {
    updateMany: jest.fn(),
  },
  lessonModeProgress: {
    findUnique: jest.fn(),
  },
  userJourneyMilestone: {
    findUnique: jest.fn(),
  },
};

const mockBcrypt = {
  compare: jest.fn(),
  hash: jest.fn(),
};

jest.unstable_mockModule("../db/client.js", () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule("bcryptjs", () => ({
  default: mockBcrypt,
}));

const { default: funnelRouter } = await import("../routes/funnel.js");

const USER_ID = 42;
const OLD_NUMBER = "+919876543210";
const NEW_NUMBER = "+14155552671";

function makeUser(overrides = {}) {
  return {
    id: USER_ID,
    name: "Test Learner",
    email: "funnel-test@example.com",
    password: "hashed-password",
    plan: "FREE",
    has_access: false,
    track: "BEGINNER",
    current_unit: 1,
    webinar_registered: false,
    whatsapp_number: OLD_NUMBER,
    whatsapp_number_normalized: OLD_NUMBER,
    whatsapp_consent: false,
    whatsapp_consent_at: null,
    whatsapp_consent_source: null,
    whatsapp_opted_out_at: null,
    current_status: "working",
    main_goal: "speaking",
    practice_commitment: "daily",
    ...overrides,
  };
}

function signupBody(overrides = {}) {
  return {
    name: "Test Learner",
    email: "funnel-test@example.com",
    password: "correct-password",
    whatsapp_number: "9876543210",
    whatsapp_consent: true,
    current_status: "working",
    main_goal: "speaking",
    practice_commitment: "daily",
    ...overrides,
  };
}

function makeApp(userId = USER_ID) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req, _res, next) => {
    req.user = { id: userId };
    next();
  });
  app.use("/api/funnel", funnelRouter);
  return app;
}

function mockExistingUser(existingUser = makeUser()) {
  mockPrisma.user.findUnique.mockResolvedValue(existingUser);
  mockPrisma.user.update.mockImplementation(async ({ data }) => ({
    ...existingUser,
    ...data,
  }));
}

beforeEach(() => {
  process.env.JWT_SECRET = "funnel-route-test-secret";
  jest.clearAllMocks();

  mockPrisma.user.update.mockImplementation(async ({ data }) => ({
    ...makeUser(),
    ...data,
  }));
  mockPrisma.user.create.mockImplementation(async ({ data }) => ({
    ...makeUser(),
    ...data,
  }));
  mockPrisma.automationEvent.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.automationEvent.create.mockResolvedValue({ id: "event-1" });
  mockPrisma.whatsAppPhoneSuppression.updateMany.mockResolvedValue({
    count: 1,
  });
  mockPrisma.lessonModeProgress.findUnique.mockResolvedValue(null);
  mockPrisma.userJourneyMilestone.findUnique.mockResolvedValue(null);
  mockPrisma.$executeRaw.mockResolvedValue(1);
  mockBcrypt.compare.mockResolvedValue(true);
  mockBcrypt.hash.mockResolvedValue("new-hashed-password");
  mockPrisma.$transaction.mockImplementation(async (callback) =>
    callback(mockPrisma),
  );
});

afterEach(() => {
  delete process.env.JWT_SECRET;
});

describe("smart-signup WhatsApp identity safety", () => {
  test("invalid non-empty number fails before user or reminder mutation", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await request(makeApp())
      .post("/api/funnel/smart-signup")
      .send(signupBody({ whatsapp_number: "not-a-number" }));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_WHATSAPP_NUMBER");
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockPrisma.automationEvent.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.automationEvent.create).not.toHaveBeenCalled();
  });

  test("true canonical change stores fresh consent, clears opt-out, and reschedules one eligible reminder", async () => {
    const optedOutAt = new Date("2026-08-20T10:00:00.000Z");
    const existingUser = makeUser({
      whatsapp_opted_out_at: optedOutAt,
      whatsapp_consent: false,
    });
    mockExistingUser(existingUser);

    const res = await request(makeApp())
      .post("/api/funnel/smart-signup")
      .send(
        signupBody({
          whatsapp_number: NEW_NUMBER,
          whatsapp_consent: true,
        }),
      );

    expect(res.status).toBe(200);

    const updateData = mockPrisma.user.update.mock.calls[0][0].data;
    expect(updateData.whatsapp_number_normalized).toBe(NEW_NUMBER);
    expect(updateData.whatsapp_consent).toBe(true);
    expect(updateData.whatsapp_consent_at).toEqual(expect.any(Date));
    expect(updateData.whatsapp_consent_source).toBe(
      "try-spoken-english-gym",
    );
    expect(updateData.whatsapp_opted_out_at).toBeNull();

    expect(mockPrisma.automationEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: USER_ID,
          productKey: "sentence_master",
          eventType: "LESSON1_SIGNUP_REMINDER",
          status: "PENDING",
        },
      }),
    );
    expect(mockPrisma.automationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: USER_ID,
        productKey: "sentence_master",
        eventType: "LESSON1_SIGNUP_REMINDER",
        status: "PENDING",
        destinationNumberNormalized: NEW_NUMBER,
        scheduledAt: expect.any(Date),
        payload: {
          whatsapp_number: NEW_NUMBER,
          source: "try-spoken-english-gym",
        },
      }),
    });
    expect(mockPrisma.automationEvent.create).toHaveBeenCalledTimes(1);
  });

  test("true canonical change without consent resets consent and creates no replacement", async () => {
    mockExistingUser(
      makeUser({
        whatsapp_consent: true,
        whatsapp_consent_at: new Date("2026-08-20T09:00:00.000Z"),
        whatsapp_consent_source: "old-flow",
        whatsapp_opted_out_at: new Date("2026-08-20T10:00:00.000Z"),
      }),
    );

    const res = await request(makeApp())
      .post("/api/funnel/smart-signup")
      .send(
        signupBody({
          whatsapp_number: NEW_NUMBER,
          whatsapp_consent: false,
        }),
      );

    expect(res.status).toBe(200);

    const updateData = mockPrisma.user.update.mock.calls[0][0].data;
    expect(updateData.whatsapp_consent).toBe(false);
    expect(updateData.whatsapp_consent_at).toBeNull();
    expect(updateData.whatsapp_consent_source).toBeNull();
    expect(updateData.whatsapp_opted_out_at).toBeNull();
    expect(mockPrisma.automationEvent.updateMany).toHaveBeenCalled();
    expect(mockPrisma.automationEvent.create).not.toHaveBeenCalled();
  });

  test("same canonical number preserves opt-out when consent is false or omitted", async () => {
    const optedOutAt = new Date("2026-08-20T10:00:00.000Z");
    mockExistingUser(
      makeUser({
        whatsapp_opted_out_at: optedOutAt,
        whatsapp_consent: true,
      }),
    );

    const res = await request(makeApp())
      .post("/api/funnel/smart-signup")
      .send(
        signupBody({
          whatsapp_number: "+91 98765 43210",
          whatsapp_consent: false,
        }),
      );

    expect(res.status).toBe(200);
    const updateData = mockPrisma.user.update.mock.calls[0][0].data;
    expect(updateData.whatsapp_number_normalized).toBe(OLD_NUMBER);
    expect(updateData.whatsapp_consent).toBe(false);
    expect(updateData.whatsapp_opted_out_at).toBe(optedOutAt);
    expect(mockPrisma.automationEvent.updateMany).toHaveBeenCalled();
    expect(mockPrisma.automationEvent.create).not.toHaveBeenCalled();
  });

  test.each([
    ["omitted", undefined],
    ['string "true"', "true"],
    ["numeric 1", 1],
  ])(
    "only boolean true is fresh consent when whatsapp_consent is %s",
    async (_label, whatsappConsent) => {
      mockExistingUser(makeUser());

      const body = signupBody({
        whatsapp_number: "+91 98765 43210",
      });
      if (whatsappConsent === undefined) {
        delete body.whatsapp_consent;
      } else {
        body.whatsapp_consent = whatsappConsent;
      }

      const res = await request(makeApp())
        .post("/api/funnel/smart-signup")
        .send(body);

      expect(res.status).toBe(200);
      const updateData = mockPrisma.user.update.mock.calls[0][0].data;
      expect(updateData.whatsapp_consent).toBe(false);
      expect(updateData.whatsapp_consent_at).toBeNull();
      expect(updateData.whatsapp_consent_source).toBeNull();
      expect(mockPrisma.automationEvent.create).not.toHaveBeenCalled();
    },
  );

  test("same canonical explicit consent is deliberate re-consent and clears opt-out", async () => {
    mockExistingUser(
      makeUser({
        whatsapp_opted_out_at: new Date("2026-08-20T10:00:00.000Z"),
      }),
    );

    const res = await request(makeApp())
      .post("/api/funnel/smart-signup")
      .send(
        signupBody({
          whatsapp_number: "+91 98765 43210",
          whatsapp_consent: true,
        }),
      );

    expect(res.status).toBe(200);
    const updateData = mockPrisma.user.update.mock.calls[0][0].data;
    expect(updateData.whatsapp_number_normalized).toBe(OLD_NUMBER);
    expect(updateData.whatsapp_opted_out_at).toBeNull();
    expect(updateData.whatsapp_consent).toBe(true);
    expect(mockPrisma.automationEvent.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.whatsAppPhoneSuppression.updateMany).toHaveBeenCalledWith(
      {
        where: {
          phoneNumberNormalized: OLD_NUMBER,
          isOptedOut: true,
        },
        data: {
          isOptedOut: false,
          clearedAt: expect.any(Date),
          clearanceSource: "try-spoken-english-gym",
          clearanceReason: "explicit-whatsapp-consent",
          clearedByUserId: USER_ID,
        },
      },
    );
  });

  test.each([
    ["omitted consent", undefined],
    ["false consent", false],
  ])(
    "does not clear durable suppression for a same-number signup with %s",
    async (_label, whatsappConsent) => {
      mockExistingUser(
        makeUser({
          whatsapp_opted_out_at: new Date("2026-08-20T10:00:00.000Z"),
        }),
      );

      const body = signupBody({
        whatsapp_number: "+91 98765 43210",
      });
      if (whatsappConsent === undefined) {
        delete body.whatsapp_consent;
      } else {
        body.whatsapp_consent = whatsappConsent;
      }

      const res = await request(makeApp())
        .post("/api/funnel/smart-signup")
        .send(body);

      expect(res.status).toBe(200);
      expect(
        mockPrisma.whatsAppPhoneSuppression.updateMany,
      ).not.toHaveBeenCalled();
    },
  );

  test("does not clear durable suppression when changing numbers without consent", async () => {
    mockExistingUser(makeUser());

    const res = await request(makeApp())
      .post("/api/funnel/smart-signup")
      .send(
        signupBody({
          whatsapp_number: NEW_NUMBER,
          whatsapp_consent: false,
        }),
      );

    expect(res.status).toBe(200);
    expect(
      mockPrisma.whatsAppPhoneSuppression.updateMany,
    ).not.toHaveBeenCalled();
  });

  test("eligible smart-signup reschedules but completed Lesson 1 gets no replacement", async () => {
    mockExistingUser(makeUser());
    mockPrisma.lessonModeProgress.findUnique.mockResolvedValue({
      completed: 10,
      total: 10,
    });

    const res = await request(makeApp())
      .post("/api/funnel/smart-signup")
      .send(signupBody({ whatsapp_consent: true }));

    expect(res.status).toBe(200);
    expect(mockPrisma.automationEvent.updateMany).toHaveBeenCalled();
    expect(mockPrisma.automationEvent.create).not.toHaveBeenCalled();
  });

  test("reminder reconciliation failures do not break signup", async () => {
    mockExistingUser(makeUser());
    mockPrisma.lessonModeProgress.findUnique.mockRejectedValue(
      new Error("automation database unavailable"),
    );

    const res = await request(makeApp())
      .post("/api/funnel/smart-signup")
      .send(signupBody({ whatsapp_consent: true }));

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalled();
  });
});

describe("webinar registration WhatsApp identity safety", () => {
  test("invalid non-empty number fails before user or reminder mutation", async () => {
    const res = await request(makeApp())
      .post("/api/funnel/register-webinar")
      .send({ whatsapp_number: "ambiguous-number" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_WHATSAPP_NUMBER");
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.automationEvent.updateMany).not.toHaveBeenCalled();
  });

  test("formatting-only change preserves consent and opt-out without reminder mutation", async () => {
    const optedOutAt = new Date("2026-08-20T10:00:00.000Z");
    mockExistingUser(
      makeUser({
        whatsapp_consent: true,
        whatsapp_consent_at: new Date("2026-08-20T09:00:00.000Z"),
        whatsapp_consent_source: "try-spoken-english-gym",
        whatsapp_opted_out_at: optedOutAt,
      }),
    );

    const res = await request(makeApp())
      .post("/api/funnel/register-webinar")
      .send({ whatsapp_number: "+91 98765 43210" });

    expect(res.status).toBe(200);
    const updateData = mockPrisma.user.update.mock.calls[0][0].data;
    expect(updateData.whatsapp_number_normalized).toBe(OLD_NUMBER);
    expect(updateData).not.toHaveProperty("whatsapp_consent");
    expect(updateData).not.toHaveProperty("whatsapp_consent_at");
    expect(updateData).not.toHaveProperty("whatsapp_consent_source");
    expect(updateData).not.toHaveProperty("whatsapp_opted_out_at");
    expect(mockPrisma.automationEvent.updateMany).not.toHaveBeenCalled();
    expect(
      mockPrisma.whatsAppPhoneSuppression.updateMany,
    ).not.toHaveBeenCalled();
  });

  test("true canonical change resets consent, clears opt-out, and cancels pending only", async () => {
    mockExistingUser(
      makeUser({
        whatsapp_consent: true,
        whatsapp_consent_at: new Date("2026-08-20T09:00:00.000Z"),
        whatsapp_consent_source: "try-spoken-english-gym",
        whatsapp_opted_out_at: new Date("2026-08-20T10:00:00.000Z"),
      }),
    );

    const lifecycleRows = [
      { id: "pending", status: "PENDING" },
      { id: "sent", status: "SENT" },
      { id: "sending", status: "SENDING" },
    ];
    mockPrisma.automationEvent.updateMany.mockImplementation(
      async ({ where, data }) => {
        lifecycleRows
          .filter((row) => row.status === where.status)
          .forEach((row) => Object.assign(row, data));
        return { count: 1 };
      },
    );

    const res = await request(makeApp())
      .post("/api/funnel/register-webinar")
      .send({ whatsapp_number: NEW_NUMBER });

    expect(res.status).toBe(200);
    const updateData = mockPrisma.user.update.mock.calls[0][0].data;
    expect(updateData.whatsapp_consent).toBe(false);
    expect(updateData.whatsapp_consent_at).toBeNull();
    expect(updateData.whatsapp_consent_source).toBeNull();
    expect(updateData.whatsapp_opted_out_at).toBeNull();

    expect(mockPrisma.automationEvent.updateMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        productKey: "sentence_master",
        eventType: "LESSON1_SIGNUP_REMINDER",
        status: "PENDING",
      },
      data: {
        status: "CANCELLED",
        cancelledAt: expect.any(Date),
      },
    });
    expect(mockPrisma.automationEvent.create).not.toHaveBeenCalled();
    expect(
      mockPrisma.whatsAppPhoneSuppression.updateMany,
    ).not.toHaveBeenCalled();
    expect(lifecycleRows).toEqual([
      expect.objectContaining({ id: "pending", status: "CANCELLED" }),
      expect.objectContaining({ id: "sent", status: "SENT" }),
      expect.objectContaining({ id: "sending", status: "SENDING" }),
    ]);
  });

  test("webinar reminder reconciliation failure does not break registration", async () => {
    mockExistingUser(makeUser());
    mockPrisma.user.update.mockResolvedValue(makeUser({ id: USER_ID }));
    mockPrisma.automationEvent.updateMany.mockRejectedValue(
      new Error("automation database unavailable"),
    );

    const res = await request(makeApp())
      .post("/api/funnel/register-webinar")
      .send({ whatsapp_number: NEW_NUMBER });

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalled();
  });
});