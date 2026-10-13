import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../../api/apiClient";
import { isMemoryRoute } from "../../lib/metaPixel";
import { bootMetaDocument } from "../../lib/metaDocument";
import { trackPageView } from "../../lib/tracking";
import { MEMORY_CONSENT_VERSION, readMemoryConsent, saveMemoryConsent, memoryConsentGranted, isMemoryConsentStorageEvent } from "../../lib/memoryMetaConsent";

function hasCurrentChoice(record) {
  return Boolean(record?.receipt) && record.version === MEMORY_CONSENT_VERSION &&
    typeof record.granted === "boolean" && new Date(record.expiresAt).getTime() > Date.now();
}

export default function MemoryMetaConsent() {
  const { pathname } = useLocation();
  const memory = isMemoryRoute(pathname);
  const [record, setRecord] = useState(() => readMemoryConsent());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const reviewButton = useRef(null);
  const summary = useRef(null);
  const requestVersion = useRef(0);
  const closeChoices = () => {
    setExpanded(false);
    window.requestAnimationFrame(() => reviewButton.current?.focus());
  };
  const openChoices = () => {
    setExpanded(true);
    window.requestAnimationFrame(() => summary.current?.focus());
  };
  const activate = next => {
    const wasGranted = memoryConsentGranted();
    saveMemoryConsent(next); setRecord(next);
    if (next?.granted && !wasGranted) {
      if (bootMetaDocument()) {
        window.fbq?.("consent", "grant");
        // RouteTracker owns visit deduplication. Revalidation is not a new visit.
        trackPageView(window.location.pathname + window.location.search);
      }
    } else if (!next?.granted) window.fbq?.("consent", "revoke");
  };
  useEffect(() => {
    if (!memory) return;
    let mounted = true;
    async function validate(stored) {
      const version = ++requestVersion.current;
      window.memoryMetaConsentVerified = false;
      if (!hasCurrentChoice(stored) || !stored.granted) window.fbq?.("consent", "revoke");
      if (!stored?.receipt) return;
      const current = () => mounted && version === requestVersion.current &&
        JSON.stringify(readMemoryConsent()) === JSON.stringify(stored);
      try {
        const response = stored.granted
          ? await api.post("/memory-meta/consent/status", { receipt: stored.receipt })
          : await api.post("/memory-meta/consent", { receipt: stored.receipt, granted: false });
        if (!current()) return;
        if (!response.ok || !response.data?.ok) {
          // An outage is not a user's withdrawal. Keep the receipt but deny tracking.
          setError("Your privacy choice could not be verified. Meta measurement stays off. Please try again.");
          return;
        }
        activate({ ...stored, granted: hasCurrentChoice(stored) && stored.granted &&
          response.data.granted === true });
        setError("");
      } catch {
        if (current()) setError("Your privacy choice could not be verified. Meta measurement stays off. Please try again.");
      }
    }
    void validate(readMemoryConsent());
    const storageChanged = event => {
      if (!isMemoryConsentStorageEvent(event, window)) return;
      const next = readMemoryConsent();
      setRecord(next);
      setExpanded(false);
      setBusy(false);
      void validate(next);
    };
    // Checkout publishes only a server-confirmed choice. Keep footer controls
    // synchronized without launching a second grant or resetting verification.
    const localChoiceChanged = () => {
      setRecord(readMemoryConsent());
      setError("");
    };
    window.addEventListener("storage", storageChanged);
    window.addEventListener("memory-meta-consent", localChoiceChanged);
    return () => {
      mounted = false;
      ++requestVersion.current;
      window.removeEventListener("storage", storageChanged);
      window.removeEventListener("memory-meta-consent", localChoiceChanged);
    };
  }, [memory]);
  async function choose(granted) {
    const version = ++requestVersion.current;
    setBusy(true); setError("");
    window.memoryMetaConsentVerified = false;
    // Withdrawal is immediate locally even if the server temporarily fails.
    if (!granted) activate({ ...readMemoryConsent(), granted: false });
    const stored = readMemoryConsent();
    const current = () => version === requestVersion.current &&
      JSON.stringify(readMemoryConsent()) === JSON.stringify(stored);
    try {
      const response = await api.post("/memory-meta/consent", {
        receipt: stored?.receipt, granted, adultConfirmed: granted,
      });
      if (!current()) return;
      if (response.ok && response.data?.ok && hasCurrentChoice(response.data) &&
          response.data.granted === granted) {
        activate(response.data);
        closeChoices();
      } else setError("Your choice could not be saved. Meta measurement stays off. Please try again.");
    } catch {
      if (current()) setError("Your choice could not be saved. Meta measurement stays off. Please try again.");
    } finally {
      if (version === requestVersion.current) setBusy(false);
    }
  }
  if (!memory || pathname !== "/memory-challenge") return null;
  const currentChoice = hasCurrentChoice(record);
  const showControls = expanded || !currentChoice;
  const actionStyle = "min-h-11 rounded-lg border border-slate-400 bg-transparent px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60";
  const bottomSpace = pathname.startsWith("/memory-challenge/video/") ? "pb-28 md:pb-6" : "pb-6";
  return <footer aria-label="Privacy choices" className={`mx-auto w-full max-w-5xl px-4 ${bottomSpace} pt-4 text-sm text-slate-700`}>
    <section id="memory-measurement-choices" aria-label="Optional advertising measurement" className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 sm:px-5">
      {showControls ? <>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="font-semibold">Optional Meta advertising measurement</p>
          {currentChoice && <button type="button" onClick={closeChoices} aria-expanded="true" aria-controls="memory-measurement-choices" className="rounded px-2 py-1 underline focus-visible:outline focus-visible:outline-2">Close privacy choices</button>}
        </div>
        <p className="mt-1 leading-relaxed">Optional: share limited browser and adult purchaser details with Meta to measure ads. Your score, WhatsApp service and booking work if you decline.</p>
        <details className="mt-2">
          <summary ref={summary} className="w-fit cursor-pointer rounded underline underline-offset-4 focus-visible:outline focus-visible:outline-2">Read the full disclosure</summary>
          <p className="mt-2 border-l-2 border-slate-300 pl-3 leading-relaxed">Allow BrainoDad to share limited browser and adult purchaser details with Meta to measure ads.
            We do not share student names, scores or answers. Your score, WhatsApp service and booking work without this.
            Your choice is remembered for 30 days. You can withdraw it here.</p>
        </details>
        {currentChoice && <p className="mt-2" aria-live="polite">Current choice: {record.granted ? "measurement allowed" : "measurement declined"}.</p>}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" disabled={busy} onClick={() => choose(true)} className={actionStyle}>I am 18 or older — allow measurement</button>
          <button type="button" disabled={busy} onClick={() => choose(false)} className={actionStyle}>{currentChoice && record.granted ? "Withdraw measurement consent" : "Decline measurement"}</button>
        </div>
      </> : <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-slate-600">Your privacy choice is saved for up to 30 days.</p>
        <button ref={reviewButton} type="button" onClick={openChoices} aria-expanded="false" aria-controls="memory-measurement-choices" className="rounded px-2 py-1 font-semibold underline underline-offset-4 focus-visible:outline focus-visible:outline-2">Privacy choices</button>
      </div>}
      {error && <p role="alert" className="mt-3 text-rose-700">{error}</p>}
    </section>
    <p className="mt-3 text-xs leading-relaxed text-slate-500">This website is independently operated by BrainoDad and is not affiliated with, sponsored by, or endorsed by Meta Platforms, Inc., Facebook, or Instagram. Facebook and Instagram are trademarks of Meta Platforms, Inc.</p>
  </footer>;
}
