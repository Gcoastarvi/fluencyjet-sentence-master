// Only adult-facing marketing surfaces may use a verified adult receipt.
// A parent's remembered choice does not authorize student assessment telemetry.
export function memoryBrowserRouteEligible(location) {
  let path;
  try { path = decodeURIComponent(location.pathname).toLowerCase().replace(/\/$/, ""); }
  catch { return false; }
  if (![
    "/memory-masterclass/parents",
    "/memory-challenge/video/school",
    "/memory-challenge/video/advanced",
  ].includes(path)) return false;
  if (location.hash && !["#top", "#choose-grade", "#booking"].includes(location.hash)) return false;
  // Pixel includes the document URL itself. Do not expose private URL fields.
  const query = new URLSearchParams(location.search || "");
  return [...query.keys()].every(key => /^(utm_(source|medium|campaign|content|term)|fbclid)$/.test(key));
}

export const MEMORY_BROWSER_EVENTS = new Set([
  "PageView", "memory_offer_click", "memory_track_selected",
  "memory_offer_view", "memory_checkout_open", "InitiateCheckout",
]);

// Fixed commercial metadata only; no grade, assessment identity or free text.
export function memoryCommercialParams(params = {}) {
  const clean = {};
  if (params.funnel === "amaze_memory") clean.funnel = params.funnel;
  if (["standalone_vsl", "memory_masterclass_parents"].includes(params.source)) clean.source = params.source;
  if (params.price === 99) clean.price = 99;
  if (params.value === 99) clean.value = 99;
  if (params.currency === "INR") clean.currency = "INR";
  if (params.num_items === 1) clean.num_items = 1;
  if (params.content_type === "product") clean.content_type = "product";
  if (Array.isArray(params.content_ids) && params.content_ids.length === 1 &&
      params.content_ids[0] === "memory_masterclass_99") clean.content_ids = ["memory_masterclass_99"];
  if (params.content_name === "Amaze Memory Live Study Memory Class") clean.content_name = params.content_name;
  return clean;
}
