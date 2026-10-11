export const MEMORY_CONSENT_KEY = "brainodad_meta_consent_v1";
export const MEMORY_CONSENT_VERSION = "memory_meta_v1";
export function readMemoryConsent(w = window) {
  try { return JSON.parse(w.localStorage.getItem(MEMORY_CONSENT_KEY) || "null"); } catch { return null; }
}
export function memoryConsentGranted(w = window) {
  const record = readMemoryConsent(w);
  return w.memoryMetaConsentVerified === true && record?.granted === true &&
    record.version === MEMORY_CONSENT_VERSION && new Date(record.expiresAt).getTime() > Date.now();
}
export function memoryConsentReceipt(w = window) {
  return memoryConsentGranted(w) ? readMemoryConsent(w)?.receipt || null : null;
}
export function saveMemoryConsent(record, w = window) {
  w.memoryMetaConsentVerified = record?.granted === true;
  try { w.localStorage.setItem(MEMORY_CONSENT_KEY, JSON.stringify(record)); } catch {}
  w.dispatchEvent(new Event("memory-meta-consent"));
}
