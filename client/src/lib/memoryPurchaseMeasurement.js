import { readMemoryConsent, saveMemoryConsent, MEMORY_CONSENT_VERSION } from "./memoryMetaConsent.js";
const CHOICES = "brainodad_purchase_choices_v1";
const REFUSED = "brainodad_purchase_measurement_refused_v1";
export function purchaseMeasurementRefused(w = window) {
  try { return w.localStorage.getItem(REFUSED) === "true" || w.navigator?.globalPrivacyControl === true; }
  catch { return true; }
}
export function rememberPurchaseChoice(choice,w=window) {
  if(!choice?.orderId || !/^[a-f0-9]{64}$/.test(choice.token || "")) return false;
  try {
    const choices=JSON.parse(w.localStorage.getItem(CHOICES) || "[]");
    w.localStorage.setItem(CHOICES,JSON.stringify([...choices.filter(c=>c.orderId!==choice.orderId),choice]));
    return true;
  } catch{return false;}
}
export async function refusePurchaseMeasurement(post, w = window) {
  const stored = readMemoryConsent(w);
  w.memoryMetaConsentVerified = false;
  w.fbq?.("consent", "revoke");
  try { w.localStorage.setItem(REFUSED, "true"); }
  catch { throw new Error("Your purchase choice could not be stored. Please retry or contact support."); }
  saveMemoryConsent({ ...stored, granted: false }, w);
  let choices;
  try { choices=JSON.parse(w.localStorage.getItem(CHOICES) || "[]"); } catch {throw new Error("Withdrawal is pending; stored choices unavailable.");}
  const withdrawals=await Promise.allSettled(choices.map(c=>post("/memory-meta/purchase-choice",{...c,action:"withdraw"})));
  const response = await post("/memory-meta/consent", { receipt: stored?.receipt, granted: false });
  const next = response?.data;
  if (!response?.ok || !next?.ok || next.granted !== false || next.version !== MEMORY_CONSENT_VERSION ||
      !/^[a-f0-9]{64}$/.test(next.receipt || "") || !(new Date(next.expiresAt) > new Date()))
    throw new Error("Withdrawal is pending. Please retry or contact support; it is not yet confirmed on the server.");
  saveMemoryConsent(next, w);
  if(withdrawals.some(r=>r.status!=="fulfilled" || !r.value?.ok || !r.value?.data?.ok))
    throw new Error("Purchase withdrawal is pending. Please retry or contact support; it is not yet confirmed on the server.");
  return true;
}

// Measurement availability must never hold Razorpay opening indefinitely.
export async function measurementPost(post,path,body,{timeoutMs=2000}={}) {
  const controller=new AbortController();let timer;
  try {
    return await Promise.race([post(path,body,{signal:controller.signal}),new Promise((_,reject)=>{
      timer=setTimeout(()=>{controller.abort();reject(new Error("MEASUREMENT_TIMEOUT"));},timeoutMs);
    })]);
  }finally{clearTimeout(timer);}
}
