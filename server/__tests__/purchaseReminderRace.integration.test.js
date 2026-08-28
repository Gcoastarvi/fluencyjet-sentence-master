/**
 * Isolated PostgreSQL coverage for verified purchase attribution and the
 * purchase-versus-reminder destination-lock invariant. No production database
 * or live provider can be contacted by this suite.
 */
import crypto from "crypto";
import express from "express";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { acquireWhatsAppDestinationLock } from "../lib/whatsappDestinationLock.js";
import {
  ANY_QUESTIONS_REMINDER,
  CHECKOUT_HELP_REMINDER,
  SENTENCE_MASTER_PRODUCT_KEY,
  recordCheckoutIntent,
} from "../lib/whatsappJourney.js";

jest.setTimeout(45_000);

function fingerprint(connectionString) {
  const parsed = new URL(connectionString);
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        protocol: parsed.protocol,
        host: parsed.hostname.toLowerCase(),
        port: parsed.port || "5432",
        database: decodeURIComponent(parsed.pathname).replace(/^\/+/, ""),
      }),
    )
    .digest("hex");
}

const testDatabaseUrl = String(process.env.TEST_DATABASE_URL || "").trim();
const productionDatabaseUrl = String(process.env.DATABASE_URL || "").trim();

if (!testDatabaseUrl || !productionDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL and DATABASE_URL are required for isolation verification.",
  );
}
if (fingerprint(testDatabaseUrl) === fingerprint(productionDatabaseUrl)) {
  throw new Error("TEST_DATABASE_URL must not target DATABASE_URL.");
}

const control = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});
const purchaseClient = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});
const rolloutClient = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});
const lockClient = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});

const defaultProvider = jest.fn(() => {
  throw new Error("Default WhatsApp provider must not run in purchase tests.");
});
const defaultCapi = jest.fn(() => {
  throw new Error("Meta CAPI must not run in purchase tests.");
});

jest.unstable_mockModule("../db/client.js", () => ({
  default: purchaseClient,
}));
jest.unstable_mockModule("../services/whatsappProvider.js", () => ({
  sendWhatsAppTemplate: defaultProvider,
}));
jest.unstable_mockModule("../lib/metaCapi.js", () => ({
  sendCapiPurchase: defaultCapi,
}));

const { default: razorpayRouter } =
  await import("../routes/webhookRazorpay.js");
const { createRolloutReminderHandler } =
  await import("../routes/automationProcessor.js");

const originalEnvironment = {
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  automationSecret: process.env.AUTOMATION_SECRET,
  liveSendEnabled: process.env.WHATSAPP_LIVE_SEND_ENABLED,
  rolloutEnabled: process.env.WHATSAPP_ROLLOUT_WORKER_ENABLED,
  rolloutWatermark: process.env.WHATSAPP_LESSON1_ROLLOUT_WATERMARK,
  templateLanguage: process.env.WHATSAPP_LESSON1_TEMPLATE_LANGUAGE,
  pixelId: process.env.META_PIXEL_ID,
  capiToken: process.env.META_CAPI_ACCESS_TOKEN,
};

const webhookSecret = "purchase-race-webhook-secret";
const automationSecret = "purchase-race-automation-secret";
const runToken = crypto.randomInt(100_000_000, 999_999_999).toString();
const userIds = new Set();
const paymentIds = new Set();

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function waitFor(condition, message, timeoutMilliseconds = 8_000) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(message);
}

function makeApp(provider = jest.fn()) {
  const app = express();
  app.use("/api/webhooks", razorpayRouter);
  app.use(express.json());
  app.post(
    "/api/automation/process-due-reminder-rollout",
    createRolloutReminderHandler({
      database: rolloutClient,
      sendTemplate: provider,
    }),
  );
  return app;
}

async function createCheckoutUser(index) {
  const number = `+1996${runToken}${index}`;
  const user = await control.user.create({
    data: {
      name: `Purchase Attribution User ${index}`,
      email: `purchase-${runToken}-${index}@example.test`,
      password: "not-a-real-password",
      whatsapp_number: number,
      whatsapp_number_normalized: number,
      whatsapp_consent: true,
      whatsapp_consent_at: new Date(),
      has_access: false,
    },
  });
  userIds.add(user.id);
  return user;
}

function purchasePayload(user, paymentId, createdAt) {
  paymentIds.add(paymentId);
  return {
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: paymentId,
          amount: 119900,
          currency: "INR",
          status: "captured",
          email: user.email,
          contact: user.whatsapp_number_normalized,
          created_at: Math.floor(createdAt.getTime() / 1000),
        },
      },
    },
  };
}

function postPurchase(app, payload, eventId) {
  const rawBody = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha256", webhookSecret)
    .update(Buffer.from(rawBody))
    .digest("hex");

  return request(app)
    .post("/api/webhooks/razorpay")
    .set("Content-Type", "application/json")
    .set("X-Razorpay-Signature", signature)
    .set("X-Razorpay-Event-Id", eventId)
    .send(rawBody)
    .then((response) => response);
}

function postRollout(app) {
  return request(app)
    .post("/api/automation/process-due-reminder-rollout")
    .set("Authorization", `Bearer ${automationSecret}`)
    .send({ liveSend: true, limit: 1 })
    .then((response) => response);
}

async function cleanup() {
  const ids = [...userIds];
  const payments = [...paymentIds];

  if (payments.length > 0) {
    await control.spokenEnglishPurchase.deleteMany({
      where: { paymentId: { in: payments } },
    });
  }
  if (ids.length > 0) {
    await control.automationEvent.deleteMany({ where: { userId: { in: ids } } });
    await control.sentenceMasterCheckoutIntent.deleteMany({
      where: { userId: { in: ids } },
    });
    await control.user.deleteMany({ where: { id: { in: ids } } });
  }

  userIds.clear();
  paymentIds.clear();
}

beforeAll(async () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;
  process.env.AUTOMATION_SECRET = automationSecret;
  process.env.WHATSAPP_LIVE_SEND_ENABLED = "true";
  process.env.WHATSAPP_ROLLOUT_WORKER_ENABLED = "true";
  process.env.WHATSAPP_LESSON1_TEMPLATE_LANGUAGE = "en";
  delete process.env.META_PIXEL_ID;
  delete process.env.META_CAPI_ACCESS_TOKEN;

  await Promise.all([
    control.$connect(),
    purchaseClient.$connect(),
    rolloutClient.$connect(),
    lockClient.$connect(),
  ]);
});

afterEach(async () => {
  await cleanup();
  jest.clearAllMocks();
});

afterAll(async () => {
  await cleanup();
  await Promise.all([
    control.$disconnect(),
    purchaseClient.$disconnect(),
    rolloutClient.$disconnect(),
    lockClient.$disconnect(),
  ]);

  for (const [name, value] of Object.entries({
    RAZORPAY_WEBHOOK_SECRET: originalEnvironment.webhookSecret,
    AUTOMATION_SECRET: originalEnvironment.automationSecret,
    WHATSAPP_LIVE_SEND_ENABLED: originalEnvironment.liveSendEnabled,
    WHATSAPP_ROLLOUT_WORKER_ENABLED: originalEnvironment.rolloutEnabled,
    WHATSAPP_LESSON1_ROLLOUT_WATERMARK:
      originalEnvironment.rolloutWatermark,
    WHATSAPP_LESSON1_TEMPLATE_LANGUAGE:
      originalEnvironment.templateLanguage,
    META_PIXEL_ID: originalEnvironment.pixelId,
    META_CAPI_ACCESS_TOKEN: originalEnvironment.capiToken,
  })) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("Sentence Master purchase attribution PostgreSQL integration", () => {
  test("commits attribution, entitlement, audit-preserving cancellation, and replay exactly once", async () => {
    const app = makeApp();
    const user = await createCheckoutUser(1);
    const intentAt = new Date(Date.now() - 5 * 60_000);
    const intent = await recordCheckoutIntent({
      database: control,
      userId: user.id,
      occurredAt: intentAt,
    });
    const anyQuestions = await control.automationEvent.create({
      data: {
        userId: user.id,
        productKey: SENTENCE_MASTER_PRODUCT_KEY,
        eventType: ANY_QUESTIONS_REMINDER,
        status: "PENDING",
        sourceAutomationEventId: intent.automationEvent.id,
        destinationNumberNormalized: user.whatsapp_number_normalized,
        scheduledAt: new Date(Date.now() + 60_000),
      },
    });
    const paymentId = `pay.integration.${runToken}.1`;
    const payload = purchasePayload(user, paymentId, new Date());

    const first = await postPurchase(app, payload, `event.${runToken}.1`);
    const replay = await postPurchase(app, payload, `event.${runToken}.1`);
    const secondPaymentId = `pay.integration.${runToken}.1.second`;
    const second = await postPurchase(
      app,
      purchasePayload(user, secondPaymentId, new Date()),
      `event.${runToken}.1.second`,
    );

    const [savedUser, purchases, reminders] = await Promise.all([
      control.user.findUnique({ where: { id: user.id } }),
      control.spokenEnglishPurchase.findMany({
        where: { paymentId: { in: [paymentId, secondPaymentId] } },
        orderBy: { paymentId: "asc" },
      }),
      control.automationEvent.findMany({
        where: {
          id: { in: [intent.automationEvent.id, anyQuestions.id] },
        },
        orderBy: { id: "asc" },
      }),
    ]);

    expect(first.status).toBe(200);
    expect(replay.body).toEqual({ ok: true, duplicate: true });
    expect(second.status).toBe(200);
    expect(purchases).toHaveLength(2);
    expect(purchases).toEqual(expect.arrayContaining([
      expect.objectContaining({
        paymentId,
        userId: user.id,
        productKey: SENTENCE_MASTER_PRODUCT_KEY,
        sourceIntentId: intent.checkoutIntent.id,
      }),
      expect.objectContaining({
        paymentId: secondPaymentId,
        userId: null,
        productKey: SENTENCE_MASTER_PRODUCT_KEY,
        sourceIntentId: null,
      }),
    ]));
    expect(savedUser).toMatchObject({
      has_access: true,
      plan: "PRO",
      tier_level: "pro",
    });
    expect(reminders).toHaveLength(2);
    expect(reminders.every((event) => event.status === "CANCELLED")).toBe(true);
    expect(reminders.every((event) => event.cancelledAt instanceof Date)).toBe(
      true,
    );
    expect(defaultCapi).not.toHaveBeenCalled();
  });

  test("a committed purchase wins ahead of final reminder eligibility and prevents provider dispatch", async () => {
    const provider = jest.fn(() => {
      throw new Error("Provider must not run after purchase commits.");
    });
    const app = makeApp(provider);
    const user = await createCheckoutUser(2);
    const intentAt = new Date(Date.now() - 10 * 60_000);
    const intent = await recordCheckoutIntent({
      database: control,
      userId: user.id,
      occurredAt: intentAt,
    });
    await control.automationEvent.update({
      where: { id: intent.automationEvent.id },
      data: { scheduledAt: new Date(Date.now() - 60_000) },
    });
    process.env.WHATSAPP_LESSON1_ROLLOUT_WATERMARK =
      new Date(Date.now() - 30 * 60_000).toISOString();

    const held = deferred();
    const release = deferred();
    const blocker = lockClient.$transaction(
      async (tx) => {
        await acquireWhatsAppDestinationLock(
          tx,
          user.whatsapp_number_normalized,
        );
        held.resolve();
        await release.promise;
      },
      { maxWait: 5_000, timeout: 20_000 },
    );
    await held.promise;

    const paymentId = `pay.integration.${runToken}.race`;
    let purchase;
    let rollout;
    let purchaseResponse;
    let rolloutResponse;

    try {
      purchase = postPurchase(
        app,
        purchasePayload(user, paymentId, new Date()),
        `event.${runToken}.race`,
      );

      await waitFor(
        async () => {
          const rows = await control.$queryRaw`
            SELECT COUNT(*)::int AS count
            FROM pg_locks
            WHERE locktype = 'advisory' AND granted = false
          `;
          return rows[0]?.count >= 1;
        },
        "Purchase did not wait for the held destination lock.",
      );

      rollout = postRollout(app);
      await waitFor(
        async () =>
          (await control.automationEvent.findUnique({
            where: { id: intent.automationEvent.id },
            select: { status: true },
          }))?.status === "SENDING",
        "Reminder was not claimed before final destination eligibility.",
      );
      await waitFor(
        async () => {
          const rows = await control.$queryRaw`
            SELECT COUNT(*)::int AS count
            FROM pg_locks
            WHERE locktype = 'advisory' AND granted = false
          `;
          return rows[0]?.count >= 2;
        },
        "Purchase and reminder were not serialized behind the same lock.",
      );
    } finally {
      release.resolve();
    }

    [purchaseResponse, rolloutResponse] = await Promise.all([
      purchase,
      rollout,
      blocker,
    ]);
    const [savedEvent, savedUser, savedPurchase] = await Promise.all([
      control.automationEvent.findUnique({
        where: { id: intent.automationEvent.id },
      }),
      control.user.findUnique({ where: { id: user.id } }),
      control.spokenEnglishPurchase.findUnique({ where: { paymentId } }),
    ]);

    expect(purchaseResponse.status).toBe(200);
    expect(rolloutResponse.status).toBe(200);
    expect(rolloutResponse.body.rows[0]).toMatchObject({
      result: "SKIPPED",
      reasonCode: "USER_HAS_ACCESS",
      whatsappSent: false,
    });
    expect(savedPurchase).toMatchObject({
      userId: user.id,
      sourceIntentId: intent.checkoutIntent.id,
    });
    expect(savedUser.has_access).toBe(true);
    expect(savedEvent).toMatchObject({
      status: "CANCELLED",
      providerMessageId: null,
    });
    expect(provider).not.toHaveBeenCalled();
  });

  test("purchase attribution prevents concurrent checkout intent from recreating pending reminders", async () => {
    const app = makeApp();
    const user = await createCheckoutUser(3);
    const firstIntentAt = new Date(Date.now() - 10 * 60_000);
    const firstIntent = await recordCheckoutIntent({
      database: control,
      userId: user.id,
      occurredAt: firstIntentAt,
    });
    await control.automationEvent.update({
      where: { id: firstIntent.automationEvent.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        processedAt: new Date(),
      },
    });

    const held = deferred();
    const release = deferred();
    const blocker = lockClient.$transaction(
      async (tx) => {
        await acquireWhatsAppDestinationLock(
          tx,
          user.whatsapp_number_normalized,
        );
        held.resolve();
        await release.promise;
      },
      { maxWait: 5_000, timeout: 20_000 },
    );
    await held.promise;

    const paymentId = `pay.integration.${runToken}.checkout-race`;
    let purchase;
    let concurrentCheckout;

    try {
      purchase = postPurchase(
        app,
        purchasePayload(user, paymentId, new Date()),
        `event.${runToken}.checkout-race`,
      );
      await waitFor(
        async () => {
          const rows = await control.$queryRaw`
            SELECT COUNT(*)::int AS count
            FROM pg_locks
            WHERE locktype = 'advisory' AND granted = false
          `;
          return rows[0]?.count >= 1;
        },
        "Purchase did not queue first on the held destination lock.",
      );

      concurrentCheckout = recordCheckoutIntent({
        database: rolloutClient,
        userId: user.id,
        occurredAt: new Date(),
      });
      await waitFor(
        async () => {
          const rows = await control.$queryRaw`
            SELECT COUNT(*)::int AS count
            FROM pg_locks
            WHERE locktype = 'advisory' AND granted = false
          `;
          return rows[0]?.count >= 2;
        },
        "Checkout intent did not serialize behind the purchase destination lock.",
      );
    } finally {
      release.resolve();
    }

    const [purchaseResponse, checkoutResult] = await Promise.all([
      purchase,
      concurrentCheckout,
      blocker,
    ]);
    const [savedUser, events, intents, savedPurchase] = await Promise.all([
      control.user.findUnique({ where: { id: user.id } }),
      control.automationEvent.findMany({ where: { userId: user.id } }),
      control.sentenceMasterCheckoutIntent.findMany({
        where: { userId: user.id },
      }),
      control.spokenEnglishPurchase.findUnique({ where: { paymentId } }),
    ]);

    expect(purchaseResponse.status).toBe(200);
    expect(checkoutResult).toEqual({
      created: false,
      reason: "USER_HAS_ACCESS",
    });
    expect(savedUser.has_access).toBe(true);
    expect(savedPurchase).toMatchObject({
      userId: user.id,
      sourceIntentId: firstIntent.checkoutIntent.id,
    });
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe("CANCELLED");
    expect(intents).toHaveLength(1);
  });
});