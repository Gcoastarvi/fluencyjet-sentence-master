import { jest, test, expect, beforeEach } from "@jest/globals";
const db = {
  memoryMasterclassPurchase: { updateMany: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
  memoryMetaConsent: { findUnique: jest.fn() },
};
jest.unstable_mockModule("../db/client.js", () => ({ default: db }));
const { deliverMemoryPurchase, runMemoryMetaDelivery } = await import("../services/memoryMetaDelivery.js");
const env = { MEMORY_META_CAPI_ACCESS_TOKEN: "offline-invalid-token" };
const time = new Date("2026-10-11T12:00:00Z");
let row, send;
beforeEach(() => {
  jest.resetAllMocks();
  row = {
    id: "fixture", metaEventId: "memory_masterclass_99_purchase_fixture", metaEventTime: time,
    metaAttempts: 0, metaDeliveryStatus: "PENDING", metaConsentGranted: true,
    metaConsentId: "consent", metaConsentRevision: 1, metaConsentVersion: "memory_meta_v1",
    purchaserEmail: "adult@example.test", purchaserPhone: "+919111111111",
    checkoutIntent: { visitorId: "fixture-visitor", fbp: "fixture-fbp", clientIp: "spoofed-IP", clientUserAgent: "Fixture/1" },
  };
  db.memoryMetaConsent.findUnique.mockResolvedValue({
    granted: true, adultConfirmed: true, version: "memory_meta_v1", revision: 1,
    expiresAt: new Date("2026-11-01"), revokedAt: null,
  });
  db.memoryMasterclassPurchase.findUnique.mockImplementation(async () => ({ ...row }));
  db.memoryMasterclassPurchase.findMany.mockResolvedValue([{ id: row.id }]);
  db.memoryMasterclassPurchase.updateMany.mockImplementation(async ({ data }) => {
    if (data.metaLeaseToken && row.metaDeliveryStatus === "SENDING") return { count: 0 };
    if (data.metaAttempts?.increment) row.metaAttempts += data.metaAttempts.increment;
    const { metaAttempts, ...rest } = data;
    Object.assign(row, rest);
    return { count: 1 };
  });
  send = jest.fn().mockResolvedValue({ ok: true, status: 200 });
});
const run = () => deliverMemoryPurchase("fixture", { db, send, env, now: () => time });
test("standard INR99 Purchase only BrainoDad, stable time/id and consented purchaser", async () => {
  expect(await run()).toEqual({ delivered: true });
  expect(send).toHaveBeenCalledWith(expect.objectContaining({
    pixelId: "1998316064175555", apiVersion: "v26.0", value: 99, currency: "INR",
    eventId: "memory_masterclass_99_purchase_fixture", eventTime: time.getTime(),
    email: "adult@example.test", phone: "+919111111111", clientIpAddress: null,
  }));
  expect(row.metaDelivered).toBe(true);
});
test("concurrent claims send once; durable lease fences completion", async () => {
  const results = await Promise.all([run(), run()]);
  expect(send).toHaveBeenCalledTimes(1);
  expect(results.some(r => r.reason === "not_claimed")).toBe(true);
  expect(db.memoryMasterclassPurchase.updateMany.mock.calls.at(-1)[0].where.metaLeaseToken).toMatch(/^[a-f0-9]{32}$/);
});
test.each([{ status: 500 }, { status: 429 }, { status: 0 }, { status: 400, transient: true }])(
  "transient failure persists bounded retry %j", async error => {
    send.mockResolvedValue({ ...error, ok: false });
    expect((await run()).status).toBe("RETRY");
    expect(row.metaNextAttemptAt.getTime()).toBeGreaterThan(time.getTime());
    const first = send.mock.calls[0][0];
    row.metaDeliveryStatus = "RETRY";
    send.mockResolvedValue({ ok: true, status: 200 });
    await deliverMemoryPurchase("fixture", { db, send, env, now: () => row.metaNextAttemptAt });
    expect(send.mock.calls[1][0].eventId).toBe(first.eventId);
    expect(send.mock.calls[1][0].eventTime).toBe(first.eventTime);
  });
test("permanent failure is identifiable and not retried", async () => {
  send.mockResolvedValue({ ok: false, status: 400 });
  expect((await run()).status).toBe("FAILED");
  expect(row.metaLastErrorCode).toBe("HTTP_400");
});
test("exhausted transient retries stop", async () => {
  row.metaAttempts = 5;
  send.mockResolvedValue({ ok: false, status: 503 });
  expect((await run()).status).toBe("FAILED");
});
test.each([false, undefined])("no verified purchase consent -> no HTTP (%s)", async value => {
  row.metaConsentGranted = value;
  expect((await run()).reason).toBe("consent_inactive");
  expect(send).not.toHaveBeenCalled();
});
test("withdrawn/revised consent stops pending delivery", async () => {
  db.memoryMetaConsent.findUnique.mockResolvedValue({ granted: false });
  await run();
  expect(send).not.toHaveBeenCalled();
});
test("historical/expired event is not fabricated or backfilled", async () => {
  row.metaEventTime = new Date(0);
  await run();
  expect(row.metaDeliveryStatus).toBe("EXPIRED");
  expect(send).not.toHaveBeenCalled();
});
test("missing token never claims or falls back to FJ", async () => {
  await deliverMemoryPurchase("fixture", { db, send, env: { META_CAPI_ACCESS_TOKEN: "english-fixture" } });
  expect(db.memoryMasterclassPurchase.updateMany).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});
test("production test code disables Memory sends", async () => {
  await deliverMemoryPurchase("fixture", { db, send, env: { ...env, NODE_ENV: "production", MEMORY_META_TEST_EVENT_CODE: "QA" } });
  expect(send).not.toHaveBeenCalled();
});
test("worker claims only bounded Memory records, never WhatsApp or FJ jobs", async () => {
  await runMemoryMetaDelivery({ db, send, env, now: () => time });
  expect(db.memoryMasterclassPurchase.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({ productKey: "memory_masterclass_99", metaDelivered: false }), take: 5,
  }));
});
