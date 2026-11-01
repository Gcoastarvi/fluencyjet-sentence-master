import { useRef, useState } from "react";
import {
  buildInvitationRequest,
  eventHasEnded,
  invitationErrorMessage,
  TRACK_LABELS,
} from "./memoryRetestInvitationUtils.mjs";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.PROD ? "https://api.fluencyjet.com" : "")
).replace(/\/+$/, "");

async function adminRequest(path, body) {
  const token = localStorage.getItem("fj_admin_token");

  if (!token) {
    throw new Error("ADMIN_AUTH_REQUIRED");
  }

  const response = await fetch(
    `${API_BASE}/api/admin/memory-retest${path}`,
    {
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    },
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.ok !== true) {
    throw new Error(
      payload?.code || "ADMIN_INVITATION_REQUEST_FAILED",
    );
  }

  return payload;
}

function formatEventDate(value) {
  const date = new Date(value || "");

  if (!Number.isFinite(date.getTime())) {
    return "Event date unavailable";
  }

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date) + " IST";
}

export default function AdminMemoryRetestInvitations() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);

  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [schoolTrack, setSchoolTrack] = useState("");

  const [issuing, setIssuing] = useState(false);
  const [invitation, setInvitation] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const issuingRef = useRef(false);
  const linkInputRef = useRef(null);

  async function handleSearch(event) {
    event.preventDefault();

    if (searching || issuingRef.current) return;

    const term = query.trim();

    if (term.length < 3 || term.length > 100) {
      setError("Enter 3–100 characters to search.");
      return;
    }

    setSearching(true);
    setError("");
    setNotice("");
    setResults([]);
    setHasSearched(false);
    setSelectedPurchase(null);
    setInvitation(null);
    setSchoolTrack("");

    try {
      const response = await adminRequest(
        "/purchases/search",
        { search: term },
      );

      if (!Array.isArray(response.purchases)) {
        throw new Error("PURCHASE_SEARCH_INVALID_RESPONSE");
      }

      setResults(response.purchases);
      setHasSearched(true);
    } catch (failure) {
      setError(invitationErrorMessage(failure?.message));
    } finally {
      setSearching(false);
    }
  }

  function selectPurchase(purchase) {
    setSelectedPurchase(purchase);
    setSchoolTrack("");
    setInvitation(null);
    setNotice("");
    setError("");
  }

  async function handleIssue() {
    if (issuingRef.current || !selectedPurchase) return;

    const request = buildInvitationRequest(
      selectedPurchase,
      schoolTrack,
    );

    if (!request) {
      setError(
        "Choose a valid school level or select another registration.",
      );
      return;
    }

    if (!eventHasEnded(selectedPurchase)) {
      setError(
        "This masterclass has not ended yet. Invitations are available after the event.",
      );
      return;
    }

    const confirmed = window.confirm(
      "Generate a private, single-use Form B invitation?\n\n" +
      "If an earlier invitation exists, it will be revoked.\n\n" +
      "The link will NOT be sent automatically.",
    );

    if (!confirmed) return;

    issuingRef.current = true;
    setIssuing(true);
    setInvitation(null);
    setNotice("");
    setError("");

    try {
      const response = await adminRequest(
        "/invitations",
        request,
      );

      if (
        typeof response.invitationUrl !== "string" ||
        !/^https:\/\/www\.fluencyjet\.com\/memory-retest#token=[a-f0-9]{64}$/.test(
          response.invitationUrl,
        )
      ) {
        throw new Error("INVALID_INVITATION_RESPONSE");
      }

      setInvitation({
        url: response.invitationUrl,
        expiresAt: response.linkExpiresAt,
      });

      setNotice(
        "Invitation generated. It has NOT been sent. Copy the link and deliver it privately.",
      );
    } catch (failure) {
      setError(invitationErrorMessage(failure?.message));
    } finally {
      issuingRef.current = false;
      setIssuing(false);
    }
  }

  async function handleCopy() {
    if (!invitation?.url) return;

    try {
      await navigator.clipboard.writeText(invitation.url);
      setNotice("Invitation link copied. Send it privately to the parent.");
    } catch {
      linkInputRef.current?.focus();
      linkInputRef.current?.select();

      setNotice(
        "Automatic copying is unavailable. The link is selected; press Ctrl+C to copy.",
      );
    }
  }

  const isUnassigned =
    selectedPurchase?.originalTrackId === "school_unspecified" &&
    selectedPurchase?.assignedTrackId == null;

  const requestReady = Boolean(
    buildInvitationRequest(selectedPurchase, schoolTrack),
  );

  const eventEnded = eventHasEnded(selectedPurchase);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-6">
        <a
          href="/admin/dashboard"
          className="text-sm font-semibold text-purple-700 hover:underline"
        >
          Back to Admin Dashboard
        </a>

        <header>
          <h1 className="text-2xl font-bold">
            BrainoDad Memory Retest Invitations
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Find a captured ₹99 masterclass purchase, verify the
            student's assessment track, and issue a private Form B link.
          </p>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <form onSubmit={handleSearch} className="space-y-3">
            <label
              htmlFor="memory-purchase-search"
              className="block text-sm font-semibold"
            >
              Parent name, email, phone, or purchase ID
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="memory-purchase-search"
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                maxLength={100}
                autoComplete="off"
                placeholder="Search a paid registration"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2"
              />

              <button
                type="submit"
                disabled={searching || issuing}
                className="rounded-lg bg-purple-700 px-5 py-2 font-semibold text-white disabled:opacity-50"
              >
                {searching ? "Searching..." : "Search Purchases"}
              </button>
            </div>
          </form>

          {hasSearched && results.length === 0 && (
            <p className="mt-4 text-sm text-slate-600" role="status">
              No matching captured ₹99 registrations were found.
            </p>
          )}

          {results.length > 0 && (
            <div className="mt-5 space-y-2">
              <h2 className="font-semibold">
                Matching paid registrations
              </h2>

              {results.map((purchase) => (
                <button
                  key={purchase.purchaseId}
                  type="button"
                  disabled={issuing}
                  onClick={() => selectPurchase(purchase)}
                  className={
                    "w-full rounded-lg border p-4 text-left " +
                    (selectedPurchase?.purchaseId === purchase.purchaseId
                      ? "border-purple-600 bg-purple-50"
                      : "border-slate-200 hover:bg-slate-50")
                  }
                >
                  <span className="block font-semibold">
                    {purchase.purchaserName || "Parent name unavailable"}
                  </span>
                  <span className="mt-1 block text-sm text-slate-600">
                    {purchase.purchaserEmail || "No email"} ·{" "}
                    {purchase.purchaserPhone || "No phone"}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    Masterclass: {formatEventDate(purchase.eventStartsAt)}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    Purchase reference: {purchase.purchaseId}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {selectedPurchase && (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-bold">
              Generate Form B Invitation
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              Selected parent:{" "}
              <strong>
                {selectedPurchase.purchaserName ||
                  selectedPurchase.purchaserEmail ||
                  selectedPurchase.purchaseId}
              </strong>
            </p>

            <p className="mt-3 text-sm">
              Original assessment:{" "}
              <strong>
                {TRACK_LABELS[selectedPurchase.originalTrackId] ||
                  "Unknown"}
              </strong>
            </p>

            {selectedPurchase.assignedTrackId && (
              <p className="mt-2 text-sm">
                Administrator-assigned track:{" "}
                <strong>
                  {TRACK_LABELS[selectedPurchase.assignedTrackId] ||
                    "Invalid assignment"}
                </strong>
              </p>
            )}

            {isUnassigned && (
              <div className="mt-4">
                <label
                  htmlFor="memory-school-track"
                  className="mb-2 block text-sm font-semibold"
                >
                  Select the student's class group
                </label>

                <select
                  id="memory-school-track"
                  value={schoolTrack}
                  onChange={(event) =>
                    setSchoolTrack(event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 sm:max-w-xs"
                >
                  <option value="">Choose school level</option>
                  <option value="school_foundation">
                    Classes 6–8
                  </option>
                  <option value="school_advanced">
                    Classes 9–12
                  </option>
                </select>

                <p className="mt-2 text-xs text-slate-600">
                  Confirm the student's class with the parent.
                  This selection is stored against the purchase
                  and cannot be changed using this page.
                </p>
              </div>
            )}

            <p className="mt-4 text-sm text-slate-600">
              Purchased masterclass ended:{" "}
              <strong>
                {formatEventDate(selectedPurchase.eventEndsAt)}
              </strong>
            </p>

            {!eventEnded && (
              <p className="mt-2 text-sm font-medium text-amber-700">
                Invitations are locked until this event ends.
              </p>
            )}

            <button
              type="button"
              onClick={handleIssue}
              disabled={
                issuing ||
                searching ||
                !requestReady ||
                !eventEnded
              }
              className="mt-5 rounded-lg bg-purple-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {issuing
                ? "Generating..."
                : "Generate Private Invitation"}
            </button>

            <p className="mt-3 text-xs text-slate-600">
              Generating a replacement revokes any previous invitation
              for this purchase. No WhatsApp message or email is sent.
            </p>
          </section>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-white p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-800"
          >
            {notice}
          </div>
        )}

        {invitation && (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-bold">
              Private Invitation Ready
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              Copy the link below and send it privately to the parent.
              Do not post it in a public group.
            </p>

            <input
              ref={linkInputRef}
              type="text"
              readOnly
              value={invitation.url}
              onFocus={(event) => event.target.select()}
              aria-label="Private Form B invitation URL"
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-3 text-sm"
            />

            <button
              type="button"
              onClick={handleCopy}
              className="mt-3 rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white"
            >
              Copy Invitation Link
            </button>

            <p className="mt-3 text-xs text-slate-600">
              Link expires: {formatEventDate(invitation.expiresAt)}.
              It can be redeemed once, on the student's chosen device.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
