import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { trackEvent } from "../../lib/tracking";
import { getMemoryAssessment } from "../../data/memory/assessmentRegistry";
import MemoryMasterclassOffer from "../../components/memory/MemoryMasterclassOffer";
import MemoryVslModal from "../../components/memory/MemoryVslModal";
import MemoryScoreRescue from "../../components/memory/MemoryScoreRescue";
import { getMemoryScoreBand } from "../../components/memory/memoryScoreBand";
import { getMemoryVslId } from "../../data/memory/masterclassConfig";

const DOMAIN_LABELS = {
  immediate: "Quick Memory",
  ordered: "Remember the Order",
  association: "Match & Remember",
  academic: "Study & Remember",
  delayed: "Remember Later",
};

const DOMAIN_DESCRIPTIONS = {
  immediate: "Remembered right away.",
  ordered: "Remembered the correct order.",
  association: "Remembered what belonged together.",
  academic: "Remembered important details from reading.",
  delayed: "Remembered Part 1 after some time.",
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
  const [vslOpen, setVslOpen] = useState(false);
  const [rescueOpen, setRescueOpen] = useState(false);
  const [scrollAfterVideo, setScrollAfterVideo] = useState(false);
  const savedScoreRef = useRef(null);
  const whatsappFormRef = useRef(null);
  const rescueShown = useRef(false);
  const activeTrackId = result?.trackId || assessment?.trackId || selectedTrack;
  const isAdvancedLead = activeTrackId === "advanced";
  const vimeoId = getMemoryVslId(activeTrackId);
  const scoreBand = getMemoryScoreBand(result?.totalScore, isAdvancedLead);

  function openVsl() {
    setRescueOpen(false);
    if (vimeoId) {
      setVslOpen(true);
    } else {
      setScrollAfterVideo(true);
    }
  }

  function closeVsl() {
    setVslOpen(false);
    setScrollAfterVideo(true);
  }

  function returnToWhatsAppForm() {
    setRescueOpen(false);
    requestAnimationFrame(() => {
      const form = whatsappFormRef.current;
      if (!form) return;
      form.querySelector("input:not([disabled])")?.focus({ preventScroll: true });
      form.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  useEffect(() => {
    if (!scrollAfterVideo || !leadSaved) return;
    const frame = requestAnimationFrame(() => {
      const headline = savedScoreRef.current;
      if (!headline) return;
      headline.focus({ preventScroll: true });
      headline.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
      setScrollAfterVideo(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollAfterVideo, leadSaved]);

  useEffect(() => {
    if (
      !MEMORY_SESSION_PERSISTENCE_ENABLED || !ownerToken ||
      !result?.modules || leadSaved || vslOpen || rescueOpen ||
      rescueShown.current || readSessionValue("memory_score_rescue_shown") === "true"
    ) return;

    function handleExit(event) {
      // A real desktop pointer leaving through the top edge only; never back,
      // touch, tab visibility changes, or movement between page elements.
      if (
        event.relatedTarget !== null || event.clientY > 0 ||
        !window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)").matches
      ) return;
      rescueShown.current = true;
      try {
        window.sessionStorage.setItem("memory_score_rescue_shown", "true");
      } catch {
        // The in-memory guard still prevents repeated prompts on this page.
      }
      setRescueOpen(true);
    }
    document.addEventListener("mouseout", handleExit);
    return () => document.removeEventListener("mouseout", handleExit);
  }, [ownerToken, result, leadSaved, vslOpen, rescueOpen]);

  const [leadForm, setLeadForm] = useState({
    learnerName: "",
    studentClass: "",
    studyCategory: "",
    whatsappNumber: "",
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

    let nextValue = type === "checkbox" ? checked : value;

    if (name === "whatsappNumber") {
      const digits = value.replace(/\D/g, "");

      if (/^91\d{10}$/.test(digits)) {
        nextValue = digits.slice(2);
      } else {
        nextValue = digits.slice(0, 10);
      }
    }

    setLeadForm((current) => ({
      ...current,
      [name]: nextValue,
    }));
  }

  async function submitLead(event) {
    event.preventDefault();

    if (!ownerToken) {
      setLeadError(
        "This test session is not available for saving yet.",
      );
      return;
    }

    if (!leadForm.whatsappConsent) {
      setLeadError(
        "Please confirm that we can send your Study Memory Score to this WhatsApp number.",
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
      openVsl();
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
              Your saved test answers are being scored.
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
            Study Memory Test
          </p>

          <h1 className="mt-4 text-3xl font-black text-slate-950">
            No saved test found
          </h1>

          <p className="mt-4 font-medium leading-7 text-slate-600">
            Complete the test first to generate your Study Memory result.
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

  const allDomainsTied =
    strongestPercentage === opportunityPercentage;

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
            Free Study Memory Test
          </p>

          <h1 className="mt-3 text-3xl font-black sm:text-4xl">
            Your Study Memory Score
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
            This is your <strong>starting score</strong> from today&apos;s
            5 memory challenges. It shows how much you remembered today —
            <strong>not how intelligent you are</strong>.
          </p>
        </div>

        <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-black text-slate-950">
            How you did in each challenge
          </h2>

          <div className="mt-6 space-y-5">
            {domainEntries.map((domain) => (
              <div key={domain.key}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-black text-slate-900">
                      {domain.label}
                    </p>

                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {DOMAIN_DESCRIPTIONS[domain.key]}
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

        {allDomainsTied ? (
          <section className="mt-6 rounded-[2rem] border border-indigo-200 bg-indigo-50 p-6 sm:p-7">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-indigo-700">
              Your starting point today
            </p>

            <h2 className="mt-3 text-xl font-black text-slate-950">
              Your scores were the same across all 5 challenges.
            </h2>

            <p className="mt-3 font-medium leading-7 text-slate-600">
              That gives you a clear starting point. Your Second Study Memory
              Test will show which areas improve.
            </p>
          </section>
        ) : (
          <section className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                You did best at
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
                Best area to improve
              </p>

              <p className="mt-3 text-xl font-black text-slate-950">
                {opportunityDomains.map((domain) => domain.label).join(" & ")}
              </p>

              <p className="mt-1 font-bold text-slate-600">
                {formatScore(opportunityPercentage)}%
              </p>
            </div>
          </section>
        )}

        <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Remember Later
          </p>

          <h2 className="mt-2 text-xl font-black text-slate-950">
            How much of Part 1 stayed in your memory?
          </h2>

          {retentionPercent === null ? (
            <p className="mt-3 font-medium leading-7 text-slate-600">
              We can&apos;t compare Part 1 with the later check yet because no
              Part 1 items were correct in the first check.
              <span className="font-black text-slate-900">
                {" "}That&apos;s okay — this is your starting point.
              </span>
            </p>
          ) : (
            <p className="mt-3 font-medium leading-7 text-slate-600">
              Your later memory score was{" "}
              <span className="font-black text-slate-950">
                {retentionPercent}%
              </span>{" "}
              of your first Part 1 score.
            </p>
          )}
        </section>

        <section className="mt-6 rounded-[2rem] border border-indigo-200 bg-indigo-50 p-6 text-center sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-indigo-700">
            Your Memory Progress
          </p>

          <div className="mt-5 rounded-2xl bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Today
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
              After the live class
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
                {scoreBand && (
                  <div className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-left sm:p-5">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-700">
                      {scoreBand.title}
                    </p>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
                      {scoreBand.message}
                    </p>
                    <p className="mt-3 text-sm font-black leading-6 text-slate-950">
                      {scoreBand.bridge}
                    </p>
                  </div>
                )}
                <p className="text-xs font-black uppercase tracking-[0.14em] text-indigo-700">
                  SAVE YOUR RESULT
                </p>

                <h2 className="mt-3 text-2xl font-black text-slate-950">
                  {isAdvancedLead
                    ? "Save your score & see how to improve it"
                    : "Save this score & see how to improve it"}
                </h2>

                <p className="mt-3 font-medium leading-7 text-slate-600">
                  {isAdvancedLead
                    ? "Enter your WhatsApp number. We’ll save this score on WhatsApp, then show you a short 4-minute video that explains why we forget and how we can remember more."
                    : "Enter a parent or guardian WhatsApp number. We’ll save this score on WhatsApp, then show you a short 4-minute video that explains why students forget and how they can remember more."}
                </p>

                <ul className="mt-4 space-y-2 text-sm font-bold text-indigo-800">
                  {[
                    "Save this score on WhatsApp",
                    isAdvancedLead ? "See why you forget" : "See why students forget",
                    "See how to remember more",
                  ].map((benefit) => <li key={benefit}>✓ {benefit}</li>)}
                </ul>

                <form
                  id="memory-whatsapp-form"
                  ref={whatsappFormRef}
                  className="mt-7 scroll-mt-24 space-y-5"
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
                        Preparing for
                      </label>

                      <select
                        name="studyCategory"
                        value={leadForm.studyCategory}
                        onChange={updateLeadField}
                        required
                        className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-indigo-500"
                      >
                        <option value="">Select your category</option>

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
                  )}

                  <div>
                    <label className="block text-sm font-black text-slate-800">
                      {isAdvancedLead
                        ? "Your WhatsApp number"
                        : "Parent / guardian WhatsApp"}
                    </label>

                    <div className="mt-2 flex overflow-hidden rounded-2xl border border-slate-300 bg-white focus-within:border-indigo-500">
                      <div className="flex shrink-0 items-center gap-2 border-r border-slate-200 bg-slate-50 px-4 font-bold text-slate-700">
                        <span aria-hidden="true">🇮🇳</span>
                        <span>+91</span>
                      </div>

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
                        className="min-w-0 flex-1 px-4 py-3 text-slate-950 outline-none"
                      />
                    </div>
                  </div>


                  <div className="rounded-2xl bg-slate-50 p-4">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        name="whatsappConsent"
                        checked={leadForm.whatsappConsent}
                        onChange={updateLeadField}
                        className="mt-1 h-5 w-5 shrink-0"
                      />

                      <span className="text-sm font-black leading-6 text-slate-800">
                        Send my Study Memory Score to this WhatsApp number.
                      </span>
                    </label>

                    <p className="mt-2 pl-8 text-xs font-medium leading-5 text-slate-500 sm:text-sm">
                      I also agree to receive Memory Masterclass updates,
                      helpful study tips and occasional relevant FluencyJet
                      offers on WhatsApp. I can opt out anytime.
                    </p>
                  </div>

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
                      : "SAVE MY SCORE & SHOW ME HOW →"}
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
            savedScoreRef={savedScoreRef}
            onWatchVideo={openVsl}
            leadDetails={{
              name: leadForm.learnerName,
              email: leadForm.email || "",
              phone: leadForm.whatsappNumber,
            }}
          />
        )}

        {vslOpen && vimeoId && (
          <MemoryVslModal vimeoId={vimeoId} isAdvanced={isAdvancedLead} onClose={closeVsl} />
        )}
        {rescueOpen && !leadSaved && !vslOpen && (
          <MemoryScoreRescue
            isAdvanced={isAdvancedLead}
            onClose={() => setRescueOpen(false)}
            onSave={returnToWhatsAppForm}
          />
        )}

        <p className="mt-6 text-center text-xs font-medium leading-5 text-slate-500">
          This educational memory test shows your performance on these
          challenges today. It is not an IQ test, medical test or diagnosis.
        </p>
      </div>
    </main>
  );
}
