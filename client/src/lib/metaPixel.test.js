import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  FJ_PIXEL_ID, MEMORY_PIXEL_ID, MEMORY_ROUTE_PREFIXES, isMemoryRoute,
  dispatchMetaEvent, trackMemoryLead, trackMemoryCheckout, memoryPurchaseEventId,
  setMetaConsent,
} from "./metaPixel.js";
import { trackPageView, trackEvent, trackMetaStandard } from "./tracking.js";
import { MEMORY_ROUTE_PREFIXES as serverPrefixes, renderMetaPixelHtml } from "../../../server/config/metaTracking.js";

let calls, ga, storage;
const originalWindow = globalThis.window;
const originalDocument = globalThis.document;
function go(path) {
  const url = new URL(path, "https://www.fluencyjet.com");
  window.location = url;
}
beforeEach(() => {
  calls = []; ga = []; storage = new Map();
  globalThis.window = {
    location: new URL("https://www.fluencyjet.com/memory-challenge"),
    fbq: (...args) => calls.push(args),
    gtag: (...args) => ga.push(args), crypto: webcrypto,
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
  };
  globalThis.document = { title: "Memory Challenge" };
});
afterEach(() => {
  globalThis.window = originalWindow;
  globalThis.document = originalDocument;
});
const events = () => calls.filter(call => /^trackSingle/.test(call[0]));

test("memory routes, retests, and products have strict prefix boundaries", () => {
  assert.deepEqual(MEMORY_ROUTE_PREFIXES, serverPrefixes);
  for (const path of [
    "/memory-challenge", "/memory-challenge/video/advanced?utm_source=wa",
    "/memory-challenge/retest", "/memory-retest/result",
    "/memory-masterclass/thank-you", "/memory-products/future",
    "/Memory-Challenge/Result", "/%6Demory-challenge/video/school",
  ]) assert.equal(isMemoryRoute(path), true, path);
  for (const path of [
    "/vocabulary-course", "/spoken-english-offer", "/german-live-class",
    "/german-live-class/thank-you",
    "/dashboard", "/memory-challenge-other", "/other?next=/memory-challenge",
  ]) assert.equal(isMemoryRoute(path), false, path);
});

test("SPA memory → vocabulary → memory → German routes only to their own Pixel", () => {
  for (const path of ["/memory-challenge", "/vocabulary-course", "/memory-challenge/result", "/german"]) {
    go(path); trackPageView(path); trackPageView(path); // StrictMode duplicate
  }
  assert.deepEqual(events().map(call => [call[1], call[2]]), [
    [MEMORY_PIXEL_ID, "PageView"], [FJ_PIXEL_ID, "PageView"],
    [MEMORY_PIXEL_ID, "PageView"], [FJ_PIXEL_ID, "PageView"],
  ]);
  assert.equal(calls.filter(call => call[0] === "init").length, 2);
  assert.ok(calls.filter(call => call[0] === "set").every(call => call[2] === false));
  assert.equal(ga.length, 8); // Existing GA behavior is not silently rewritten.
});

test("memory query-only views deduplicate; going away and returning counts a new visit", () => {
  trackPageView("/memory-challenge");
  go("/memory-challenge?utm_source=wa"); trackPageView("/memory-challenge?utm_source=wa");
  go("/vocabulary-course"); trackPageView("/vocabulary-course");
  go("/memory-challenge"); trackPageView("/memory-challenge");
  assert.equal(events().filter(call => call[1] === MEMORY_PIXEL_ID).length, 2);
});

test("memory custom engagement and assessment events never broadcast to FJ", () => {
  for (const name of ["memory_test_started", "memory_test_completed", "memory_offer_click", "memory_retest_completed"]) {
    trackEvent(name, { track: "advanced", form: "B" });
  }
  assert.ok(events().every(call => call[0] === "trackSingleCustom" && call[1] === MEMORY_PIXEL_ID));
  trackEvent("memory_offer_view", { track: "advanced" });
  trackEvent("memory_offer_view", { track: "advanced" });
  assert.equal(events().filter(call => call[2] === "memory_offer_view").length, 1);
});

test("stale cross-funnel callbacks are blocked, while English events preserve names/payloads", () => {
  trackMetaStandard("Lead", { content_name: "English" });
  trackEvent("vocabulary_payment_cta_click");
  assert.equal(events().length, 0);
  go("/spoken-english-offer");
  trackMetaStandard("InitiateCheckout", { value: 1199, currency: "INR" });
  trackEvent("spoken_english_offer_payment_cta_click", { source: "offer" });
  trackEvent("memory_lead");
  assert.deepEqual(events(), [
    ["trackSingle", FJ_PIXEL_ID, "InitiateCheckout", { value: 1199, currency: "INR" }],
    ["trackSingleCustom", FJ_PIXEL_ID, "spoken_english_offer_payment_cta_click", { source: "offer" }],
  ]);
});

test("Lead uses a stable opaque assessment ID and sends once across repeated saved callbacks", async () => {
  await trackMemoryLead({ assessmentKey: "private-owner-token", track: "advanced" });
  await trackMemoryLead({ assessmentKey: "private-owner-token", track: "advanced" });
  assert.equal(events().length, 1);
  assert.equal(events()[0][2], "Lead");
  assert.match(events()[0][4].eventID, /^memory_lead_[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(calls).includes("private-owner-token"));
  const id = events()[0][4].eventID;
  // New tab/module state with the same origin storage still suppresses repeats.
  globalThis.window = { ...window };
  await trackMemoryLead({ assessmentKey: "private-owner-token", track: "advanced" });
  assert.equal(events().length, 1);
  storage.clear(); globalThis.window = { ...window };
  await trackMemoryLead({ assessmentKey: "private-owner-token", track: "advanced" });
  assert.equal(events()[1][4].eventID, id);
});

test("checkout is required, fixed ₹99, and deduplicated per server order", () => {
  assert.equal(trackMemoryCheckout({}), false);
  assert.equal(trackMemoryCheckout({ orderId: "order_a", amount: 119900, currency: "INR" }), false);
  assert.equal(trackMemoryCheckout({ orderId: "order_a", amount: 9900, currency: "USD" }), false);
  const order = { orderId: "order_a", amount: 9900, currency: "INR", track: "advanced" };
  trackMemoryCheckout(order); trackMemoryCheckout(order);
  assert.equal(events().length, 1);
  assert.equal(events()[0][2], "InitiateCheckout");
  assert.equal(events()[0][3].value, 99);
  assert.equal(events()[0][4].eventID, "memory_checkout_order_a");
});

test("privacy filtering and consent opt-out do not expose contacts or block the application", () => {
  dispatchMetaEvent("memory_test", {
    content_name: "Memory", purchaserName: "Private", ownerToken: "secret",
    details: { email: "private@example.test", phone: "123", track: "advanced" },
  }, { memory: true, custom: true });
  assert.deepEqual(events()[0][3], { content_name: "Memory", details: { track: "advanced" } });
  setMetaConsent(false); trackEvent("memory_offer_click");
  assert.equal(events().length, 1);
  setMetaConsent(true); trackEvent("memory_offer_click");
  assert.equal(events().length, 2);
  window.fbq = () => { throw new Error("blocked"); };
  assert.doesNotThrow(() => trackEvent("memory_offer_click"));
  assert.doesNotThrow(() => setMetaConsent(false));
  assert.equal(window.fjMetaConsent, false);
});

test("thank-you PageView is not Purchase; future purchase IDs match the server convention", () => {
  go("/memory-masterclass/thank-you?razorpay_payment_id=unverified");
  trackPageView(window.location.pathname + window.location.search);
  assert.deepEqual(events().map(call => call[2]), ["PageView"]);
  assert.equal(memoryPurchaseEventId("pay_a"), "memory_masterclass_99_purchase_pay_a");
});

test("production HTML no-script fallback is route-aware, not a global FJ leak", () => {
  const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  assert.ok(!html.includes('fbq("init"'));
  for (const [path, pixel] of [["/memory-retest/result", MEMORY_PIXEL_ID], ["/vocabulary-course", FJ_PIXEL_ID]]) {
    assert.ok(renderMetaPixelHtml(html, path).includes(`tr?id=${pixel}&amp;ev=PageView`));
  }
});
