import { jest, test, expect, beforeEach } from "@jest/globals";
const db = { memoryMetaConsent: {
  findUnique: jest.fn(), create: jest.fn(), update: jest.fn(),
} };
jest.unstable_mockModule("../db/client.js", () => ({ default: db }));
const { recordMemoryConsent, memoryConsentSnapshot, purchaseConsentActive,
  MEMORY_META_CONSENT_VERSION } = await import("../services/memoryMetaConsent.js");
const receipt = "a".repeat(64);
const grant = () => ({
  id: "consent-fixture", granted: true, adultConfirmed: true, revision: 1,
  source: "memory_funnel_adult_opt_in", version: MEMORY_META_CONSENT_VERSION,
  recordedAt: new Date(), expiresAt: new Date(Date.now() + 86400000), revokedAt: null,
});
beforeEach(() => {
  jest.clearAllMocks();
  db.memoryMetaConsent.findUnique.mockResolvedValue(grant());
  db.memoryMetaConsent.create.mockImplementation(async ({ data }) => ({ id: "fixture", ...data }));
  db.memoryMetaConsent.update.mockImplementation(async ({ data }) => ({ id: "consent-fixture", ...data }));
});
test.each([undefined, null, "", "unknown"])("missing/invalid receipt denies without lookup: %s", async value => {
  expect((await memoryConsentSnapshot(value)).metaConsentGranted).toBe(false);
  expect(db.memoryMetaConsent.findUnique).not.toHaveBeenCalled();
});
test("explicit adult consent; token stored only as hash; server-owned evidence", async () => {
  const result = await recordMemoryConsent({ granted: true, adultConfirmed: true, version: "forged" });
  expect(result.granted).toBe(true);
  expect(result.receipt).toMatch(/^[a-f0-9]{64}$/);
  const data = db.memoryMetaConsent.create.mock.calls[0][0].data;
  expect(data.tokenHash).not.toBe(result.receipt);
  expect(data.version).toBe(MEMORY_META_CONSENT_VERSION);
  expect(data.recordedAt).toBeInstanceOf(Date);
  expect(data).not.toHaveProperty("email");
});
test.each([{ granted: "true", adultConfirmed: true }, { granted: true }, { granted: true, adultConfirmed: false }])(
  "no implicit/child grant %j", async body => {
    await expect(recordMemoryConsent(body)).rejects.toThrow("CONSENT_INVALID");
    expect(db.memoryMetaConsent.create).not.toHaveBeenCalled();
  });
test("decline is supported without adult declaration", async () => {
  expect((await recordMemoryConsent({ granted: false })).granted).toBe(false);
});
test("unknown bearer cannot change an existing decision", async () => {
  db.memoryMetaConsent.findUnique.mockResolvedValue(null);
  await expect(recordMemoryConsent({ receipt, granted: false })).rejects.toThrow("CONSENT_RECEIPT_INVALID");
  expect(db.memoryMetaConsent.update).not.toHaveBeenCalled();
});
test("grant evidence copied from server record, not caller claims", async () => {
  expect(await memoryConsentSnapshot(receipt)).toEqual(expect.objectContaining({
    metaConsentGranted: true, metaConsentId: "consent-fixture", metaConsentRevision: 1,
    metaConsentVersion: MEMORY_META_CONSENT_VERSION,
  }));
});
test.each([
  { granted: false }, { adultConfirmed: false }, { revokedAt: new Date() },
  { expiresAt: new Date(0) }, { version: "old-policy" },
])("inactive consent denies %j", async patch => {
  db.memoryMetaConsent.findUnique.mockResolvedValue({ ...grant(), ...patch });
  expect((await memoryConsentSnapshot(receipt)).metaConsentGranted).toBe(false);
});
test("withdrawal increments revision; regrant does not authorize old orders", async () => {
  await recordMemoryConsent({ receipt, granted: false });
  expect(db.memoryMetaConsent.update.mock.calls[0][0].data).toEqual(expect.objectContaining({
    granted: false, revision: 2, revokedAt: expect.any(Date),
  }));
  db.memoryMetaConsent.findUnique.mockResolvedValue({ ...grant(), revision: 3 });
  expect(await purchaseConsentActive({
    metaConsentGranted: true, metaConsentId: "consent-fixture",
    metaConsentRevision: 1, metaConsentVersion: MEMORY_META_CONSENT_VERSION,
  })).toBe(false);
});
test("consent storage failure denies measurement, not checkout authorization", async () => {
  db.memoryMetaConsent.findUnique.mockRejectedValue(new Error("offline fixture DB error"));
  expect((await memoryConsentSnapshot(receipt)).metaConsentGranted).toBe(false);
});
