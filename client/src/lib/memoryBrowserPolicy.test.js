import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryBrowserRouteEligible, memoryCommercialParams } from "./memoryBrowserPolicy.js";
import { dispatchMetaEvent, dispatchMetaPageView, trackMemoryCheckout, trackMemoryLead } from "./metaPixel.js";

function browser(path, { granted = true, verified = true, storage = new Map(), session = new Map() } = {}) {
  const calls = [];
  storage.set("brainodad_meta_consent_v1", JSON.stringify({ granted, version: "memory_meta_v1", expiresAt: "2099-01-01" }));
  globalThis.window = {
    location: new URL(path, "https://www.fluencyjet.com"), memoryMetaConsentVerified: verified,
    fbq: (...args) => calls.push(args),
    localStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v) },
    sessionStorage: { getItem: k => session.get(k), setItem: (k,v) => session.set(k,v) },
  };
  return { calls, storage, session, events: () => calls.filter(c => /^trackSingle/.test(c[0])) };
}

for (const path of ["/memory-masterclass/parents", "/memory-challenge/video/school", "/memory-challenge/video/advanced"]) {
  test(`verified adult marketing events use only BrainoDad: ${path}`, () => {
    const f = browser(path);
    dispatchMetaPageView(path); dispatchMetaPageView(path);
    for (const name of ["memory_offer_click", "memory_track_selected", "memory_offer_view"]) {
      dispatchMetaEvent(name, { funnel: "amaze_memory", track: "school_foundation", score: 14, childAge: 11, id: "child-private" }, { memory: true, custom: true, view: name.endsWith("view") });
    }
    assert.equal(f.events().length, 4);
    assert.ok(f.events().every(c => c[1] === "1998316064175555"));
    assert.ok(!JSON.stringify(f.calls).includes("child-private"));
    assert.ok(f.events().every(c => !["Purchase", "Lead"].includes(c[2])));
  });
}

for (const path of ["/memory-challenge", "/memory-challenge/start", "/memory-challenge/test", "/memory-challenge/result", "/memory-retest/result", "/memory-products/new"]) {
  test(`student or unknown context withheld despite inherited parent receipt: ${path}`, async () => {
    const f = browser(path);
    dispatchMetaPageView(path);
    dispatchMetaEvent("memory_test_completed", {}, { memory: true, custom: true });
    trackMemoryCheckout({ orderId: "fixture", amount: 9900, currency: "INR" });
    await trackMemoryLead({ assessmentKey: "child-token" });
    assert.equal(f.calls.length, 0);
  });
}

test("private URL fields and fragments never reach the SDK gate", () => {
  for (const suffix of ["?email=private", "?token=private", "#child-token", "?razorpay_payment_id=private"]) {
    const f = browser(`/memory-masterclass/parents${suffix}`);
    assert.equal(memoryBrowserRouteEligible(window.location), false);
    dispatchMetaPageView(window.location.pathname);
    assert.equal(f.calls.length, 0);
  }
});

test("missing verification or declined permission cannot initialize a Pixel", () => {
  for (const opts of [{ granted: false }, { verified: false }]) {
    const f = browser("/memory-masterclass/parents", opts);
    dispatchMetaPageView(window.location.pathname);
    assert.equal(f.calls.length, 0);
  }
});

test("reloads deduplicate recent views and order IDs; clicks never create Purchase", () => {
  const f = browser("/memory-masterclass/parents");
  dispatchMetaPageView(window.location.pathname);
  const order = { orderId: "order_mock", amount: 9900, currency: "INR" };
  trackMemoryCheckout(order); trackMemoryCheckout(order);
  const next = browser("/memory-masterclass/parents", f);
  dispatchMetaPageView(window.location.pathname); trackMemoryCheckout(order);
  assert.equal(next.calls.length, 0);
  assert.deepEqual(f.events().map(c => c[2]), ["PageView", "InitiateCheckout"]);
  dispatchMetaEvent("memory_offer_click", {}, { memory: true, custom: true });
  dispatchMetaEvent("memory_offer_click", {}, { memory: true, custom: true });
  assert.equal(next.events().length, 1);
});

test("commercial allowlist discards nested and arbitrary student information", () => {
  assert.deepEqual(memoryCommercialParams({ value: 99, currency: "INR", track: "school_foundation", details: { answers: ["x"] }, source: "private child name", content_name: "child name" }), { value: 99, currency: "INR" });
});
