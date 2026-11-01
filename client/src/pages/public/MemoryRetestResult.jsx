import { isValidMemoryRetestResult } from "./memoryRetestResultValidation.mjs";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || ""
).replace(/\/+$/, "");

const TRACK_LABELS = {
  school_foundation: "Class 6–8",
  school_advanced: "Class 9–12",
  advanced: "Advanced",
};

const formatScore = (value) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(value);


export default function MemoryRetestResult() {
  const [status, setStatus] = useState("loading");
  const [result, setResult] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadSavedResult() {
      try {
        const response = await fetch(
          `${API_BASE}/api/memory-retest/result`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            referrerPolicy: "no-referrer",
            signal: controller.signal,
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
          response.status === 404 &&
          payload?.code === "FORM_B_RESULT_NOT_READY"
        ) {
          setStatus("not_ready");
          return;
        }

        if (
          !response.ok ||
          !isValidMemoryRetestResult(payload)
        ) {
          setStatus("error");
          return;
        }

        setResult({
          trackId: payload.trackId,
          formAScore: payload.formAScore,
          formBScore: payload.formBScore,
          improvementPoints: payload.improvementPoints,
          formBCompletedAt: payload.formBCompletedAt,
        });

        setStatus("ready");
      } catch {
        if (active) {
          setStatus("error");
        }
      }
    }

    loadSavedResult();

    return () => {
      active = false;
      controller.abort();
    };
  }, [retryCount]);

  const retry = () => {
    setResult(null);
    setStatus("loading");
    setRetryCount((value) => value + 1);
  };

  if (status === "ready" && result) {
    const hasBaseline = result.formAScore !== null;
    const difference = result.improvementPoints;

    const differenceText = hasBaseline
      ? `${difference > 0 ? "+" : ""}${formatScore(difference)}`
      : null;

    const differenceColor =
      difference > 0
        ? "text-emerald-700"
        : difference < 0
          ? "text-amber-700"
          : "text-slate-900";

    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12">
        <section className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm sm:p-10">
          <p className="mb-2 text-center text-sm font-semibold uppercase tracking-wide text-blue-700">
            BrainoDad Memory Training
          </p>

          <h1 className="text-center text-3xl font-bold text-slate-900">
            Your Memory Test Results
          </h1>

          <p className="mt-3 text-center text-slate-600">
            {hasBaseline
              ? "Before and After Score Comparison"
              : "Your Post-Training Memory Assessment"}
          </p>

          <p className="mt-2 text-center text-sm text-slate-500">
            {TRACK_LABELS[result.trackId]}
          </p>

          {hasBaseline ? (
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-100 p-6 text-center">
                <p className="text-sm font-medium text-slate-600">
                  Before — Form A
                </p>

                <p className="mt-3 text-4xl font-bold text-slate-900">
                  {formatScore(result.formAScore)}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Out of 100
                </p>
              </div>

              <div className="rounded-xl bg-blue-50 p-6 text-center">
                <p className="text-sm font-medium text-slate-600">
                  After — Form B
                </p>

                <p className="mt-3 text-4xl font-bold text-slate-900">
                  {formatScore(result.formBScore)}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Out of 100
                </p>
              </div>

              <div className="rounded-xl bg-slate-100 p-6 text-center">
                <p className="text-sm font-medium text-slate-600">
                  Score Difference
                </p>

                <p className={`mt-3 text-4xl font-bold ${differenceColor}`}>
                  {differenceText}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Points
                </p>
              </div>
            </div>
          ) : (
            <div
              className="mx-auto mt-8 max-w-sm rounded-xl bg-blue-50 p-8 text-center"
              aria-label="Post-training memory assessment score"
            >
              <p className="text-sm font-semibold text-blue-800">
                Your Form B Score
              </p>

              <p className="mt-4 text-5xl font-bold text-slate-900">
                {formatScore(result.formBScore)}
              </p>

              <p className="mt-2 text-sm text-slate-600">
                Out of 100
              </p>

              <p className="mt-5 text-sm leading-6 text-slate-600">
                You have completed your post-training memory assessment.
              </p>
            </div>
          )}

          <div className="mt-8 rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900">
              Understanding Your Results
            </h2>

            <p className="mt-3 leading-7 text-slate-700">
              {hasBaseline
                ? "These scores show how you performed in two different memory assessments. A higher second score is encouraging, but the difference alone does not establish how much your memory ability has improved."
                : "This is your result from the post-training memory assessment. Because no initial Form A score is linked to this test, a Before/After score difference cannot be calculated."}
            </p>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            Completed on{" "}
            {new Date(
              result.formBCompletedAt
            ).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>

          <p className="mt-3 text-center text-sm text-slate-500">
            Your result is saved securely. Access to this page
            requires a valid retest session.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <section
        className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm"
        aria-busy={status === "loading"}
      >
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-700">
          BrainoDad Memory Training
        </p>

        <h1 className="mb-5 text-2xl font-bold text-slate-900">
          Your Memory Test Results
        </h1>

        {status === "loading" ? (
          <p role="status" className="text-slate-700">
            Retrieving your saved results...
          </p>
        ) : (
          <div role="alert">
            <p className="mb-6 text-slate-700">
              {status === "unauthorized"
                ? "Your secure retest session has expired or is unavailable. Please contact the organizer for assistance."
                : status === "not_ready"
                  ? "Your second assessment has not been completed yet."
                  : "We could not retrieve your results right now. Please try again."}
            </p>

            {status === "not_ready" ? (
              <Link
                to="/memory-retest/test"
                className="inline-block rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white"
              >
                Go to Memory Test
              </Link>
            ) : status === "error" ? (
              <button
                type="button"
                onClick={retry}
                className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white"
              >
                Try Again
              </button>
            ) : (
              <p className="text-sm text-slate-500">
                A used or expired one-time link cannot
                automatically issue a new session.
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
