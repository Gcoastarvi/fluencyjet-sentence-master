import { captureMetaDocument, initializeMetaDocument, restoreMetaDocumentView } from "./metaPixel.js";
import { installFunnelDocumentBoundary, ownsFunnelRoute } from "./funnelDocument.js";
import { trackPageView } from "./tracking.js";
import { memoryConsentGranted } from "./memoryMetaConsent.js";
import { isMemoryRoute } from "./metaPixel.js";

const restoreListeners = new WeakSet();

export function bootMetaDocument(w = window) {
  installFunnelDocumentBoundary(w);
  captureMetaDocument(w);
  if (isMemoryRoute(w.location.pathname) &&
      (!memoryConsentGranted(w) || w.fjMetaConsent === false)) return false;
  if (!restoreListeners.has(w)) {
    restoreListeners.add(w);
    w.addEventListener("pageshow", event => {
      if (event.persisted && ownsFunnelRoute(w.location.pathname, w)) {
        // BFCache skips React mount effects. A restored visit still deserves
        // its coded PageView; never add Lead/Purchase or initialize another ID.
        restoreMetaDocumentView(w);
        trackPageView(w.location.pathname + w.location.search);
      }
    });
  }
  const preview = /^(localhost|127\.0\.0\.1)$/.test(w.location.hostname) ||
    w.location.hostname.endsWith(".replit.dev");
  let optIn = false;
  try { optIn = w.sessionStorage.getItem("fj_meta_qa_opt_in") === "true"; } catch {}
  if (preview && !optIn) return false;
  if (!w.fbq) {
    const queue = function (...args) {
      queue.callMethod ? queue.callMethod(...args) : queue.queue.push(args);
    };
    queue.push = queue;
    queue.loaded = true;
    queue.version = "2.0";
    queue.queue = [];
    w.fbq = queue;
    if (!w._fbq) w._fbq = queue;
    const script = w.document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    w.document.head.appendChild(script);
  }
  // Match old FJ startup timing: init once before React renders, no base
  // PageView/Lead/Purchase. Only the active document's Pixel is registered.
  return initializeMetaDocument(w);
}
