// client/src/lib/track.js
export function track(name, props = {}) {
  try {
    const payload = {
      name,
      props,
      ts: Date.now(),
      path: window.location?.pathname || "",
      qs: window.location?.search || "",
    };

    // MVP-lite: DEV console only (no backend dependency)
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log("[track]", payload);
    }

    // Later: replace with a POST, e.g.
    // navigator.sendBeacon("/api/events", JSON.stringify(payload));
  } catch {
    // never break UX
  }
}
