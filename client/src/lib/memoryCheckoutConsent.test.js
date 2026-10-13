import test from "node:test";
import assert from "node:assert/strict";
import { grantMemoryCheckoutConsent, currentMemoryChoice } from "./memoryCheckoutConsent.js";
import { MEMORY_CONSENT_KEY } from "./memoryMetaConsent.js";

const grant = { ok: true, receipt: "a".repeat(64), granted: true,
  version: "memory_meta_v1", expiresAt: "2099-01-01" };
function fixture() {
  const events = new EventTarget(), calls = [], views = [], order = [];
  let stored = null;
  const localStorage = { getItem: () => stored,
    setItem: (key, value) => { assert.equal(key, MEMORY_CONSENT_KEY); stored = value; } };
  const w = {
    localStorage, location: new URL("https://www.fluencyjet.com/memory-challenge/video/school"),
    addEventListener: (...args) => events.addEventListener(...args),
    removeEventListener: (...args) => events.removeEventListener(...args),
    dispatchEvent: e => events.dispatchEvent(e),
    fbq: (...args) => calls.push(args),
  };
  const options = { w, adultConfirmed: true,
    post: async (path, body) => {
      assert.equal(path, "/memory-meta/consent");
      assert.equal(body.adultConfirmed, true);
      assert.equal(body.granted, true);
      order.push("consent confirmed");
      return { ok: true, data: grant };
    },
    boot: () => { assert.equal(w.memoryMetaConsentVerified, true); return true; },
    pageView: path => views.push(path),
  };
  return { w, options, views, calls, order };
}
test("unchecked/nonadult choice cannot call API or activate Meta", async () => {
  const { options, w } = fixture();
  let requests = 0;
  for (const adultConfirmed of [false, undefined, "true"]) {
    assert.equal(await grantMemoryCheckoutConsent({ ...options, adultConfirmed,
      post: () => { requests++; } }), null);
  }
  assert.equal(requests, 0);
  assert.notEqual(w.memoryMetaConsentVerified, true);
});
test("server confirmation precedes verified receipt and current-route PageView", async () => {
  const { options, w, views, order } = fixture();
  const receipt = await grantMemoryCheckoutConsent(options);
  assert.equal(receipt, grant.receipt);
  assert.equal(w.memoryMetaConsentVerified, true);
  assert.deepEqual(JSON.parse(w.localStorage.getItem(MEMORY_CONSENT_KEY)), grant);
  assert.deepEqual(views, ["/memory-challenge/video/school"]);
  order.push("order may be created");
  assert.deepEqual(order, ["consent confirmed", "order may be created"]);
});
for (const [name, response] of [
  ["network throws", new Error("offline")],
  ["HTTP failure", { ok: false, data: grant }],
  ["declined", { ok: true, data: { ...grant, granted: false } }],
  ["expired", { ok: true, data: { ...grant, expiresAt: "2000-01-01" } }],
  ["missing receipt", { ok: true, data: { ...grant, receipt: null } }],
]) test(`${name}: optional failure returns null and no browser measurement`, async () => {
  const { options, w, views } = fixture();
  assert.equal(await grantMemoryCheckoutConsent({ ...options, post: async () => {
    if (response instanceof Error) throw response;
    return response;
  } }), null);
  assert.equal(w.memoryMetaConsentVerified, false);
  assert.deepEqual(views, []);
});
for (const change of ["withdraw", "clear", "same-tab"]) {
  test(`pending grant fenced against ${change}`, async () => {
    const { options, w, views } = fixture();
    let resolve;
    const pending = grantMemoryCheckoutConsent({ ...options,
      post: () => new Promise(r => { resolve = r; }) });
    if (change === "same-tab") w.dispatchEvent(new Event("memory-meta-consent"));
    else {
      const event = new Event("storage");
      Object.assign(event, { storageArea: w.localStorage,
        key: change === "clear" ? null : MEMORY_CONSENT_KEY });
      w.dispatchEvent(event);
    }
    resolve({ ok: true, data: grant });
    assert.equal(await pending, null);
    assert.equal(w.memoryMetaConsentVerified, false);
    assert.deepEqual(views, []);
  });
}
test("saved decline and expiry are explicit choices, not automatic grants", () => {
  assert.equal(currentMemoryChoice({ ...grant, granted: false }), true);
  assert.equal(currentMemoryChoice({ ...grant, expiresAt: "2000-01-01" }), false);
  assert.equal(currentMemoryChoice(null), false);
});
test("slow optional consent times out; a late response cannot grant or block booking", async () => {
  const { options, w, views } = fixture();
  let resolve, signal;
  const receipt = await grantMemoryCheckoutConsent({ ...options, timeoutMs: 5,
    post: (path, body, config) => {
      signal = config.signal;
      return new Promise(r => { resolve = r; });
    } });
  assert.equal(receipt, null);
  assert.equal(signal.aborted, true);
  resolve({ ok: true, data: grant });
  await Promise.resolve();
  assert.equal(w.memoryMetaConsentVerified, false);
  assert.deepEqual(views, []);
});
