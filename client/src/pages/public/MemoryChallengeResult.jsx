import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { trackEvent } from "../../lib/tracking";
import { getMemoryAssessment } from "../../data/memory/assessmentRegistry";
import MemoryMasterclassOffer from "../../components/memory/MemoryMasterclassOffer";

const DOMAIN_LABELS = {
  immediate: "Immediate Recall",
  ordered: "Ordered Recall",
  association: "Association Recall",
  academic: "Academic Recall",
  delayed: "Delayed Recall",
};

const MEMORY_SESSION_PERSISTENCE_ENABLED =
  import.meta.env.VITE_MEMORY_SESSION_PERSISTENCE_ENABLED === "true";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

function readSessionJson(key, fallback) {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function readSessionValue(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
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
  const selectedTrack =
    readSessionValue("memory_track");

  const assessment =
    getMemoryAssessment(selectedTrack);

  const [result, setResult] = useState(() => readStoredResult());
  const [status, setStatus] = useState(result ? "ready" : "recovering");
  const [errorMessage, setErrorMessage] = useState("");

  const [ownerToken] = useState(() =>
    readSessionValue("memory_form_a_owner_token"),
  );

  const [leadSaved, setLeadSaved] = useState(
    () => readSessionValue("memory_form_a_lead_saved") === "true",
  );

  const [leadStatus, setLeadStatus] = useState("idle");
  const [leadError, setLeadError] = useState("");

  const [leadForm, setLeadForm] = useState({
    learnerName: "",
    studentClass: "",
    studyCategory: "",
    parentGuardianName: "",
    whatsappNumber: "",
    email: "",
    state: "",
    whatsappConsent: false,
  });

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
      const response = await fetch(`${API_BASE}/api/memory/score`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trackId: assessment?.trackId || selectedTrack,
          form: assessment?.form || "A",
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

  function updateLeadField(event) {
    const { name, value, type, checked } = event.target;

    setLeadForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function submitLead(event) {
    event.preventDefault();

    if (!ownerToken) {
      setLeadError(
        "This benchmark session is not available for saving yet.",
      );
      return;
    }

    setLeadStatus("saving");
    setLeadError("");

    try {
      const response = await fetch(`${API_BASE}/api/memory/session/lead`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ownerToken,
          ...leadForm,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok || !payload?.lead?.saved) {
        throw new Error(
          payload?.message || "Unable to save your report details.",
        );
      }

      try {
        window.sessionStorage.setItem(
          "memory_form_a_lead_saved",
          "true",
        );
      } catch {
        // Success can still be shown if browser storage is unavailable.
      }

      setLeadSaved(true);
      setLeadStatus("saved");

      trackEvent("memory_lead", {
        funnel: "amaze_memory",
        track: result?.trackId || assessment?.trackId || selectedTrack,
        form: result?.form || assessment?.form || "A",
      });
    } catch (error) {
      console.error("Memory lead capture failed:", error);

      setLeadError(
        error instanceof Error
          ? error.message
          : "Unable to save your report details.",
      );

      setLeadStatus("error");
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

  const isAdvancedLead =
    assessment?.leadType === "advanced";

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
              Take your Second Study Memory Test after the live class
            </p>
          </div>
        </section>

        {MEMORY_SESSION_PERSISTENCE_ENABLED && ownerToken && !leadSaved && (
          <section className="mt-6 rounded-[2rem] border border-indigo-200 bg-white p-6 shadow-sm sm:p-8">
              <>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-indigo-700">
                  Save your Study Memory Score
                </p>

                <h2 className="mt-3 text-2xl font-black text-slate-950">
                  Save this report &amp; continue
                </h2>

                <p className="mt-3 font-medium leading-7 text-slate-600">
                  {isAdvancedLead
                    ? "Add your details so this benchmark can stay connected to your Study Recall journey."
                    : "Add a parent or guardian contact so your Study Memory Score can stay connected to this journey."}
                </p>

                <form
                  className="mt-7 space-y-5"
                  onSubmit={submitLead}
                >
                  <div>
                    <label className="block text-sm font-black text-slate-800">
                      {isAdvancedLead ? "Your name" : "Student name"}
                    </label>
                    <input
                      type="text"
                      name="learnerName"
                      value={leadForm.learnerName}
                      onChange={updateLeadField}
                      required
                      maxLength={100}
                      autoComplete="name"
                      className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-950 outline-none focus:border-indigo-500"
                    />
                  </div>

                  {isAdvancedLead ? (
                    <div>
                      <label className="block text-sm font-black text-slate-800">
                        Study / exam category
                      </label>

                      <select
                        name="studyCategory"
                        value={leadForm.studyCategory}
                        onChange={updateLeadField}
                        required
                        className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-indigo-500"
                      >
                        <option value="">
                          Select your category
                        </option>

                        {(assessment?.studyCategories || []).map(
                          (category) => (
                            <option
                              key={category.value}
                              value={category.value}
                            >
                              {category.label}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-black text-slate-800">
                          Class
                        </label>

                        <select
                          name="studentClass"
                          value={leadForm.studentClass}
                          onChange={updateLeadField}
                          required
                          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-indigo-500"
                        >
                          <option value="">Select class</option>

                          {(assessment?.studentClasses || []).map(
                            (studentClass) => (
                              <option
                                key={studentClass}
                                value={studentClass}
                              >
                                Class {studentClass}
                              </option>
                            ),
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-black text-slate-800">
                          Parent / guardian name
                        </label>

                        <input
                          type="text"
                          name="parentGuardianName"
                          value={leadForm.parentGuardianName}
                          onChange={updateLeadField}
                          required
                          maxLength={100}
                          autoComplete="name"
                          className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-950 outline-none focus:border-indigo-500"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-black text-slate-800">
                      {isAdvancedLead
                        ? "Your WhatsApp number"
                        : "Parent / guardian WhatsApp"}
                    </label>
                    <input
                      type="tel"
                      name="whatsappNumber"
                      value={leadForm.whatsappNumber}
                      onChange={updateLeadField}
                      required
                      maxLength={30}
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="98765 43210"
                      className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-950 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-black text-slate-800">
                      State
                    </label>
                    <input
                      type="text"
                      name="state"
                      value={leadForm.state}
                      onChange={updateLeadField}
                      required
                      maxLength={100}
                      autoComplete="address-level1"
                      className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-950 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-black text-slate-800">
                      Email{" "}
                      <span className="font-medium text-slate-500">
                        (optional)
                      </span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={leadForm.email}
                      onChange={updateLeadField}
                      maxLength={191}
                      autoComplete="email"
                      className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-950 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
                    <input
                      type="checkbox"
                      name="whatsappConsent"
                      checked={leadForm.whatsappConsent}
                      onChange={updateLeadField}
                      required
                      className="mt-1 h-4 w-4"
                    />

                    <span className="text-sm font-medium leading-6 text-slate-600">
                      I agree to receive my benchmark report and Study Memory
                      Lab updates on WhatsApp.
                    </span>
                  </label>

                  {leadError && (
                    <p className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
                      {leadError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={leadStatus === "saving"}
                    className="w-full rounded-2xl bg-indigo-600 px-6 py-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {leadStatus === "saving"
                      ? "Saving..."
                      : "Save My Report"}
                  </button>
                </form>
              </>
          </section>
        )}

        {leadSaved && result && (
          <MemoryMasterclassOffer
            trackId={result.trackId || assessment?.trackId || selectedTrack}
            score={result.totalScore}
            ownerToken={ownerToken}
          />
        )}

        <p className="mt-6 text-center text-xs font-medium leading-5 text-slate-500">
          This educational benchmark reflects performance on these specific
          exercises today and should not be interpreted as a clinical,
          neuropsychological, or medical assessment.
        </p>
      </div>
    </main>
  );
}
