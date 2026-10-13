import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryConsentGranted, memoryConsentReceipt, isMemoryConsentStorageEvent, MEMORY_CONSENT_KEY } from "./memoryMetaConsent.js";
import { bootMetaDocument } from "./metaDocument.js";

test("Memory default-deny blocks SDK loading, not the FJ boundary", () => {
  const scripts = [];
  const w = {
    location: new URL("https://www.fluencyjet.com/memory-challenge"),
    history: { pushState() {}, replaceState() {} }, addEventListener() {},
    localStorage: { getItem: () => null }, sessionStorage: { getItem: () => "true" },
    document: { querySelector: () => null, createElement: () => ({}), head: { appendChild: n => scripts.push(n) } },
  };
  assert.equal(bootMetaDocument(w), false);
  assert.equal(w.fbq, undefined);
  assert.equal(scripts.filter(n => n.src).length, 0);
  assert.equal(memoryConsentReceipt(w), null);
});
for (const [name, record, verified] of [
  ["unverified", { granted: true, version: "memory_meta_v1", expiresAt: "2099-01-01" }, false],
  ["declined", { granted: false, version: "memory_meta_v1", expiresAt: "2099-01-01" }, true],
  ["expired", { granted: true, version: "memory_meta_v1", expiresAt: "2000-01-01" }, true],
  ["old policy", { granted: true, version: "old", expiresAt: "2099-01-01" }, true],
]) test(`Memory ${name} choice fails closed`, () => {
  const w = { memoryMetaConsentVerified: verified, localStorage: { getItem: () => JSON.stringify(record) } };
  assert.equal(memoryConsentGranted(w), false);
  assert.equal(memoryConsentReceipt(w), null);
});
test("only real localStorage consent changes and clear require revalidation", () => {
  const w = { localStorage: {}, sessionStorage: {} };
  for (const key of [MEMORY_CONSENT_KEY, null]) {
    assert.equal(isMemoryConsentStorageEvent({ key, storageArea: w.localStorage }, w), true);
    assert.equal(isMemoryConsentStorageEvent({ key, storageArea: w.sessionStorage }, w), false);
  }
  for (const key of ["fj_meta_sent:1998316064175555:Lead:fixture", "other", "memory_track", undefined]) {
    assert.equal(isMemoryConsentStorageEvent({ key, storageArea: w.localStorage }, w), false);
  }
  assert.equal(isMemoryConsentStorageEvent({ key: MEMORY_CONSENT_KEY, storageArea: null }, w), false);
});
