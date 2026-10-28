import { readMemoryConsent, saveMemoryConsent, MEMORY_CONSENT_VERSION } from "./memoryMetaConsent.js";
const REFUSED = "brainodad_purchase_measurement_refused_v1";
export function purchaseMeasurementRefused(w = window) {
  try { return w.localStorage.getItem(REFUSED) === "true" || w.navigator?.globalPrivacyControl === true; }
  catch { return true; }
}
export async function refusePurchaseMeasurement(post, w = window) {
  const stored = readMemoryConsent(w);
  w.memoryMetaConsentVerified = false;
  w.fbq?.("consent", "revoke");
  try { w.localStorage.setItem(REFUSED, "true"); }
  catch { throw new Error("Your purchase choice could not be stored. Please retry or contact support."); }
  saveMemoryConsent({ ...stored, granted: false }, w);
  const response = await post("/memory-meta/consent", { receipt: stored?.receipt, granted: false });
  const next = response?.data;
  if (!response?.ok || !next?.ok || next.granted !== false || next.version !== MEMORY_CONSENT_VERSION ||
      !/^[a-f0-9]{64}$/.test(next.receipt || "") || !(new Date(next.expiresAt) > new Date()))
    throw new Error("Withdrawal is pending. Please retry or contact support; it is not yet confirmed on the server.");
  saveMemoryConsent(next, w);
  return true;
}
