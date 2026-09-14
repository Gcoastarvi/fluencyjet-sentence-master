import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api/apiClient";
import AdminSidebar from "../../components/AdminSidebar";
import "./WhatsAppBroadcast.css";

const emptyPreview = { eligible: 0, excluded: 0, reasons: [], users: [] };

function payload(data, key, fallback = []) {
  return data?.[key] ?? data?.data?.[key] ?? (Array.isArray(data) ? data : fallback);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function StatusPill({ children, tone = "neutral" }) {
  return <span className={`wa-pill wa-pill-${tone}`}>{children}</span>;
}

function ConfirmButton({ children, onConfirm, disabled, tone = "primary" }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`wa-button wa-button-${tone}`}
      onClick={() => {
        if (window.confirm("Confirm this WhatsApp operation? This action is audited.")) onConfirm();
      }}
    >
      {children}
    </button>
  );
}

export default function WhatsAppBroadcast() {
  const adminOptions = useMemo(() => {
    const token = localStorage.getItem("fj_admin_token");
    return { headers: token ? { Authorization: `Bearer ${token}` } : {} };
  }, []);
  const [readiness, setReadiness] = useState(null);
  const [sources, setSources] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [events, setEvents] = useState([]);
  const [campaignKey, setCampaignKey] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [source, setSource] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [userIds, setUserIds] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [batchSize, setBatchSize] = useState(25);
  const [preview, setPreview] = useState(emptyPreview);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ready, sourceResult, campaignResult] = await Promise.all([
        api.get("/admin/whatsapp/readiness", adminOptions),
        api.get("/admin/whatsapp/lead-sources", adminOptions),
        api.get("/admin/whatsapp/campaigns", adminOptions),
      ]);
      if (!ready.ok || !sourceResult.ok || !campaignResult.ok) throw new Error("Unable to load WhatsApp operations data.");
      setReadiness(ready.data);
      setSources(payload(sourceResult.data, "sources"));
      setCampaigns(payload(campaignResult.data, "campaigns"));
    } catch (err) {
      setError(err.message || "Unable to connect to the WhatsApp control plane.");
    } finally {
      setLoading(false);
    }
  }, [adminOptions]);

  useEffect(() => { refresh(); }, [refresh]);

  const runPreview = async () => {
    setBusy("preview"); setError(""); setNotice("");
    try {
      const parsedUserIds = userIds
        .split(/[\s,]+/)
        .map((id) => id.trim())
        .filter(Boolean)
        .map(Number);
      const result = await api.post("/admin/whatsapp/preview", {
        campaignKey, templateName, source: source || undefined, from: fromDate || undefined, to: toDate || undefined,
        userIds: parsedUserIds.length ? parsedUserIds : undefined,
        scheduledAt: scheduledAt || undefined,
      }, adminOptions);
      if (!result.ok) throw new Error(result.error || "Preview failed.");
      const data = result.data || {};
      const counts = data.counts || {};
      setPreview({
        eligible: counts.eligible ?? counts.ELIGIBLE ?? 0,
        excluded: counts.excluded ?? counts.EXCLUDED ?? 0,
        reasons: data.rows || data.recipients || [],
        users: data.rows || [],
      });
      setNotice("Eligibility preview refreshed. No messages were sent.");
    } catch (err) { setError(err.message || "Preview failed."); } finally { setBusy(""); }
  };

  const schedule = async () => {
    setBusy("schedule"); setError(""); setNotice("");
    try {
      const parsedUserIds = userIds
        .split(/[\s,]+/)
        .map((id) => id.trim())
        .filter(Boolean)
        .map(Number);
      const result = await api.post("/admin/whatsapp/campaigns", {
        campaignKey, templateName, source: source || undefined, from: fromDate || undefined,
        to: toDate || undefined, userIds: parsedUserIds.length ? parsedUserIds : undefined,
        scheduledAt: scheduledAt || undefined,
      }, adminOptions);
      if (!result.ok) throw new Error(result.error || "Campaign could not be scheduled.");
      const counts = result.data?.counts || {};
      const rows = result.data?.rows || [];
      setNotice(`Campaign scheduled with ${rows.length} returned row${rows.length === 1 ? "" : "s"}${Object.keys(counts).length ? ` · ${Object.entries(counts).map(([key, value]) => `${key}: ${value}`).join(" · ")}` : ""}.`);
      await refresh();
    } catch (err) { setError(err.message || "Campaign could not be scheduled."); } finally { setBusy(""); }
  };

  const processCampaign = async (campaignKey, mode) => {
    setBusy(`${mode}-${campaignKey}`); setError(""); setNotice("");
    try {
      const result = await api.post(`/admin/whatsapp/campaigns/${encodeURIComponent(campaignKey)}/process`, {
        limit: mode === "batch" ? Number(batchSize) : 1,
      }, adminOptions);
      if (!result.ok) throw new Error(result.error || "Processing request failed.");
      const counts = result.data?.counts || {};
      const rows = result.data?.rows || [];
      setNotice(`Processed ${rows.length} row${rows.length === 1 ? "" : "s"}${Object.keys(counts).length ? ` · ${Object.entries(counts).map(([key, value]) => `${key}: ${value}`).join(" · ")}` : ""}.`);
      await refresh();
    } catch (err) { setError(err.message || "Processing request failed."); } finally { setBusy(""); }
  };

  const loadEvents = async (key) => {
    setSelectedCampaign(key); setBusy("events");
    try {
      const result = await api.get(`/admin/whatsapp/campaigns/${encodeURIComponent(key)}/events`, adminOptions);
      if (!result.ok) throw new Error(result.error || "Could not load events.");
      setEvents(payload(result.data, "events"));
    } catch (err) { setError(err.message || "Could not load events."); } finally { setBusy(""); }
  };

  const quarantine = async (eventId) => {
    setBusy(`quarantine-${eventId}`);
    try {
      const idempotencyKey = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `quarantine-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result = await api.post(`/admin/whatsapp/events/${encodeURIComponent(eventId)}/quarantine`, {
        campaignKey: selectedCampaign, idempotencyKey,
      }, adminOptions);
      if (!result.ok) throw new Error(result.error || "Quarantine failed.");
      setNotice("Event quarantined. Delivery state remains unconfirmed.");
      await refresh();
      if (selectedCampaign) await loadEvents(selectedCampaign);
    } catch (err) { setError(err.message || "Quarantine failed."); } finally { setBusy(""); }
  };

  const gateBlockers = readiness?.blockers || [];
  const ready = readiness?.ready === true;
  const approvedTemplates = readiness?.approvedTemplates || [];
  const campaignStates = ["PENDING", "SENDING", "SENT", "CANCELLED", "FAILED"];
  const hasDirectAudience = userIds.trim().length > 0;
  const hasFilteredAudience = Boolean(source && fromDate && toDate);
  const audienceReady = hasDirectAudience || hasFilteredAudience;
  const scheduleReady = audienceReady && Boolean(scheduledAt);
  const provider = readiness?.provider || {};
  return (
    <div className="wa-shell">
      <AdminSidebar />
      <main className="wa-main">
        <header className="wa-header">
          <div>
            <div className="wa-kicker">Operations / Messaging</div>
            <h1>WhatsApp Broadcast Control</h1>
            <p>Review eligibility, schedule approved campaigns, and reconcile provider events.</p>
          </div>
          <div className="wa-header-meta"><span className={`wa-live-dot ${ready ? "" : "is-muted"}`} />Admin session · audited actions</div>
        </header>
        {error && <div className="wa-alert wa-alert-error" role="alert">{error}<button onClick={refresh}>Retry</button></div>}
        {notice && <div className="wa-alert wa-alert-success" role="status">{notice}</div>}
        {loading ? <div className="wa-loading"><span /><span /><span /> Loading control plane</div> : (
          <>
            <section className="wa-readiness">
              <div><div className="wa-section-label">Provider readiness</div><strong>{ready ? "Ready for review" : "Blocked pending checks"}</strong></div>
              <div className="wa-readiness-copy">
                <b>Provider:</b>{" "}
                {provider.phoneNumberIdConfigured && provider.accessTokenConfigured && provider.graphApiVersionConfigured
                  ? "Configured"
                  : "Configuration incomplete"}
                <br />
                Scheduling remains available while live processing gates are closed.
              </div>
              <StatusPill tone={ready ? "good" : "warn"}>{ready ? "Gates open" : "Gates closed"}</StatusPill>
              {gateBlockers.length > 0 && <ul>{gateBlockers.map((item, index) => <li key={index}>{item.label || item.message || item}</li>)}</ul>}
            </section>
            <div className="wa-grid">
              <section className="wa-card wa-compose">
                <div className="wa-card-heading"><div><div className="wa-section-label">01 / Build audience</div><h2>Campaign setup</h2></div><span className="wa-step">Draft</span></div>
                <label>Campaign key<input value={campaignKey} onChange={(e) => setCampaignKey(e.target.value)} placeholder="march-reengagement-cohort-a" /></label>
                <label>Approved template<select value={templateName} onChange={(e) => setTemplateName(e.target.value)}><option value="">Select an approved template</option>{approvedTemplates.map((item) => <option key={item.name} value={item.name}>{item.name} · {item.languageCode}</option>)}</select></label>
                <div className="wa-subgrid"><label>Lead source<select value={source} onChange={(e) => setSource(e.target.value)} disabled={hasDirectAudience}><option value="">Select a source</option>{sources.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>From date<input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} disabled={hasDirectAudience} /></label><label>To date<input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} disabled={hasDirectAudience} /></label></div>
                <label>User IDs override <span className="wa-hint">comma or newline separated</span><textarea value={userIds} onChange={(e) => setUserIds(e.target.value)} placeholder="Use this for a tightly bounded manual audience." /></label>
                <div className="wa-actions"><button className="wa-button wa-button-secondary" disabled={busy === "preview" || !campaignKey || !templateName || !scheduleReady} onClick={runPreview}>{busy === "preview" ? "Reviewing…" : "Preview eligibility"}</button><span className="wa-help">Preview never sends a message.</span></div>
              </section>
              <section className="wa-card wa-preview">
                <div className="wa-card-heading"><div><div className="wa-section-label">02 / Eligibility</div><h2>Safety review</h2></div><StatusPill tone={preview.eligible ? "good" : "neutral"}>{preview.eligible} eligible</StatusPill></div>
                <div className="wa-counts"><div><strong>{preview.eligible}</strong><span>Eligible</span></div><div><strong>{preview.excluded}</strong><span>Excluded</span></div></div>
                <h3>Eligibility rows</h3>{preview.reasons.length ? <ul className="wa-reasons">{preview.reasons.map((reason, index) => <li key={index}><span>{reason.reasonCode || reason.reason || reason.status || "Excluded"}</span><b>{reason.count ?? reason.total ?? reason.userId ?? "—"}</b></li>)}</ul> : <div className="wa-empty">Run a preview to see consent, opt-out, and phone eligibility exclusions.</div>}
              </section>
            </div>
            <section className="wa-card wa-schedule">
              <div className="wa-card-heading"><div><div className="wa-section-label">03 / Commit</div><h2>Schedule and process</h2></div><span className="wa-hint">Explicit confirmation required</span></div>
              <div className="wa-subgrid wa-commit-grid"><label>Scheduled at <span className="wa-hint">required for preview and scheduling</span><input type="datetime-local" required value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></label><label>Batch limit<input type="number" min="1" max="100" value={batchSize} onChange={(e) => setBatchSize(Math.min(100, Math.max(1, Number(e.target.value) || 1)))} /></label><div className="wa-commit"><ConfirmButton disabled={!templateName || !campaignKey || !scheduleReady || busy === "schedule"} onConfirm={schedule}>{busy === "schedule" ? "Scheduling…" : "Schedule campaign"}</ConfirmButton></div></div>
            </section>
            <section className="wa-card">
              <div className="wa-card-heading"><div><div className="wa-section-label">Campaign ledger</div><h2>Recent campaigns</h2></div><button className="wa-link" onClick={refresh}>Refresh</button></div>
              {!campaigns.length ? <div className="wa-empty">No campaigns have been recorded.</div> : <div className="wa-table-wrap"><table><thead><tr><th>Campaign</th><th>State</th>{campaignStates.map((state) => <th key={state}>{state}</th>)}<th>Scheduled</th><th>Actions</th></tr></thead><tbody>{campaigns.map((item) => { const key = item.campaignKey; const counts = item.counts || {}; return <tr key={key}><td><b>{key}</b></td><td><StatusPill tone={String(item.status).toLowerCase().includes("fail") ? "bad" : "neutral"}>{item.status || "Recorded"}</StatusPill></td>{campaignStates.map((state) => <td key={state}>{counts[state] ?? 0}</td>)}<td>{formatDate(item.scheduledAt)}</td><td className="wa-row-actions"><ConfirmButton tone="quiet" disabled={!ready || !key || busy === `one-${key}`} onConfirm={() => processCampaign(key, "one")}>Send one</ConfirmButton><ConfirmButton tone="quiet" disabled={!ready || !key || busy === `batch-${key}`} onConfirm={() => processCampaign(key, "batch")}>Process batch</ConfirmButton><button className="wa-link" onClick={() => loadEvents(key)}>Events</button></td></tr>; })}</tbody></table></div>}
            </section>
            {selectedCampaign && <section className="wa-card"><div className="wa-card-heading"><div><div className="wa-section-label">Event review</div><h2>{selectedCampaign}</h2></div><span className="wa-hint">Provider state is shown exactly as returned</span></div>{busy === "events" ? <div className="wa-loading compact">Loading events</div> : !events.length ? <div className="wa-empty">No events returned for this campaign.</div> : <div className="wa-table-wrap"><table><thead><tr><th>Event</th><th>Learner</th><th>State</th><th>Reason</th><th>Action</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td><b>{event.id}</b><small>{formatDate(event.createdAt || event.created_at)}</small></td><td><b>{event.learnerName || "Unknown learner"}</b><small>User {event.userId} · {event.whatsappNumberMasked || "No WhatsApp number"}</small></td><td><StatusPill tone={event.status === "delivered" ? "good" : event.status === "failed" ? "bad" : "warn"}>{event.status || "Unknown"}</StatusPill></td><td>{event.reason || event.error || "—"}</td><td>{event.quarantinable ? <ConfirmButton tone="danger" disabled={busy === `quarantine-${event.id}`} onConfirm={() => quarantine(event.id)}>Quarantine</ConfirmButton> : "—"}</td></tr>)}</tbody></table></div>}</section>}
          </>
        )}
      </main>
    </div>
  );
}