import { useEffect, useRef, useState } from "react";
import { api } from "../../api/apiClient";

export default function MemoryPurchaserDetails({
  ownerToken,
  initialDetails,
  hasEditedDetails,
  busy,
  message,
  onClose,
  onSubmit,
}) {
  const dialogRef = useRef(null);
  const editedFields = useRef(new Set());
  const [details, setDetails] = useState(() => ({
    name: initialDetails?.name || "",
    email: initialDetails?.email || "",
    phone: initialDetails?.phone || "",
  }));
  const [prefillMessage, setPrefillMessage] = useState("");

  useEffect(() => {
    dialogRef.current.showModal();
    if (hasEditedDetails) return;
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

  function submit(event) {
    event.preventDefault();
    if (busy) return;
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
    onSubmit(purchaser);
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="memory-purchaser-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose(details);
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl bg-white p-6 text-slate-950 shadow-2xl backdrop:bg-slate-950/70 sm:p-8"
    >
      <h2 id="memory-purchaser-title" className="text-2xl font-black">
        Registration details
      </h2>
      <form onSubmit={submit} className="mt-6 space-y-4">
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
            disabled={busy}
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
            disabled={busy}
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
            disabled={busy}
            className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 font-medium"
          />
        </label>
        {(message || prefillMessage) && (
          <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">
            {message || prefillMessage}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-black text-white disabled:opacity-60"
        >
          {busy ? "Opening secure checkout…" : "Continue to Payment — ₹99"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onClose(details)}
          className="w-full rounded-xl px-4 py-2 font-bold text-slate-600 disabled:opacity-60"
        >
          Cancel
        </button>
      </form>
    </dialog>
  );
}
