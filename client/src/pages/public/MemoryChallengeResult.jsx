import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { trackEvent } from "../../lib/tracking";

const DOMAIN_LABELS = {
  immediate: "Immediate Recall",
  ordered: "Ordered Recall",
  association: "Association Recall",
  academic: "Academic Recall",
  delayed: "Delayed Recall",
};

function readSessionJson(key, fallback) {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function readStoredResult() {
  return readSessionJson("memory_form_a_result", null);
}

function readStoredResponses() {
  return {
    immediateAnswers: readSessionJson(
      "memory_form_a_immediate_answers",
      [],
    ),
    orderedAnswers: readSessionJson(
      "memory_form_a_ordered_answers",
      [],
    ),
    associationAnswers: readSessionJson(
      "memory_form_a_association_answers",
      {},
    ),
    academicAnswers: readSessionJson(
      "memory_form_a_academic_answers",
      {},
    ),
    delayedAnswers: readSessionJson(
      "memory_form_a_delayed_answers",
      [],
    ),
  };
}

function formatScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

export default function MemoryChallengeResult() {
  const [result, setResult] = useState(() => readStoredResult());
  const [status, setStatus] = useState(result ? "ready" : "recovering");
  const [errorMessage, setErrorMessage] = useState("");

  async function recoverResult() {
    setStatus("recovering");
    setErrorMessage("");

    const responses = readStoredResponses();

    const hasSavedAssessment =
      responses.immediateAnswers.length > 0 ||
      responses.orderedAnswers.length > 0 ||
      Object.keys(responses.associationAnswers).length > 0 ||
      Object.keys(responses.academicAnswers).length > 0 ||
      responses.delayedAnswers.length > 0;

    if (!hasSavedAssessment) {
      setStatus("missing");
      return;
    }

    try {
      const response = await fetch("/api/memory/score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trackId: "school_foundation",
          form: "A",
          responses,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok || !payload?.result) {
        throw new Error(
          payload?.message || `Scoring request failed (${response.status})`,
        );
      }

      try {
        window.sessionStorage.setItem(
          "memory_form_a_result",
          JSON.stringify(payload.result),
        );
      } catch {
        // Result can still be displayed even if storage is unavailable.
      }

      setResult(payload.result);
      setStatus("ready");
    } catch (error) {
      console.error("Memory result recovery failed:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to calculate your result.",
      );
      setStatus("error");
    }
  }

  useEffect(() => {
    if (!result) {
      recoverResult();
    }
  }, []);

  useEffect(() => {
    if (!result) return;

    trackEvent("memory_result_viewed", {
      funnel: "amaze_memory",
      track: result.trackId,
      form: result.form,
      score: result.totalScore,
    });
  }, [result]);

  if (status === "recovering") {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
          <div className="w-full text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-indigo-300 border-t-transparent" />

            <h1 className="mt-6 text-3xl font-black">
              Calculating your result
            </h1>

            <p className="mt-4 font-medium text-slate-300">
              Your saved benchmark responses are being scored.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
          <div className="w-full text-center">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-amber-300">
              Result not calculated yet
            </p>

            <h1 className="mt-4 text-3xl font-black">
              Your answers are still saved
            </h1>

            <p className="mt-4 font-medium leading-7 text-slate-300">
              {errorMessage}
            </p>

            <button
              type="button"
              onClick={recoverResult}
              className="mt-8 w-full rounded-2xl bg-indigo-500 px-6 py-4 font-black text-white"
            >
              Retry Result
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!result?.modules) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-7 text-center shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-indigo-600">
            Study Recall Benchmark
          </p>

          <h1 className="mt-4 text-3xl font-black text-slate-950">
            No saved benchmark found
          </h1>

          <p className="mt-4 font-medium leading-7 text-slate-600">
            Complete the benchmark first to generate your Study Recall result.
          </p>

          <Link
            to="/memory-challenge"
            className="mt-7 inline-flex rounded-2xl bg-indigo-600 px-6 py-4 font-black text-white"
          >
            Start Benchmark
          </Link>
        </div>
      </main>
    );
  }

  const domainEntries = Object.entries(result.modules)
    .filter(([key]) => DOMAIN_LABELS[key])
    .map(([key, score]) => ({
      key,
      label: DOMAIN_LABELS[key],
      ...score,
    }));

  const strongestPercentage = Math.max(
    ...domainEntries.map((domain) => Number(domain.percentage) || 0),
  );

  const opportunityPercentage = Math.min(
    ...domainEntries.map((domain) => Number(domain.percentage) || 0),
  );

  const strongestDomains = domainEntries.filter(
    (domain) => Number(domain.percentage) === strongestPercentage,
  );

  const opportunityDomains = domainEntries.filter(
    (domain) => Number(domain.percentage) === opportunityPercentage,
  );

  const retentionPercent =
    result.retentionRatio === null ||
    result.retentionRatio === undefined
      ? null
      : Math.round(result.retentionRatio * 100);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-xl sm:p-9">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-indigo-300">
            Free Study Recall Benchmark
          </p>

          <h1 className="mt-3 text-3xl font-black sm:text-4xl">
            Your Study Recall Score
          </h1>

          <div className="mt-7 flex items-end gap-2">
            <span className="text-6xl font-black tracking-tight sm:text-7xl">
              {formatScore(result.totalScore)}
            </span>
            <span className="pb-2 text-2xl font-black text-slate-400">
              / 100
            </span>
          </div>

          <p className="mt-5 max-w-2xl text-sm font-medium leading-6 text-slate-300">
            This is your performance on today&apos;s Study Recall Benchmark.
            It is not an IQ test, diagnosis, or permanent measure of memory.
          </p>
        </div>

        <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-black text-slate-950">
            Your recall profile today
          </h2>

          <div className="mt-6 space-y-5">
            {domainEntries.map((domain) => (
              <div key={domain.key}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-black text-slate-900">
                      {domain.label}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {domain.correct} / {domain.maxRaw} correct
                    </p>
                  </div>

                  <p className="text-lg font-black text-slate-950">
                    {formatScore(domain.percentage)}%
                  </p>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(0, Number(domain.percentage) || 0),
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
              Strongest performance today
            </p>

            <p className="mt-3 text-xl font-black text-slate-950">
              {strongestDomains.map((domain) => domain.label).join(" & ")}
            </p>

            <p className="mt-1 font-bold text-slate-600">
              {formatScore(strongestPercentage)}%
            </p>
          </div>

          <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">
              Biggest opportunity today
            </p>

            <p className="mt-3 text-xl font-black text-slate-950">
              {opportunityDomains.map((domain) => domain.label).join(" & ")}
            </p>

            <p className="mt-1 font-bold text-slate-600">
              {formatScore(opportunityPercentage)}%
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Retention check
          </p>

          <h2 className="mt-2 text-xl font-black text-slate-950">
            Part 1 remembered later
          </h2>

          {retentionPercent === null ? (
            <p className="mt-3 font-medium leading-7 text-slate-600">
              A retention ratio cannot be calculated because no Part 1 item
              was scored as correct.
            </p>
          ) : (
            <p className="mt-3 font-medium leading-7 text-slate-600">
              You recalled the equivalent of{" "}
              <span className="font-black text-slate-950">
                {retentionPercent}%
              </span>{" "}
              of your Immediate Recall score during the later memory check.
            </p>
          )}
        </section>

        <section className="mt-6 rounded-[2rem] border border-indigo-200 bg-indigo-50 p-6 text-center sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-indigo-700">
            Your Study Recall Journey
          </p>

          <div className="mt-5 rounded-2xl bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Before training
            </p>

            <p className="mt-2 text-3xl font-black text-slate-950">
              {formatScore(result.totalScore)} / 100 ✓
            </p>
          </div>

          <div className="py-3 text-2xl font-black text-indigo-400">
            ↓
          </div>

          <div className="rounded-2xl border border-dashed border-indigo-300 bg-white/70 p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              After training
            </p>

            <p className="mt-2 text-3xl font-black text-slate-950">
              ? / 100 🔒
            </p>

            <p className="mt-2 text-sm font-bold text-slate-600">
              Complete during the Live Study Memory Lab
            </p>
          </div>
        </section>

        <p className="mt-6 text-center text-xs font-medium leading-5 text-slate-500">
          This educational benchmark reflects performance on these specific
          exercises today and should not be interpreted as a clinical,
          neuropsychological, or medical assessment.
        </p>
      </div>
    </main>
  );
}
