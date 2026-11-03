import { memoryBrowserRouteEligible, MEMORY_BROWSER_EVENTS, memoryCommercialParams } from "./memoryBrowserPolicy.js";
import { memoryConsentGranted } from "./memoryMetaConsent.js";
export const FJ_PIXEL_ID = "1246171816816642";
export const MEMORY_PIXEL_ID = "1998316064175555";

// Retest pages nested under memory-challenge are covered too. These prefixes
// must match server/config/metaTracking.js for the no-JavaScript fallback.
export const MEMORY_ROUTE_PREFIXES = [
  "/memory-challenge", "/memory-masterclass", "/memory-retest", "/memory-products",
];

export function isMemoryRoute(path = "") {
  let pathname = String(path).split(/[?#]/)[0];
  try { pathname = decodeURIComponent(pathname); } catch {}
  // React Router matches static route names case-insensitively and decodes
  // encoded paths. The tracking boundary must agree with the rendered route.
  pathname = pathname.toLowerCase();
  return MEMORY_ROUTE_PREFIXES.some(prefix =>
    pathname === prefix || pathname.startsWith(`${prefix}/`));
}

const states = new WeakMap();
function stateFor(w) {
  if (!states.has(w)) states.set(w, {
    initialized: new Set(), conversions: new Set(), views: new Set(),
    route: null, lastPageView: null, memory: isMemoryRoute(w.location.pathname),
  });
  const state = states.get(w);
  const route = w.location.pathname + w.location.search;
  if (state.route !== route) {
    state.route = route;
    state.views.clear();
  }
  return state;
}

function initializePixel(w, state) {
  const pixelId = state.memory ? MEMORY_PIXEL_ID : FJ_PIXEL_ID;
  if (!state.initialized.has(pixelId)) {
    // Memory is manually instrumented. FJ metadata/matching remain controlled
    // by its existing account settings; do not override FJ autoConfig.
    if (state.memory) w.fbq("set", "autoConfig", false, pixelId);
    w.fbq("init", pixelId);
    state.initialized.add(pixelId);
  }
}

export function captureMetaDocument(w = window) {
  stateFor(w);
}

export function restoreMetaDocumentView(w = window) {
  const state = stateFor(w);
  state.lastPageView = null;
  state.views.clear();
}

export function initializeMetaDocument(w = window) {
  if (typeof w.fbq !== "function" || w.fjMetaConsent === false) return false;
  const state = stateFor(w);
  if (state.memory && (!memoryConsentGranted(w) || !memoryBrowserRouteEligible(w.location))) return false;
  if (state.memory !== isMemoryRoute(w.location.pathname)) return false;
  try { initializePixel(w, state); return true; } catch {
    console.warn("[meta] document initialization failed");
    return false;
  }
}

export function dispatchMetaEvent(eventName, params = {}, {
  memory = false, custom = false, eventID, once = false, view = false,
} = {}) {
  const w = typeof window === "undefined" ? null : window;
  if (!w || typeof w.fbq !== "function" || w.fjMetaConsent === false) return false;
  if (memory && (!memoryConsentGranted(w) || !memoryBrowserRouteEligible(w.location) ||
      !MEMORY_BROWSER_EVENTS.has(eventName))) return false;
  // Explicit funnel identity also rejects stale callbacks from an unmounted
  // English page on a memory URL (and vice versa).
  if (isMemoryRoute(w.location.pathname) !== memory) return false;
  const pixelId = memory ? MEMORY_PIXEL_ID : FJ_PIXEL_ID;
  const state = stateFor(w);
  if (state.memory !== memory) return false;
  const key = `${pixelId}:${eventName}:${eventID || ""}`;
  if (once && eventID) {
    if (state.conversions.has(key)) return false;
    try { if (w.localStorage.getItem(`fj_meta_sent:${key}`)) return false; } catch {}
  }
  const cleanParams = memory ? memoryCommercialParams(params) : params;
  const viewKey = `${key}:${JSON.stringify(cleanParams)}`;
  const sessionKey = `memory_meta_view:${w.location.pathname}:${viewKey}`;
  if (memory && view) {
    try { if (Date.now() - Number(w.sessionStorage?.getItem(sessionKey)) < 1800000) return false; } catch {}
  }
  // Suppress rapid duplicate CTA callbacks without blocking later real clicks.
  const clickKey = `${key}:${JSON.stringify(cleanParams)}`;
  if (memory && /(_click|_selected)$/.test(eventName)) {
    if (state.lastClick?.key === clickKey && Date.now() - state.lastClick.at < 1500) return false;
  }
  if (view && state.views.has(viewKey)) return false;
  try {
    initializePixel(w, state);
    const args = [
      custom ? "trackSingleCustom" : "trackSingle", pixelId, eventName,
      cleanParams,
    ];
    if (eventID) args.push({ eventID });
    w.fbq(...args);
    if (once && eventID) {
      state.conversions.add(key);
      try { w.localStorage.setItem(`fj_meta_sent:${key}`, "1"); } catch {}
    }
    if (view) {
      state.views.add(viewKey);
      if (memory) { try { w.sessionStorage?.setItem(sessionKey, String(Date.now())); } catch {} }
    }
    if (memory && /(_click|_selected)$/.test(eventName)) state.lastClick = { key: clickKey, at: Date.now() };
    return true;
  } catch {
    // Tracking must never prevent registration or payment.
    console.warn("[meta] event dispatch failed", eventName);
    return false;
  }
}

export function dispatchMetaPageView(path) {
  const w = typeof window === "undefined" ? null : window;
  if (!w) return false;
  const memory = isMemoryRoute(path);
  // Keep existing English query-string views; memory query-only changes do
  // not represent a new step or conversion.
  const key = memory ? String(path).split(/[?#]/)[0] : path;
  const state = stateFor(w);
  // Keep prior manually coded FJ PageView semantics, including repeated calls.
  // Only memory applies the new duplicate/query-only suppression.
  if (memory && state.lastPageView === key) return false;
  if (!dispatchMetaEvent("PageView", {}, { memory, view: memory })) return false;
  state.lastPageView = key;
  return true;
}

export function trackFjMetaCustom(eventName, params = {}) {
  return dispatchMetaEvent(eventName, params, { custom: true });
}

export async function trackMemoryLead() {
  // Assessment-derived IDs (even hashed) are student identifiers. Never send.
  return false;
}

export function trackMemoryCheckout({ orderId, amount, currency, track, source }) {
  if (typeof orderId !== "string" || !orderId || amount !== 9900 || currency !== "INR") return false;
  return dispatchMetaEvent("InitiateCheckout", {
    content_name: "Amaze Memory Live Study Memory Class",
    content_ids: ["memory_masterclass_99"], content_type: "product",
    value: 99, currency: "INR", num_items: 1, track, source,
  }, { memory: true, eventID: `memory_checkout_${orderId}`, once: true });
}

// Reserved for future VERIFIED browser/server pairing. No thank-you page
// invokes this or sends Purchase based on URL parameters.
export function memoryPurchaseEventId(paymentId, productKey = "memory_masterclass_99") {
  return `${productKey}_purchase_${paymentId}`;
}

export function setMetaConsent(granted) {
  if (typeof window === "undefined") return;
  window.fjMetaConsent = granted === true;
  try { window.fbq?.("consent", granted === true ? "grant" : "revoke"); } catch {
    console.warn("[meta] SDK consent update failed; local consent gate remains active");
  }
}

