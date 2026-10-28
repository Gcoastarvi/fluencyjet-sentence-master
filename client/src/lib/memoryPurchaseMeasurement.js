const TOKENS = "brainodad_purchase_measurement_tokens_v1";
const REFUSED = "brainodad_purchase_measurement_refused_v1";
export function purchaseMeasurementRefused(w = window) {
  try { return w.localStorage.getItem(REFUSED) === "true" || w.navigator?.globalPrivacyControl === true; }
  catch { return true; }
}
export function rememberPurchaseAuthorization(token, w = window) {
  if (!/^[a-f0-9]{64}$/.test(token || "")) return false;
  try {
    const tokens = JSON.parse(w.localStorage.getItem(TOKENS) || "[]");
    w.localStorage.setItem(TOKENS, JSON.stringify([...new Set([...tokens, token])]));
    return true;
  } catch { return false; }
}
export async function refusePurchaseMeasurement(post, w = window) {
  let tokens = [];
  try {
    w.localStorage.setItem(REFUSED, "true");
    tokens = JSON.parse(w.localStorage.getItem(TOKENS) || "[]");
  } catch { throw new Error("Your purchase choice could not be stored. Please retry or contact support."); }
  const results = await Promise.allSettled(tokens.map(token => post("/memory-meta/purchase-authorization/withdraw", { token })));
  if (results.some(r => r.status !== "fulfilled" || !r.value?.ok || !r.value?.data?.ok))
    throw new Error("Purchase withdrawal is pending. Please retry or contact support; it is not yet confirmed on the server.");
  return true;
}
