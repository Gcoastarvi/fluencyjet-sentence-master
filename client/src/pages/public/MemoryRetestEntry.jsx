import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || ""
).replace(/\/+$/, "");

const ALLOWED_TRACKS = new Set([
  "school_foundation",
  "school_advanced",
  "advanced",
]);

async function openRetestSession() {
  /*
   * Read a one-time token from the URL fragment.
   * URL fragments are not sent in HTTP requests.
   *
   * Remove the fragment before contacting the API.
   */
  const fragment = window.location.hash.slice(1);

  const params = new URLSearchParams(fragment);

  const linkToken = params.get("token");

  window.history.replaceState(
    window.history.state,
    "",
    window.location.pathname + window.location.search,
  );

  let url;
  let options;

  if (fragment) {
    if (
      typeof linkToken !== "string" ||
      !/^[a-f0-9]{64}$/.test(linkToken)
    ) {
      throw new Error("INVALID_RETEST_LINK");
    }

    url = `${API_BASE}/api/memory-retest/redeem`;

    options = {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ linkToken }),
    };
  } else {
    /*
     * A returning learner may already have a valid
     * HttpOnly browser session.
     */
    url = `${API_BASE}/api/memory-retest/session`;

    options = {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    };
  }

  const response = await fetch(url, options);

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new Error(
      payload?.code || "RETEST_ACCESS_UNAVAILABLE",
    );
  }

  if (!ALLOWED_TRACKS.has(payload.trackId)) {
    throw new Error("INVALID_RETEST_TRACK");
  }

  return payload.trackId;
}

function getFriendlyError(code) {
  if (
    code === "INVALID_RETEST_LINK" ||
    code === "INVALID_OR_USED_RETEST_LINK"
  ) {
    return (
      "This memory retest link is invalid, expired, " +
      "or has already been used. Please request a new link."
    );
  }

  if (
    code === "INVALID_RETEST_SESSION"
  ) {
    return (
      "Your memory retest session is unavailable or " +
      "has expired. Please open your valid retest link."
    );
  }

  if (code === "RETEST_RATE_LIMITED") {
    return (
      "Too many attempts were made. " +
      "Please try again later."
    );
  }

  return (
    "We could not open your memory retest right now. " +
    "Please try again."
  );
}

export default function MemoryRetestEntry() {
  const navigate = useNavigate();

  const taskRef = useRef(null);

  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    /*
     * Share the same in-flight operation when React
     * development StrictMode reruns the effect.
     *
     * This prevents accidental double redemption.
     */
    if (!taskRef.current) {
      taskRef.current = openRetestSession();
    }

    taskRef.current
      .then((trackId) => {
        if (!active) return;

        navigate("/memory-retest/test", {
          replace: true,
          state: {
            retestTrackId: trackId,
          },
        });
      })
      .catch((failure) => {
        if (!active) return;

        setError(
          getFriendlyError(failure?.message),
        );
      });

    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <section className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-700">
          BrainoDad Memory Training
        </p>

        <h1 className="mb-4 text-2xl font-bold text-slate-900">
          Second Study Memory Test
        </h1>

        {error ? (
          <div role="alert">
            <p className="mb-5 text-slate-700">
              {error}
            </p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-blue-700 px-6 py-3 font-semibold text-white"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div role="status" aria-live="polite">
            <p className="text-slate-700">
              Verifying your memory retest access...
            </p>

            <p className="mt-3 text-sm text-slate-500">
              Your assessment will open after verification.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
