import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MemoryChallengeTest from "./MemoryChallengeTest";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || ""
).replace(/\/+$/, "");

const ALLOWED_TRACKS = new Set([
  "school_foundation",
  "school_advanced",
  "advanced",
]);

export default function MemoryRetestProtectedTest() {
  const navigate = useNavigate();

  const [status, setStatus] = useState("checking");
  const [verifiedTrackId, setVerifiedTrackId] = useState(null);

  useEffect(() => {
    let active = true;

    async function verifySession() {
      try {
        const response = await fetch(
          `${API_BASE}/api/memory-retest/session`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            referrerPolicy: "no-referrer",
          },
        );

        const payload = await response
          .json()
          .catch(() => null);

        if (!active) return;

        if (response.status === 401) {
          setStatus("unauthorized");
          return;
        }

        if (
          !response.ok ||
          !payload?.ok ||
          !ALLOWED_TRACKS.has(payload.trackId)
        ) {
          setStatus("error");
          return;
        }

        /*
         * The assessment track is obtained only
         * from the verified backend session.
         *
         * Do not trust route state, URL parameters
         * or browser storage for this decision.
         */
        setVerifiedTrackId(payload.trackId);
        setStatus("ready");
      } catch {
        if (!active) return;
        setStatus("error");
      }
    }

    verifySession();

    return () => {
      active = false;
    };
  }, []);

  if (status === "ready" && verifiedTrackId) {
    return (
      <MemoryChallengeTest
        key={`form-b-${verifiedTrackId}`}
        form="B"
        verifiedTrackId={verifiedTrackId}
      />
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <section className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-700">
          BrainoDad Memory Training
        </p>

        <h1 className="mb-4 text-2xl font-bold text-slate-900">
          Second Study Memory Test
        </h1>

        {status === "checking" ? (
          <div role="status" aria-live="polite">
            <p className="text-slate-700">
              Verifying your assessment access...
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Your memory test will open after verification.
            </p>
          </div>
        ) : (
          <div role="alert">
            <p className="mb-5 text-slate-700">
              {status === "unauthorized"
                ? "Your memory retest session has expired or is unavailable. Please reopen your valid retest link."
                : "We could not verify your memory retest access. Please try again."}
            </p>

            <button
              type="button"
              onClick={() => navigate("/memory-retest")}
              className="rounded-lg bg-blue-700 px-6 py-3 font-semibold text-white"
            >
              Return to Retest Access
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
