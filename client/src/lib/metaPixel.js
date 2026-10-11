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
  if (state.memory !== isMemoryRoute(w.location.pathname)) return false;
  try { initializePixel(w, state); return true; } catch {
    console.warn("[meta] document initialization failed");
    return false;
  }
}

function privateFieldsRemoved(params) {
  // Memory events never contain purchaser/learner contact details or tokens.
  const forbidden = /name|email|phone|contact|token|password|authorization|score|answer|assessment(detail|result)|learner|student/i;
  if (Array.isArray(params)) return params.map(privateFieldsRemoved);
  if (!params || typeof params !== "object") return params;
  return Object.fromEntries(Object.entries(params)
    .filter(([key]) => key === "content_name" || !forbidden.test(key))
    .map(([key, value]) => [key, privateFieldsRemoved(value)]));
}

export function dispatchMetaEvent(eventName, params = {}, {
  memory = false, custom = false, eventID, once = false, view = false,
} = {}) {
  const w = typeof window === "undefined" ? null : window;
  if (!w || typeof w.fbq !== "function" || w.fjMetaConsent === false) return false;
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
  const viewKey = `${key}:${JSON.stringify(params)}`;
  if (view && state.views.has(viewKey)) return false;
  try {
    initializePixel(w, state);
    const args = [
      custom ? "trackSingleCustom" : "trackSingle", pixelId, eventName,
      memory ? privateFieldsRemoved(params) : params,
    ];
    if (eventID) args.push({ eventID });
    w.fbq(...args);
    if (once && eventID) {
      state.conversions.add(key);
      try { w.localStorage.setItem(`fj_meta_sent:${key}`, "1"); } catch {}
    }
    if (view) state.views.add(viewKey);
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
  if (!dispatchMetaEvent("PageView", {}, { memory })) return false;
  state.lastPageView = key;
  return true;
}

export function trackFjMetaCustom(eventName, params = {}) {
  return dispatchMetaEvent(eventName, params, { custom: true });
}

export async function trackMemoryLead({ assessmentKey, track, form = "A" }) {
  if (!assessmentKey) return false;
  try {
    // Stable across retries/tabs; never send the public/owner token itself.
    const digest = await window.crypto.subtle.digest(
      "SHA-256", new TextEncoder().encode(assessmentKey),
    );
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    return dispatchMetaEvent("Lead", {
      content_name: "Study Memory Assessment Saved",
      funnel: "amaze_memory", track, form,
    }, { memory: true, eventID: `memory_lead_${hash}`, once: true });
  } catch {
    console.warn("[meta] memory Lead identity unavailable; event skipped");
    return false;
  }
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
