// Explicit MOCK-ONLY receipt fixtures. Not included in normal Jest testMatch.
import crypto from "node:crypto";
import express from "express";
import request from "supertest";
import { beforeEach, afterEach, test, expect, jest } from "@jest/globals";
import {
  MOCK_RECEIPT_CONTEXT as context, requireMockReceipt, prepareMockGraphReceipt,
} from "../../client/tests/memoryReceiptPolicy.mjs";
import { assertReceiptSandbox } from "../../client/tests/memoryReceiptSandbox.mjs";

await assertReceiptSandbox({
  scratch: process.env.MEMORY_RECEIPT_QA_SCRATCH,
  parent: process.env.MEMORY_RECEIPT_QA_PARENT_NAMESPACE, path: process.env.PATH,
});
requireMockReceipt(context);
const mockPrisma = {
  memoryMasterclassCheckoutIntent: { findUnique: jest.fn() },
  memoryMasterclassPurchase: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  vocabularyCheckoutIntent: { findUnique: jest.fn() },
  sentenceMasterCheckoutIntent: { findMany: jest.fn() },
  spokenEnglishPurchase: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  user: { update: jest.fn() }, automationEvent: { updateMany: jest.fn() },
};
jest.unstable_mockModule("../db/client.js", () => ({ default: mockPrisma }));
// DO NOT mock metaCapi: the actual helper executes, only its HTTP is mocked.
const { default: router } = await import("../routes/webhookRazorpay.js");
const signingSecret = "offline-local-fixture-signature-only";
const receipts = [];
let fetchMock;

function intent(track = "school_foundation", standalone = false) {
  return {
    id: "offline_intent", razorpayOrderId: "order_offline_receipt",
    memoryAssessmentSessionId: standalone ? null : "offline_session",
    checkoutSource: standalone ? "standalone_vsl" : "assessment",
    productKey: "memory_masterclass_99", amount: 9900, currency: "INR",
    eventKey: "offline_event_snapshot", trackId: track,
    purchaserName: "Synthetic fixture", purchaserEmail: "offline-owner@example.test",
    purchaserPhone: null, visitorId: null, fbp: null, fbc: null,
    clientIp: null, clientUserAgent: "MemoryOfflineFixture/1.0",
  };
}

function capture(patch = {}) {
  return { event: "payment.captured", payload: { payment: { entity: {
    id: "pay_offline_receipt", order_id: "order_offline_receipt",
    amount: 9900, currency: "INR", status: "captured",
    email: "offline-owner@example.test", contact: null,
    created_at: Math.floor(Date.now() / 1000), ...patch,
  } } } };
}

function post(payload, validSignature = true) {
  const app = express();
  app.use("/api/webhooks", router); // only supertest-owned loopback listener
  const raw = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", signingSecret).update(raw).digest("hex");
  return request(app).post("/api/webhooks/razorpay")
    .set("Content-Type", "application/json")
    .set("X-Razorpay-Signature", validSignature ? signature : "invalid")
    .set("X-Razorpay-Event-Id", "evt_offline_receipt").send(raw);
}

beforeEach(() => {
  requireMockReceipt(context);
  jest.resetAllMocks(); receipts.length = 0;
  // No real credentials: public placeholders inside the sealed child only.
  process.env.RAZORPAY_WEBHOOK_SECRET = signingSecret;
  process.env.MEMORY_META_CAPI_ACCESS_TOKEN = context.accessToken;
  process.env.MEMORY_META_TEST_EVENT_CODE = context.testEventCode;
  mockPrisma.memoryMasterclassCheckoutIntent.findUnique.mockResolvedValue(intent());
  mockPrisma.memoryMasterclassPurchase.findFirst.mockResolvedValue(null);
  mockPrisma.memoryMasterclassPurchase.create.mockImplementation(async ({ data }) => ({ id: "offline_purchase", ...data }));
  mockPrisma.memoryMasterclassPurchase.update.mockResolvedValue({ id: "offline_purchase" });
  fetchMock = jest.spyOn(globalThis, "fetch").mockImplementation(async (url, options) => {
    receipts.push(prepareMockGraphReceipt(url, options, context).summary);
    return { status: 200, ok: true, text: async () => '{"events_received":1}' };
  });
});

afterEach(() => {
  fetchMock?.mockRestore();
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
  delete process.env.MEMORY_META_CAPI_ACCESS_TOKEN;
  delete process.env.MEMORY_META_TEST_EVENT_CODE;
});

for (const [track, standalone] of [
  ["school_foundation", false], ["advanced", false],
  ["school_foundation", true], ["school_advanced", true], ["advanced", true],
]) {
  test(`MOCK receipt signed capture: ${track}/${standalone ? "standalone" : "assessment"} and replay`, async () => {
    mockPrisma.memoryMasterclassCheckoutIntent.findUnique.mockResolvedValue(intent(track, standalone));
    const response = await post(capture());
    expect(response.body).toMatchObject({ ok: true, capiDelivered: true });
    expect(receipts).toEqual([{
      event: "Purchase", pixel: "1998316064175555", value: 99, currency: "INR",
      eventId: "memory_masterclass_99_purchase_pay_offline_receipt",
    }]);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.data[0].user_data.em).toEqual([
      crypto.createHash("sha256").update("offline-owner@example.test").digest("hex"),
    ]);
    expect(body.data[0].user_data).not.toHaveProperty("client_ip_address");
    expect(body.data[0].user_data).not.toHaveProperty("fbp");
    expect(body.data[0].user_data).not.toHaveProperty("fbc");
    expect(mockPrisma.memoryMasterclassPurchase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        purchaserName: "Synthetic fixture", purchaserEmail: "offline-owner@example.test",
        checkoutSource: standalone ? "standalone_vsl" : "assessment", trackId: track,
      }),
    });
    mockPrisma.memoryMasterclassPurchase.findFirst.mockResolvedValue({ id: "offline_purchase" });
    expect((await post(capture())).body.duplicate).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockPrisma.memoryMasterclassPurchase.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.automationEvent.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.spokenEnglishPurchase.create).not.toHaveBeenCalled();
  });
}

test("invalid signature fails before persistence and HTTP", async () => {
  expect((await post(capture(), false)).status).toBe(400);
  expect(mockPrisma.memoryMasterclassCheckoutIntent.findUnique).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("wrong amount never reaches receipt HTTP", async () => {
  expect((await post(capture({ amount: 119900 }))).body.capiDelivered).not.toBe(true);
  expect(mockPrisma.memoryMasterclassPurchase.create).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("missing dedicated token preserves purchase but disables CAPI", async () => {
  delete process.env.MEMORY_META_CAPI_ACCESS_TOKEN;
  expect((await post(capture())).body).toMatchObject({ ok: true, capiSkipped: true });
  expect(mockPrisma.memoryMasterclassPurchase.create).toHaveBeenCalledTimes(1);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("transport guard rejects missing QA code before simulated acceptance", async () => {
  delete process.env.MEMORY_META_TEST_EVENT_CODE;
  expect((await post(capture())).body.capiDelivered).toBe(false);
  expect(receipts).toEqual([]);
  expect(mockPrisma.memoryMasterclassPurchase.create).toHaveBeenCalledTimes(1);
});

test("foreign dataset fails closed without FJ send", async () => {
  process.env.MEMORY_META_PIXEL_ID = "1246171816816642";
  try {
    expect((await post(capture())).body.capiSkipped).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  } finally { delete process.env.MEMORY_META_PIXEL_ID; }
});
