import { useRef, useState } from "react";
import { api } from "../../api/apiClient";
import { buildMemoryCheckoutAttribution, loadRazorpayCheckout } from "./MemoryMasterclassOffer";
import MemoryPurchaserDetails from "./MemoryPurchaserDetails";
import { trackEvent } from "../../lib/tracking";

export default function MemoryStandaloneCheckout({ audience, event, children }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [details, setDetails] = useState(null);
  const checkoutLock = useRef(false);
  const trigger = useRef(null);

  function openCheckout() {
    if (!event || checkoutLock.current) return;
    trigger.current = document.activeElement;
    setMessage("");
    setDialogOpen(true);
  }

  function restoreFocus() {
    requestAnimationFrame(() => trigger.current?.focus());
  }

  async function submit(purchaser) {
    if (checkoutLock.current || !event) return;
    checkoutLock.current = true;
    setBusy(true);
    setDetails(purchaser);
    setMessage("");
    try {
      const attribution = buildMemoryCheckoutAttribution();
      const response = await api.post("/memory-masterclass/standalone/create-order", {
        ...attribution,
        audience,
        ...(audience === "school" ? { schoolLevel: purchaser.schoolLevel } : {}),
        purchaserName: purchaser.name,
        purchaserEmail: purchaser.email,
        purchaserPhone: purchaser.phone,
      });
      if (!response.ok || !response.data?.orderId) {
        throw new Error(response.error || "Unable to start secure checkout.");
      }
      await loadRazorpayCheckout();
      const order = response.data;
      const checkout = new window.Razorpay({
        key: order.keyId, order_id: order.orderId,
        amount: order.amount, currency: order.currency,
        name: "Amaze Memory",
        description: `Live Study Memory Class — ${event.dateLabel}, ${event.startTime} ${event.timezoneLabel}`,
        prefill: { name: purchaser.name, email: purchaser.email, contact: purchaser.phone },
        handler(payment) {
          const query = new URLSearchParams({ source: "standalone_vsl" });
          if (payment.razorpay_payment_id) query.set("razorpay_payment_id", payment.razorpay_payment_id);
          if (payment.razorpay_order_id) query.set("razorpay_order_id", payment.razorpay_order_id);
          window.location.href = `/memory-masterclass/thank-you?${query}`;
        },
        modal: {
          ondismiss() {
            checkoutLock.current = false;
            setBusy(false);
            restoreFocus();
          },
        },
        theme: { color: "#4f46e5" },
      });
      checkout.on("payment.failed", () => {
        setMessage("Payment was not completed. You can retry in secure checkout.");
      });
      setDialogOpen(false);
      checkout.open();
      trackEvent("memory_checkout_open", {
        funnel: "amaze_memory", source: "standalone_vsl", audience,
        track: audience === "advanced" ? "advanced" :
          purchaser.schoolLevel === "6-8" ? "school_foundation" : "school_advanced",
        event_date: event.dateISO, price: 99,
      });
    } catch (error) {
      checkoutLock.current = false;
      setBusy(false);
      setDialogOpen(true);
      setMessage(error.message || "Unable to open secure checkout. Please try again.");
    }
  }

  return (
    <>
      {children({ openCheckout, busy, dialogOpen })}
      {dialogOpen && (
        <MemoryPurchaserDetails
          initialDetails={details}
          hasEditedDetails={Boolean(details)}
          standaloneSchool={audience === "school"}
          busy={busy}
          message={message}
          onSubmit={submit}
          onClose={(current) => {
            setDetails({ ...details, ...current });
            setDialogOpen(false);
            restoreFocus();
          }}
        />
      )}
      {!dialogOpen && !busy && message && <p role="alert" className="p-4 text-center text-amber-800">{message}</p>}
    </>
  );
}
