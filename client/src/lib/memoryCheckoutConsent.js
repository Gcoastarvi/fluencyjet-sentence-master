import {
  MEMORY_CONSENT_VERSION, readMemoryConsent, saveMemoryConsent,
  memoryConsentReceipt, isMemoryConsentStorageEvent,
} from "./memoryMetaConsent.js";

export function currentMemoryChoice(record) {
  return Boolean(record?.receipt) && record.version === MEMORY_CONSENT_VERSION &&
    typeof record.granted === "boolean" && new Date(record.expiresAt).getTime() > Date.now();
}

// A failed optional choice must never prevent payment, or attach an unverified
// receipt. The caller submits only the returned receipt, not a later reread.
export async function grantMemoryCheckoutConsent({
  adultConfirmed = false, post, w = window,
  boot = () => false, pageView = () => {},
  timeoutMs = 8000,
} = {}) {
  if (adultConfirmed !== true) return null;
  const stored = readMemoryConsent(w);
  const snapshot = JSON.stringify(stored);
  let changed = false;
  const storageChanged = event => {
    if (isMemoryConsentStorageEvent(event, w)) changed = true;
  };
  const choiceChanged = () => { changed = true; };
  w.addEventListener("storage", storageChanged);
  w.addEventListener("memory-meta-consent", choiceChanged);
  w.memoryMetaConsentVerified = false;
  const controller = new AbortController();
  let timer;
  try {
    w.fbq?.("consent", "revoke");
    const response = await Promise.race([
      post("/memory-meta/consent", {
        receipt: stored?.receipt, granted: true, adultConfirmed: true,
      }, { signal: controller.signal }),
      new Promise(resolve => {
        timer = setTimeout(() => { controller.abort(); resolve({ ok: false }); }, timeoutMs);
      }),
    ]);
    if (changed || JSON.stringify(readMemoryConsent(w)) !== snapshot ||
        !response.ok || !response.data?.ok || response.data.granted !== true ||
        !currentMemoryChoice(response.data) ||
        !/^[a-f0-9]{64}$/.test(response.data.receipt)) return null;
    // Remove our fence before publishing our own verified choice.
    w.removeEventListener("memory-meta-consent", choiceChanged);
    saveMemoryConsent(response.data, w);
    if (boot()) {
      w.fbq?.("consent", "grant");
      // Current route only; existing visit dedup suppresses repeated PageViews.
      pageView(w.location.pathname + w.location.search);
    }
    return memoryConsentReceipt(w);
  } catch {
    if (!changed) w.memoryMetaConsentVerified = false;
    return null;
  } finally {
    clearTimeout(timer);
    w.removeEventListener("storage", storageChanged);
    w.removeEventListener("memory-meta-consent", choiceChanged);
  }
}
