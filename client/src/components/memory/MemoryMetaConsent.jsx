import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../../api/apiClient";
import { isMemoryRoute, restoreMetaDocumentView } from "../../lib/metaPixel";
import { bootMetaDocument } from "../../lib/metaDocument";
import { trackPageView } from "../../lib/tracking";
import { readMemoryConsent, saveMemoryConsent, memoryConsentGranted } from "../../lib/memoryMetaConsent";

export default function MemoryMetaConsent() {
  const { pathname } = useLocation();
  const memory = isMemoryRoute(pathname);
  const [record, setRecord] = useState(() => readMemoryConsent());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const activate = next => {
    const wasGranted = memoryConsentGranted();
    saveMemoryConsent(next); setRecord(next);
    if (next?.granted && !wasGranted) {
      if (bootMetaDocument()) {
        window.fbq?.("consent", "grant");
        restoreMetaDocumentView();
        trackPageView(window.location.pathname + window.location.search);
      }
    } else if (!next?.granted) window.fbq?.("consent", "revoke");
  };
  useEffect(() => {
    if (!memory) return;
    let mounted = true;
    const stored = readMemoryConsent();
    if (stored?.receipt) {
      const request = stored.granted
        ? api.post("/memory-meta/consent/status", { receipt: stored.receipt })
        : api.post("/memory-meta/consent", { receipt: stored.receipt, granted: false });
      request.then(response => {
        if (mounted) {
          activate({ ...stored, granted: stored.granted && response.ok && response.data?.granted === true });
          if (!response.ok && !stored.granted) setError("Withdrawal is off on this device but not yet confirmed by the server. Please retry.");
        }
      });
    }
    const changed = () => {
      const next = readMemoryConsent();
      window.memoryMetaConsentVerified = false;
      setRecord(next);
      if (!next?.granted) window.fbq?.("consent", "revoke");
    };
    window.addEventListener("storage", changed);
    return () => { mounted = false; window.removeEventListener("storage", changed); };
  }, [memory]);
  async function choose(granted) {
    setBusy(true); setError("");
    // Withdrawal is immediate locally even if the server temporarily fails.
    if (!granted) activate({ ...readMemoryConsent(), granted: false });
    const response = await api.post("/memory-meta/consent", {
      receipt: readMemoryConsent()?.receipt, granted, adultConfirmed: granted,
    });
    if (response.ok && response.data?.ok) activate(response.data);
    else setError("Your choice could not be saved. Meta measurement stays off. Please try again.");
    setBusy(false);
  }
  if (!memory) return null;
  return <section aria-label="Optional advertising measurement" className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
    <p className="font-semibold">Optional Meta advertising measurement</p>
    <p>Allow BrainoDad to share limited browser and adult purchaser details with Meta to measure ads.
      We do not share student names, scores or answers. Your score, WhatsApp service and booking work without this.
      Your choice is remembered for 30 days. You can withdraw it here.</p>
    {record?.granted ? <button type="button" disabled={busy} onClick={() => choose(false)}
      className="mt-2 underline">Withdraw measurement consent</button> : <div className="mt-2 flex flex-wrap gap-4">
      <button type="button" disabled={busy} onClick={() => choose(true)} className="font-bold text-indigo-700">
        I am 18 or older — allow measurement</button>
      <button type="button" disabled={busy} onClick={() => choose(false)} className="underline">Decline measurement</button>
    </div>}
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
  </section>;
}
