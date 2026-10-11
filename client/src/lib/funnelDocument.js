import { isMemoryRoute } from "./metaPixel.js";

const documents = new WeakMap();
const HANDOFF_KEY = "fj_funnel_navigation";
const HANDOFF_TTL = 30_000;

// Install before React/Meta. Browser documents have an immutable funnel owner.
// History interception handles Link, navigate(), Navigate and direct history
// calls. Native anchors/location navigation already create fresh documents.
export function installFunnelDocumentBoundary(w = window) {
  if (documents.has(w)) return documents.get(w);
  const nativeReplace = w.history.replaceState.bind(w.history);
  const nativePush = w.history.pushState.bind(w.history);
  const memory = isMemoryRoute(w.location.pathname);
  const entry = { memory, pending: false };
  documents.set(w, entry);
  let policyNode, previousPolicy, addedPolicy = false;
  const protectReferrer = () => {
    if (!w.document?.head || policyNode) return;
    policyNode = w.document.querySelector?.('meta[name="referrer"]');
    if (policyNode) previousPolicy = policyNode.content;
    else {
      policyNode = w.document.createElement("meta");
      policyNode.name = "referrer";
      addedPolicy = true;
      w.document.head.appendChild(policyNode);
    }
    policyNode.content = "no-referrer";
  };
  // Memory's assessment/payment URLs must never become FJ SDK referrer data,
  // including native links, new tabs and location-based payment redirects.
  if (memory) protectReferrer();
  w.addEventListener("click", event => {
    const anchor = event.target?.closest?.("a[href]");
    if (!anchor) return;
    const target = new URL(anchor.href, w.location.href);
    if (target.origin === w.location.origin && isMemoryRoute(target.pathname) !== memory) {
      // Do not intercept/prevent clicks: modifiers, targets, user cancellation
      // and native navigation keep their existing browser/Router semantics.
      anchor.referrerPolicy = "no-referrer";
    }
  }, true);

  // Preserve React Router's return-to/auth state, without adding anything to
  // URLs or sending state to a provider. Existing app state is JSON-shaped.
  try {
    const raw = w.sessionStorage.getItem(HANDOFF_KEY);
    if (raw) {
      w.sessionStorage.removeItem(HANDOFF_KEY);
      const handoff = JSON.parse(raw);
      if (handoff.href === w.location.href &&
          Date.now() - handoff.createdAt >= 0 &&
          Date.now() - handoff.createdAt < HANDOFF_TTL) {
        nativeReplace(handoff.state, "", w.location.href);
      }
    }
  } catch {
    // Ordinary navigation needs no handoff; existing cookies/storage survive.
  }

  entry.navigate = (href, { replace = false, state } = {}) => {
    const target = new URL(href, w.location.href);
    if (target.origin !== w.location.origin) return false;
    if (entry.pending) return true;
    try { w.sessionStorage.removeItem(HANDOFF_KEY); } catch {}
    if (state?.usr != null) {
      // Do not silently lose a meaningful auth/return state if storage fails.
      // DataCloneError is also propagated by React Router's history adapter.
      try {
        w.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({
          href: target.href, state, createdAt: Date.now(),
        }));
      } catch {
        throw new DOMException("Cannot preserve navigation state across funnels", "DataCloneError");
      }
    }
    protectReferrer();
    entry.pending = true;
    w.location[replace ? "replace" : "assign"](target.href);
    return true;
  };

  for (const [method, native] of [["pushState", nativePush], ["replaceState", nativeReplace]]) {
    w.history[method] = (state, unused, url) => {
      if (url != null) {
        const target = new URL(url, w.location.href);
        // Cross-origin/invalid state still follows the browser's native errors.
        if (target.origin === w.location.origin &&
            isMemoryRoute(target.pathname) !== memory) {
          entry.navigate(target.href, { replace: method === "replaceState", state });
          return;
        }
      }
      return native(state, unused, url);
    };
  }

  const recoverForeignEntry = event => {
    if (isMemoryRoute(w.location.pathname) === memory) {
      if (event.type === "pageshow") {
        // A cached document can navigate again after back/forward restoration.
        entry.pending = false;
        if (!memory && policyNode) {
          if (addedPolicy) policyNode.remove?.();
          else policyNode.content = previousPolicy;
          policyNode = undefined;
          addedPolicy = false;
        }
      }
      return;
    }
    // Normally cross-funnel entries already belong to different documents.
    // Defend against older same-document entries and BFCache restoration too,
    // before Router/SDK popstate listeners can render or track the other funnel.
    event.stopImmediatePropagation();
    entry.pending = false;
    entry.navigate(w.location.href, { replace: true, state: w.history.state });
  };
  w.addEventListener("popstate", recoverForeignEntry, true);
  w.addEventListener("pageshow", recoverForeignEntry, true);
  return entry;
}

export function ownsFunnelRoute(path, w = window) {
  const entry = documents.get(w);
  return !!entry && entry.memory === isMemoryRoute(path);
}

export function navigateFreshDocument(href, w = window) {
  return installFunnelDocumentBoundary(w).navigate(href, { replace: true });
}
