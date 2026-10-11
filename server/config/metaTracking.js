export const FJ_PIXEL_ID = "1246171816816642";
export const MEMORY_PIXEL_ID = "1998316064175555";
// Explicit server-owned versions; upgrading Memory must not migrate FJ.
export const FJ_CAPI_VERSION = "v19.0";
export const MEMORY_CAPI_VERSION = "v26.0";
export const MEMORY_ROUTE_PREFIXES = [
  "/memory-challenge", "/memory-masterclass", "/memory-retest", "/memory-products",
];

export function isMemoryRoute(path = "") {
  let pathname = String(path).split(/[?#]/)[0];
  try { pathname = decodeURIComponent(pathname); } catch {}
  pathname = pathname.toLowerCase();
  return MEMORY_ROUTE_PREFIXES.some(prefix =>
    pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function renderMetaPixelHtml(html, path) {
  const pixelId = isMemoryRoute(path) ? MEMORY_PIXEL_ID : FJ_PIXEL_ID;
  return html.replace("<!-- META_PIXEL_NOSCRIPT -->",
    `<noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${pixelId}&amp;ev=PageView&amp;noscript=1" /></noscript>`);
}

// Call with a server-derived product key, never a browser-supplied selector.
// Future memory products share this fail-closed destination boundary.
export function getCapiDestination(productKey, env = process.env) {
  if (typeof productKey === "string" && productKey.startsWith("memory_")) {
    if (env.MEMORY_META_PIXEL_ID && env.MEMORY_META_PIXEL_ID !== MEMORY_PIXEL_ID) {
      return { enabled: false, reason: "memory_pixel_mismatch" };
    }
    if (typeof env.MEMORY_META_CAPI_ACCESS_TOKEN !== "string" ||
        !env.MEMORY_META_CAPI_ACCESS_TOKEN.trim()) {
      return { enabled: false, reason: "memory_capi_token_missing" };
    }
    return {
      enabled: true, pixelId: MEMORY_PIXEL_ID,
      apiVersion: MEMORY_CAPI_VERSION,
      accessToken: env.MEMORY_META_CAPI_ACCESS_TOKEN,
      testEventCode: env.MEMORY_META_TEST_EVENT_CODE || null,
    };
  }
  return {
    enabled: Boolean(env.META_PIXEL_ID && env.META_CAPI_ACCESS_TOKEN),
    apiVersion: FJ_CAPI_VERSION,
    pixelId: env.META_PIXEL_ID, accessToken: env.META_CAPI_ACCESS_TOKEN,
    testEventCode: env.META_TEST_EVENT_CODE || null,
  };
}
