import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import * as currentTracking from "./tracking.js";
import {
  FJ_PIXEL_ID, MEMORY_PIXEL_ID, MEMORY_ROUTE_PREFIXES, isMemoryRoute,
  dispatchMetaEvent, trackMemoryLead, trackMemoryCheckout, memoryPurchaseEventId,
    setMetaConsent, initializeMetaDocument, captureMetaDocument,
} from "./metaPixel.js";
import { trackPageView, trackEvent, trackMetaStandard } from "./tracking.js";
import { MEMORY_ROUTE_PREFIXES as serverPrefixes, renderMetaPixelHtml } from "../../../server/config/metaTracking.js";

let calls, ga, storage;
const originalWindow = globalThis.window;
const originalDocument = globalThis.document;
function go(path) {
  const url = new URL(path, "https://www.fluencyjet.com");
  if (isMemoryRoute(url.pathname) !== isMemoryRoute(window.location.pathname)) {
    globalThis.window = { ...window, location: url }; // a new browser document
  } else window.location = url;
}
beforeEach(() => {
  calls = []; ga = []; storage = new Map();
  storage.set("brainodad_meta_consent_v1", JSON.stringify({
    granted: true, version: "memory_meta_v1", expiresAt: "2099-01-01",
  }));
  globalThis.window = {
    memoryMetaConsentVerified: true,
    location: new URL("https://www.fluencyjet.com/memory-masterclass/parents"),
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

test("fresh memory/FJ documents each initialize only their owner; FJ PageView calls retain prior semantics", () => {
  for (const path of ["/memory-masterclass/parents", "/vocabulary-course", "/memory-challenge/video/advanced", "/german"]) {
    go(path); trackPageView(path); trackPageView(path); // StrictMode duplicate
  }
  assert.deepEqual(events().map(call => [call[1], call[2]]), [
    [MEMORY_PIXEL_ID, "PageView"], [FJ_PIXEL_ID, "PageView"], [FJ_PIXEL_ID, "PageView"],
    [MEMORY_PIXEL_ID, "PageView"], [FJ_PIXEL_ID, "PageView"], [FJ_PIXEL_ID, "PageView"],
  ]);
  assert.equal(calls.filter(call => call[0] === "init").length, 4);
  assert.deepEqual(calls.filter(call => call[0] === "set"), [
    ["set", "autoConfig", false, MEMORY_PIXEL_ID],
    ["set", "autoConfig", false, MEMORY_PIXEL_ID],
  ]);
  assert.equal(ga.length, 8); // Existing GA behavior is not silently rewritten.
});

test("an illegally changed pathname cannot initialize a second Pixel in an existing document", () => {
  captureMetaDocument(window);
  initializeMetaDocument(window);
  window.location = new URL("https://www.fluencyjet.com/spoken-english-offer");
  trackPageView("/spoken-english-offer");
  trackMetaStandard("Lead");
  assert.deepEqual(calls.filter(c => c[0] === "init"), [["init", MEMORY_PIXEL_ID]]);
  assert.equal(events().length, 0);
});

test("coded FJ Lead/PageView/Vocabulary/English checkout events match the pre-feature baseline", () => {
  // Captured from the pre-feature helper with mock browser APIs. Keep the
  // regression portable to shallow CI checkouts, without Git-history access.
  const baseline = JSON.parse(readFileSync(new URL("../../tests/fixtures/fjTrackingBaseline.json", import.meta.url), "utf8"));
  const outputs = [baseline];
  for (const module of [currentTracking]) {
    const meta = [], analytics = [];
    globalThis.window = {
      location: new URL("https://www.fluencyjet.com/vocabulary-course?source=fixture"),
      fbq: (...args) => meta.push(args), gtag: (...args) => analytics.push(args),
    };
    module.trackPageView("/vocabulary-course?source=fixture");
    module.trackPageView("/vocabulary-course?source=fixture");
    module.trackLevelCheckComplete({ score: 77, track: "beginner", source: "fixture" });
    module.trackSignupComplete({ method: "email", track: "beginner" });
    module.trackVocabularyVSLView();
    module.trackVocabularyCourseView({ source: "fixture" });
    module.trackVocabularyInitiateCheckout({ placement: "footer", source: "fixture" });
    module.trackVocabularyInitiateCheckout({ placement: "footer", source: "fixture" });
    module.trackSpokenEnglishInitiateCheckout();
    module.trackSpokenEnglishInitiateCheckout();
    module.trackEvent("SpokenEnglishThankYouViewed", { value: 1199, currency: "INR" });
    outputs.push({
      analytics,
      meta: meta.filter(c => ["track", "trackCustom", "trackSingle", "trackSingleCustom"].includes(c[0]))
        .map(c => {
          const event = c.slice(c[0].includes("Single") ? 2 : 1);
          return [c[0].includes("Custom") ? "custom" : "standard", event[0], event[1] || {}];
        }),
    });
    if (module === currentTracking) {
      assert.deepEqual(meta.filter(c => c[0] === "init"), [["init", FJ_PIXEL_ID]]);
      assert.equal(meta.filter(c => c[0] === "set").length, 0);
    }
  }
  // JSON transport omits optional undefined properties (e.g. main_goal).
  assert.deepEqual(JSON.parse(JSON.stringify(outputs[1])), outputs[0]);
});

test("memory query-only views deduplicate; going away and returning counts a new visit", () => {
  trackPageView("/memory-masterclass/parents");
  go("/memory-masterclass/parents?utm_source=wa"); trackPageView("/memory-masterclass/parents?utm_source=wa");
  go("/vocabulary-course"); trackPageView("/vocabulary-course");
  go("/memory-masterclass/parents"); trackPageView("/memory-masterclass/parents");
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

test("memory assessment scores and identity are stripped without changing English payloads", () => {
  trackEvent("memory_result_viewed", {
    track: "advanced", score: 23.5, totalScore: 23.5,
    modules: { weightedScore: 10, answers: ["private"] },
    learnerName: "Private", email: "private@example.test",
  });
  assert.equal(events().length, 0);
  go("/vocabulary-course");
  const params = { score: 7, source: "existing_english" };
  trackEvent("vocabulary_test_complete", params);
  assert.deepEqual(events().at(-1)[3], params);
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

test("assessment Lead never shares hashed student tokens, including on adult pages", async () => {
  assert.equal(await trackMemoryLead({ assessmentKey: "private-owner-token", track: "advanced" }), false);
  assert.equal(events().length, 0);
  assert.ok(!JSON.stringify(calls).includes("private-owner-token"));
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
  dispatchMetaEvent("memory_offer_view", {
    content_name: "Memory", purchaserName: "Private", ownerToken: "secret",
    details: { email: "private@example.test", phone: "123", track: "advanced" },
  }, { memory: true, custom: true });
  assert.deepEqual(events()[0][3], {});
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
  assert.deepEqual(events().map(call => call[2]), []);
  assert.equal(memoryPurchaseEventId("pay_a"), "memory_masterclass_99_purchase_pay_a");
});

test("production HTML no-script fallback is route-aware, not a global FJ leak", () => {
  const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  assert.ok(!html.includes('fbq("init"'));
  for (const [path, pixel] of [["/memory-retest/result", MEMORY_PIXEL_ID], ["/vocabulary-course", FJ_PIXEL_ID]]) {
    if (pixel === MEMORY_PIXEL_ID) assert.ok(!renderMetaPixelHtml(html, path).includes("facebook.com"));
    else assert.ok(renderMetaPixelHtml(html, path).includes(`tr?id=${pixel}&amp;ev=PageView`));
  }
});

