import { useEffect, useRef, useState } from "react";
import { api } from "../../api/apiClient";
import { readMemoryConsent, memoryConsentGranted, memoryConsentReceipt, isMemoryConsentStorageEvent } from "../../lib/memoryMetaConsent";
import { currentMemoryChoice, grantMemoryCheckoutConsent } from "../../lib/memoryCheckoutConsent";
import { bootMetaDocument } from "../../lib/metaDocument";
import { trackPageView } from "../../lib/tracking";

export default function MemoryPurchaserDetails({
  ownerToken,
  initialDetails,
  hasEditedDetails,
  busy,
  message,
  onClose,
  onSubmit,
  standaloneSchool = false,
  showMeasurementChoiceImmediately = false,
}) {
  const dialogRef = useRef(null);
  const editedFields = useRef(new Set());
  const [details, setDetails] = useState(() => ({
    name: initialDetails?.name || "",
    email: initialDetails?.email || "",
    phone: initialDetails?.phone || "",
  }));
  const [prefillMessage, setPrefillMessage] = useState("");
  const [schoolLevel, setSchoolLevel] = useState(initialDetails?.schoolLevel || "");
  const [consentRecord, setConsentRecord] = useState(() => readMemoryConsent());
  const [reviewPrivacy, setReviewPrivacy] = useState(false);
  const [showMeasurementDetails, setShowMeasurementDetails] = useState(false);
  const [allowMeasurement, setAllowMeasurement] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);
  const submitting = useRef(false);
  const consentDetails = useRef(null);
  const paymentBusy = busy || savingConsent;
  const verifiedGrant = memoryConsentGranted();
  const savedDecline = currentMemoryChoice(consentRecord) && !consentRecord.granted;

  useEffect(() => {
    const refresh = () => {
      setConsentRecord(readMemoryConsent());
      setAllowMeasurement(false);
    };
    const storageChanged = event => {
      if (isMemoryConsentStorageEvent(event)) refresh();
    };
    window.addEventListener("memory-meta-consent", refresh);
    window.addEventListener("storage", storageChanged);
    return () => {
      window.removeEventListener("memory-meta-consent", refresh);
      window.removeEventListener("storage", storageChanged);
    };
  }, []);

  useEffect(() => {
    dialogRef.current.showModal();
    if (hasEditedDetails || !ownerToken) return;
    let active = true;
    api.post("/memory-masterclass/checkout-details", { ownerToken })
      .then((result) => {
        if (!active) return;
        if (!result.ok || !result.data?.details) {
          throw new Error("Saved details unavailable");
        }
        setDetails((current) => Object.fromEntries(
          Object.keys(current).map((field) => [
            field,
            editedFields.current.has(field)
              ? current[field]
              : result.data.details[field] || current[field],
          ]),
        ));
      })
      .catch(() => {
        if (active) {
          setPrefillMessage("Saved details could not be loaded. Please check or enter your details below.");
        }
      });
    return () => { active = false; };
  }, [ownerToken, hasEditedDetails]);

  function updateField(event) {
    const { name, value } = event.target;
    event.target.setCustomValidity("");
    editedFields.current.add(name);
    setDetails((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (paymentBusy || submitting.current) return;
    const purchaser = Object.fromEntries(
      Object.entries(details).map(([field, value]) => [field, value.trim()]),
    );
    if (!purchaser.name || !purchaser.email || !purchaser.phone) return;
    const digitCount = purchaser.phone.replace(/\D/g, "").length;
    if (digitCount < 7 || digitCount > 15) {
      const phoneInput = event.currentTarget.elements.phone;
      phoneInput.setCustomValidity("Enter a phone number with 7–15 digits.");
      phoneInput.reportValidity();
      return;
    }
    if (standaloneSchool && !schoolLevel) return;
    submitting.current = true;
    setSavingConsent(true);
    try {
      // A checked box explicitly confirms adulthood and optional measurement.
      // Already verified grants need no repeat prompt; saved declines are never
      // changed unless the purchaser opens choices and explicitly checks it.
      const receipt = allowMeasurement && (!savedDecline || reviewPrivacy || showMeasurementChoiceImmediately)
        ? await grantMemoryCheckoutConsent({
          adultConfirmed: true, post: (...args) => api.post(...args),
          boot: () => bootMetaDocument(), pageView: path => trackPageView(path),
        })
        : memoryConsentReceipt();
      await onSubmit({
        ...purchaser, ...(standaloneSchool ? { schoolLevel } : {}),
        memoryMetaConsentReceipt: receipt,
      });
    } finally {
      submitting.current = false;
      setSavingConsent(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="memory-purchaser-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!paymentBusy) onClose(standaloneSchool ? { ...details, schoolLevel } : details);
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl bg-white p-6 text-slate-950 shadow-2xl backdrop:bg-slate-950/70 sm:p-8"
    >
      <h2 id="memory-purchaser-title" className="text-2xl font-black">
        Registration details
      </h2>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {standaloneSchool && (
          <label className="block text-sm font-bold" htmlFor="memory-purchaser-class">
            Class
            <select
              id="memory-purchaser-class"
              name="schoolLevel"
              required
              value={schoolLevel}
              onChange={(event) => setSchoolLevel(event.target.value)}
              disabled={paymentBusy}
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 font-medium"
            >
              <option value="">Choose class</option>
              <option value="6-8">Class 6–8</option>
              <option value="9-12">Class 9–12</option>
            </select>
          </label>
        )}
        <label className="block text-sm font-bold" htmlFor="memory-purchaser-name">
          Name
          <input
            id="memory-purchaser-name"
            name="name"
            autoComplete="name"
            autoFocus
            required
            maxLength={100}
            pattern=".*\S.*"
            value={details.name}
            onChange={updateField}
            disabled={paymentBusy}
            className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 font-medium"
          />
        </label>
        <label className="block text-sm font-bold" htmlFor="memory-purchaser-email">
          Email
          <input
            id="memory-purchaser-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={191}
            value={details.email}
            onChange={updateField}
            disabled={paymentBusy}
            className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 font-medium"
          />
        </label>
        <label className="block text-sm font-bold" htmlFor="memory-purchaser-phone">
          Phone
          <input
            id="memory-purchaser-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            maxLength={30}
            pattern="\+?[0-9\s\(\)\-]{7,30}"
            title="Enter a phone number with 7–15 digits, optionally including a country code."
            value={details.phone}
            onChange={updateField}
            disabled={paymentBusy}
            className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 font-medium"
          />
        </label>
        {(message || prefillMessage) && (
          <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">
            {message || prefillMessage}
          </p>
        )}
        <section aria-label="Optional purchaser advertising measurement" className={showMeasurementChoiceImmediately ? "flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-relaxed text-slate-700" : reviewPrivacy ? "rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700" : "text-xs leading-relaxed text-slate-600"}>
          {(reviewPrivacy || showMeasurementChoiceImmediately) && (verifiedGrant ? (
            showMeasurementChoiceImmediately ? (
              <p>Meta ad tracking allowed · <a href="/memory-challenge" target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2 focus-visible:outline focus-visible:outline-2">Change / withdraw</a></p>
            ) : (
            <p>Optional Meta measurement is allowed. You can change or withdraw it through <a href="/memory-challenge" target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2 focus-visible:outline focus-visible:outline-2">Privacy choices on the Memory Challenge page (opens in a new tab)</a>.</p>
            )
          ) : (
            <label className={showMeasurementChoiceImmediately ? "inline-flex items-center gap-1.5" : "flex items-start gap-2"} htmlFor="memory-purchaser-measurement">
              <input id="memory-purchaser-measurement" type="checkbox"
                checked={allowMeasurement} disabled={paymentBusy}
                onChange={event => setAllowMeasurement(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{showMeasurementChoiceImmediately ? "I'm 18+ · Allow Meta ad tracking." : "I am the purchaser, aged 18 or older, and I allow optional Meta ad measurement using my adult purchaser details. Booking works without this."}</span>
            </label>
          ))}
          {!showMeasurementChoiceImmediately && (
          <button type="button" disabled={paymentBusy} aria-controls="memory-purchaser-privacy" aria-expanded={reviewPrivacy}
            onClick={() => {
              setReviewPrivacy(true);
              consentDetails.current.open = true;
              consentDetails.current.querySelector("summary")?.focus();
            }}
            className="rounded underline underline-offset-2 focus-visible:outline focus-visible:outline-2">
            Privacy choices
          </button>
          )}
          {showMeasurementChoiceImmediately && !verifiedGrant && (
            <button type="button" disabled={paymentBusy}
              aria-controls="memory-purchaser-privacy"
              aria-expanded={showMeasurementDetails}
              onClick={() => {
                setShowMeasurementDetails(true);
                consentDetails.current.open = true;
                consentDetails.current.querySelector("summary")?.focus();
              }}
              className="rounded font-medium underline underline-offset-2 focus-visible:outline focus-visible:outline-2">
              Details
            </button>
          )}
          <details ref={consentDetails} id="memory-purchaser-privacy" className={reviewPrivacy || showMeasurementDetails ? "mt-2 w-full" : "hidden"}>
            <summary className="cursor-pointer rounded underline focus-visible:outline focus-visible:outline-2">What is shared?</summary>
            <p className="mt-2">BrainoDad shares limited browser and consenting adult purchaser details with Meta to measure ads. No student names, scores or answers are shared. Your choice lasts up to 30 days. You can change or withdraw it through <a href="/memory-challenge" target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2 focus-visible:outline focus-visible:outline-2">Privacy choices on the Memory Challenge page (opens in a new tab)</a>. This is separate from WhatsApp consent.</p>
          </details>
        </section>
        <button
          type="submit"
          disabled={paymentBusy}
          className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-black text-white disabled:opacity-60"
        >
          {paymentBusy ? "Opening secure checkout…" : "Continue to Payment — ₹99"}
        </button>
        <button
          type="button"
          disabled={paymentBusy}
          onClick={() => onClose(standaloneSchool ? { ...details, schoolLevel } : details)}
          className="w-full rounded-xl px-4 py-2 font-bold text-slate-600 disabled:opacity-60"
        >
          Cancel
        </button>
      </form>
    </dialog>
  );
}
