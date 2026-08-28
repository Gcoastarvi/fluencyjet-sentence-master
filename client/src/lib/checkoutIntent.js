import { api } from "../api/apiClient";

const CHECKOUT_INTENT_TIMEOUT_MS = 1_500;

export async function recordSentenceMasterCheckoutIntent() {
  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    CHECKOUT_INTENT_TIMEOUT_MS,
  );

  try {
    const response = await api.post(
      "/funnel/checkout-intent",
      { productKey: "sentence_master" },
      { signal: controller.signal },
    );

    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function startSentenceMasterPaymentRedirect(
  paymentUrl,
  delayMilliseconds = 0,
) {
  await recordSentenceMasterCheckoutIntent();

  if (delayMilliseconds > 0) {
    window.setTimeout(() => {
      window.location.href = paymentUrl;
    }, delayMilliseconds);
    return;
  }

  window.location.href = paymentUrl;
}