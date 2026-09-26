import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMemoryAssessment } from "../../data/memory/assessmentRegistry";
import { trackEvent } from "../../lib/tracking";
import ReorderExerciseCard from "../../components/practice/ReorderExerciseCard";

const MEMORY_SESSION_PERSISTENCE_ENABLED =
  import.meta.env.VITE_MEMORY_SESSION_PERSISTENCE_ENABLED === "true";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

function getSelectedTrack() {
  try {
    return window.sessionStorage.getItem("memory_track");
  } catch {
    return null;
  }
}

function readSessionJson(key, fallback) {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeRecallValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function makeOrderedRecallTiles(module) {
  const byId = new Map(
    (module?.items || []).map((item) => [item.id, item]),
  );

  const recallOrder =
    Array.isArray(module?.recallOrder) && module.recallOrder.length
      ? module.recallOrder
      : (module?.items || []).map((item) => item.id);

  return recallOrder
    .map((id) => byId.get(id))
    .filter(Boolean);
}

export default function MemoryChallengeTest() {
  const navigate = useNavigate();

  const [scoringError, setScoringError] = useState("");

  const [selectedTrack] = useState(() => getSelectedTrack());

  const assessment = useMemo(
    () => getMemoryAssessment(selectedTrack),
    [selectedTrack],
  );

  // Use the foundation config only as a safe initialization fallback.
  // Unsupported tracks are blocked before the assessment UI is rendered.
  const assessmentConfig =
    assessment?.config || getMemoryAssessment("school_foundation").config;

  const immediateModule = useMemo(
    () =>
      assessmentConfig.modules.find(
        (module) => module.id === "immediate",
      ),
    [assessmentConfig],
  );

  const orderedModule = useMemo(
    () =>
      assessmentConfig.modules.find(
        (module) => module.id === "ordered",
      ),
    [assessmentConfig],
  );

  const associationModule = useMemo(
    () =>
      assessmentConfig.modules.find(
        (module) => module.id === "association",
      ),
    [assessmentConfig],
  );

  const academicModule = useMemo(
    () =>
      assessmentConfig.modules.find(
        (module) => module.id === "academic",
      ),
    [assessmentConfig],
  );

  const delayedModule = useMemo(
    () =>
      assessmentConfig.modules.find(
        (module) => module.id === "delayed",
      ),
    [assessmentConfig],
  );

  const [phase, setPhase] = useState("intro");

  const [studySecondsRemaining, setStudySecondsRemaining] = useState(
    immediateModule.studySeconds,
  );

  const [recallSecondsRemaining, setRecallSecondsRemaining] = useState(
    immediateModule.recallSeconds,
  );

  const [orderedStudySecondsRemaining, setOrderedStudySecondsRemaining] =
    useState(orderedModule.studySeconds);

  const [orderedRecallSecondsRemaining, setOrderedRecallSecondsRemaining] =
    useState(orderedModule.recallSeconds);

  const [associationStudySecondsRemaining, setAssociationStudySecondsRemaining] =
    useState(associationModule.studySeconds);

  const [associationRecallSecondsRemaining, setAssociationRecallSecondsRemaining] =
    useState(associationModule.recallSeconds);

  const [academicStudySecondsRemaining, setAcademicStudySecondsRemaining] =
    useState(academicModule.studySeconds);

  const [delayedRecallSecondsRemaining, setDelayedRecallSecondsRemaining] =
    useState(delayedModule.recallSeconds);

  const [associationAnswers, setAssociationAnswers] = useState({});
  const [academicAnswers, setAcademicAnswers] = useState({});

  const [delayedRecallInput, setDelayedRecallInput] = useState("");
  const [delayedRecalledItems, setDelayedRecalledItems] = useState([]);

  const [orderedTiles, setOrderedTiles] = useState(() =>
    makeOrderedRecallTiles(orderedModule),
  );

  const [orderedAnswer, setOrderedAnswer] = useState([]);

  const [recallInput, setRecallInput] = useState("");
  const [recalledItems, setRecalledItems] = useState([]);

  const testStartedTracked = useRef(false);
  const moduleCompletedTracked = useRef(false);
  const orderedModuleCompletedTracked = useRef(false);
  const associationModuleCompletedTracked = useRef(false);
  const academicModuleCompletedTracked = useRef(false);
  const delayedModuleCompletedTracked = useRef(false);

  /* -----------------------------------------
     30-second study countdown
  ----------------------------------------- */
  useEffect(() => {
    if (phase !== "study") return;

    if (studySecondsRemaining <= 0) {
      setPhase("recall_ready");
      return;
    }

    const timer = window.setTimeout(() => {
      setStudySecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [phase, studySecondsRemaining]);

  /* -----------------------------------------
     60-second recall countdown
  ----------------------------------------- */
  useEffect(() => {
    if (phase !== "recall") return;

    const timer = window.setInterval(() => {
      setRecallSecondsRemaining((current) =>
        current <= 1 ? 0 : current - 1,
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase]);

  /* -----------------------------------------
     20-second ordered study countdown
  ----------------------------------------- */
  useEffect(() => {
    if (phase !== "ordered_study") return;

    if (orderedStudySecondsRemaining <= 0) {
      setPhase("ordered_recall_ready");
      return;
    }

    const timer = window.setTimeout(() => {
      setOrderedStudySecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [phase, orderedStudySecondsRemaining]);

  /* -----------------------------------------
     40-second ordered recall countdown
  ----------------------------------------- */
  useEffect(() => {
    if (phase !== "ordered_recall") return;

    if (orderedRecallSecondsRemaining <= 0) {
      finishOrderedRecall();
      return;
    }

    const timer = window.setTimeout(() => {
      setOrderedRecallSecondsRemaining((current) =>
        Math.max(0, current - 1),
      );
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [phase, orderedRecallSecondsRemaining]);

  /* -----------------------------------------
     40-second association study countdown
  ----------------------------------------- */
  useEffect(() => {
    if (phase !== "association_study") return;

    if (associationStudySecondsRemaining <= 0) {
      setPhase("association_recall_ready");
      return;
    }

    const timer = window.setTimeout(() => {
      setAssociationStudySecondsRemaining((current) =>
        Math.max(0, current - 1),
      );
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [phase, associationStudySecondsRemaining]);

  /* -----------------------------------------
     45-second association recall countdown
  ----------------------------------------- */
  useEffect(() => {
    if (phase !== "association_recall") return;

    if (associationRecallSecondsRemaining <= 0) {
      finishAssociationRecall();
      return;
    }

    const timer = window.setTimeout(() => {
      setAssociationRecallSecondsRemaining((current) =>
        Math.max(0, current - 1),
      );
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [phase, associationRecallSecondsRemaining]);

  /* -----------------------------------------
     60-second academic study countdown
  ----------------------------------------- */
  useEffect(() => {
    if (phase !== "academic_study") return;

    if (academicStudySecondsRemaining <= 0) {
      setPhase("academic_recall_ready");
      return;
    }

    const timer = window.setTimeout(() => {
      setAcademicStudySecondsRemaining((current) =>
        Math.max(0, current - 1),
      );
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [phase, academicStudySecondsRemaining]);

  /* -----------------------------------------
     60-second delayed recall countdown
  ----------------------------------------- */
  useEffect(() => {
    if (phase !== "delayed_recall") return;

    if (delayedRecallSecondsRemaining <= 0) {
      finishDelayedRecall();
      return;
    }

    const timer = window.setTimeout(() => {
      setDelayedRecallSecondsRemaining((current) =>
        Math.max(0, current - 1),
      );
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [phase, delayedRecallSecondsRemaining]);

  /* -----------------------------------------
     Auto-submit recall at zero
  ----------------------------------------- */
  useEffect(() => {
    if (phase === "recall" && recallSecondsRemaining === 0) {
      finishImmediateRecall();
    }
  }, [phase, recallSecondsRemaining]);

  function startImmediateStudy() {
    try {
      window.sessionStorage.removeItem("memory_form_a_public_token");
      window.sessionStorage.removeItem("memory_form_a_owner_token");
      window.sessionStorage.removeItem("memory_form_a_lead_saved");
    } catch {
      // The benchmark can continue even if sessionStorage is unavailable.
    }

    setStudySecondsRemaining(immediateModule.studySeconds);
    setPhase("study");

    if (!testStartedTracked.current) {
      testStartedTracked.current = true;

      trackEvent("memory_test_started", {
        funnel: "amaze_memory",
        track: assessmentConfig.trackId,
        form: assessmentConfig.form,
      });
    }
  }

  function startImmediateRecall() {
    setRecallInput("");
    setRecalledItems([]);
    setRecallSecondsRemaining(immediateModule.recallSeconds);
    setPhase("recall");
  }

  function addRecallItem() {
    if (phase !== "recall") return;
    if (recalledItems.length >= immediateModule.scoring.maxRaw) return;

    const rawValue = recallInput.trim();
    const normalizedValue = normalizeRecallValue(rawValue);

    if (!normalizedValue) return;

    const alreadyAdded = recalledItems.some(
      (item) => normalizeRecallValue(item) === normalizedValue,
    );

    if (alreadyAdded) {
      setRecallInput("");
      return;
    }

    setRecalledItems((current) => [...current, rawValue]);
    setRecallInput("");
  }

  function removeRecallItem(index) {
    if (phase !== "recall") return;

    setRecalledItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  function startOrderedStudy() {
    setOrderedStudySecondsRemaining(orderedModule.studySeconds);
    setPhase("ordered_study");
  }

  function startAssociationStudy() {
    setAssociationStudySecondsRemaining(associationModule.studySeconds);
    setPhase("association_study");
  }

  function startAcademicStudy() {
    setAcademicStudySecondsRemaining(academicModule.studySeconds);
    setPhase("academic_study");
  }

  function startAcademicRecall() {
    setAcademicAnswers({});
    setPhase("academic_recall");
  }

  function startDelayedRecall() {
    setDelayedRecallInput("");
    setDelayedRecalledItems([]);
    setDelayedRecallSecondsRemaining(delayedModule.recallSeconds);
    setPhase("delayed_recall");
  }

  function addDelayedRecallItem() {
    if (phase !== "delayed_recall") return;
    if (delayedRecalledItems.length >= delayedModule.scoring.maxRaw) return;

    const rawValue = delayedRecallInput.trim();
    const normalizedValue = normalizeRecallValue(rawValue);

    if (!normalizedValue) return;

    const alreadyAdded = delayedRecalledItems.some(
      (item) => normalizeRecallValue(item) === normalizedValue,
    );

    if (alreadyAdded) {
      setDelayedRecallInput("");
      return;
    }

    setDelayedRecalledItems((current) => [...current, rawValue]);
    setDelayedRecallInput("");
  }

  function removeDelayedRecallItem(index) {
    if (phase !== "delayed_recall") return;

    setDelayedRecalledItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  async function submitAssessmentForScoring() {
    setScoringError("");
    setPhase("scoring");

    const responses = {
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

    try {
      let result = null;

      if (MEMORY_SESSION_PERSISTENCE_ENABLED) {
        try {
          const sessionResponse = await fetch(`${API_BASE}/api/memory/session`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              trackId: assessmentConfig.trackId,
              form: assessmentConfig.form,
              responses,
            }),
          });

          const sessionPayload = await sessionResponse
            .json()
            .catch(() => null);

          if (
            !sessionResponse.ok ||
            !sessionPayload?.ok ||
            !sessionPayload?.session?.result ||
            !sessionPayload?.session?.publicToken ||
            !sessionPayload?.session?.ownerToken
          ) {
            throw new Error(
              sessionPayload?.message ||
                "Unable to save this benchmark session.",
            );
          }

          result = sessionPayload.session.result;

          try {
            window.sessionStorage.setItem(
              "memory_form_a_public_token",
              sessionPayload.session.publicToken,
            );

            window.sessionStorage.setItem(
              "memory_form_a_owner_token",
              sessionPayload.session.ownerToken,
            );
          } catch {
            // The result can still be shown if browser storage is unavailable.
          }
        } catch (sessionError) {
          console.error(
            "Memory session persistence failed; falling back to scoring:",
            sessionError,
          );
        }
      }

      if (!result) {
        const response = await fetch(`${API_BASE}/api/memory/score`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            trackId: assessmentConfig.trackId,
            form: assessmentConfig.form,
            responses,
          }),
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.ok || !payload?.result) {
          throw new Error(
            payload?.message || "Unable to score your benchmark.",
          );
        }

        result = payload.result;
      }

      try {
        window.sessionStorage.setItem(
          "memory_form_a_result",
          JSON.stringify(result),
        );
      } catch {
        // Navigation can continue even if result persistence fails.
      }

      trackEvent("memory_test_completed", {
        funnel: "amaze_memory",
        track: assessmentConfig.trackId,
        form: assessmentConfig.form,
        score: result.totalScore,
      });

      navigate("/memory-challenge/result");
    } catch (error) {
      console.error("Memory benchmark scoring failed:", error);

      setScoringError(
        "We could not calculate your result right now. Your answers are still saved in this browser.",
      );

      setPhase("scoring_error");
    }
  }

  async function finishDelayedRecall() {
    if (phase !== "delayed_recall") return;

    try {
      window.sessionStorage.setItem(
        "memory_form_a_delayed_answers",
        JSON.stringify(delayedRecalledItems),
      );
    } catch {
      // Assessment can continue if browser storage is unavailable.
    }

    if (!delayedModuleCompletedTracked.current) {
      delayedModuleCompletedTracked.current = true;

      trackEvent("memory_module_completed", {
        funnel: "amaze_memory",
        track: assessmentConfig.trackId,
        form: assessmentConfig.form,
        module: delayedModule.id,
        answer_count: delayedRecalledItems.length,
      });
    }

    await submitAssessmentForScoring();
  }

  function updateAcademicAnswer(questionId, value) {
    if (phase !== "academic_recall") return;

    setAcademicAnswers((current) => ({
      ...current,
      [questionId]: value,
    }));
  }

  function finishAcademicRecall() {
    if (phase !== "academic_recall") return;

    const cleanAnswers = Object.fromEntries(
      Object.entries(academicAnswers)
        .map(([key, value]) => [key, String(value || "").trim()])
        .filter(([, value]) => value !== ""),
    );

    try {
      window.sessionStorage.setItem(
        "memory_form_a_academic_answers",
        JSON.stringify(cleanAnswers),
      );
    } catch {
      // Assessment can continue if browser storage is unavailable.
    }

    if (!academicModuleCompletedTracked.current) {
      academicModuleCompletedTracked.current = true;

      trackEvent("memory_module_completed", {
        funnel: "amaze_memory",
        track: assessmentConfig.trackId,
        form: assessmentConfig.form,
        module: academicModule.id,
        answer_count: Object.keys(cleanAnswers).length,
      });
    }

    setPhase("academic_complete");
  }

  function startAssociationRecall() {
    setAssociationAnswers({});
    setAssociationRecallSecondsRemaining(associationModule.recallSeconds);
    setPhase("association_recall");
  }

  function updateAssociationAnswer(pairId, value) {
    if (phase !== "association_recall") return;

    const numericValue = String(value || "")
      .replace(/\D/g, "")
      .slice(0, 3);

    setAssociationAnswers((current) => ({
      ...current,
      [pairId]: numericValue,
    }));
  }

  function finishAssociationRecall() {
    if (phase !== "association_recall") return;

    const cleanAnswers = Object.fromEntries(
      Object.entries(associationAnswers).filter(
        ([, value]) => String(value || "").trim() !== "",
      ),
    );

    try {
      window.sessionStorage.setItem(
        "memory_form_a_association_answers",
        JSON.stringify(cleanAnswers),
      );
    } catch {
      // Assessment can continue if browser storage is unavailable.
    }

    if (!associationModuleCompletedTracked.current) {
      associationModuleCompletedTracked.current = true;

      trackEvent("memory_module_completed", {
        funnel: "amaze_memory",
        track: assessmentConfig.trackId,
        form: assessmentConfig.form,
        module: associationModule.id,
        answer_count: Object.keys(cleanAnswers).length,
      });
    }

    setPhase("association_complete");
  }

  function startOrderedRecall() {
    setOrderedTiles(makeOrderedRecallTiles(orderedModule));
    setOrderedAnswer([]);
    setOrderedRecallSecondsRemaining(orderedModule.recallSeconds);
    setPhase("ordered_recall");
  }

  function handleOrderedTileClick(tile, index) {
    if (phase !== "ordered_recall") return;

    setOrderedTiles((current) =>
      current.filter((_, tileIndex) => tileIndex !== index),
    );

    setOrderedAnswer((current) => [...current, tile]);
  }

  function handleOrderedAnswerClick(tile, index) {
    if (phase !== "ordered_recall") return;

    setOrderedAnswer((current) =>
      current.filter((_, answerIndex) => answerIndex !== index),
    );

    setOrderedTiles((current) => [...current, tile]);
  }

  function resetOrderedRecall() {
    if (phase !== "ordered_recall") return;

    setOrderedTiles(makeOrderedRecallTiles(orderedModule));
    setOrderedAnswer([]);
  }

  function finishOrderedRecall() {
    if (phase !== "ordered_recall") return;

    const submittedOrder = orderedAnswer.map((item) => item.id);

    try {
      window.sessionStorage.setItem(
        "memory_form_a_ordered_answers",
        JSON.stringify(submittedOrder),
      );
    } catch {
      // Assessment can continue if browser storage is unavailable.
    }

    if (!orderedModuleCompletedTracked.current) {
      orderedModuleCompletedTracked.current = true;

      trackEvent("memory_module_completed", {
        funnel: "amaze_memory",
        track: assessmentConfig.trackId,
        form: assessmentConfig.form,
        module: orderedModule.id,
        answer_count: submittedOrder.length,
      });
    }

    setPhase("ordered_complete");
  }

  function finishImmediateRecall() {
    if (phase !== "recall") return;

    try {
      window.sessionStorage.setItem(
        "memory_form_a_immediate_answers",
        JSON.stringify(recalledItems),
      );
    } catch {
      // Assessment can continue even if browser storage is unavailable.
    }

    if (!moduleCompletedTracked.current) {
      moduleCompletedTracked.current = true;

      trackEvent("memory_module_completed", {
        funnel: "amaze_memory",
        track: assessmentConfig.trackId,
        form: assessmentConfig.form,
        module: immediateModule.id,
        answer_count: recalledItems.length,
      });
    }

    setPhase("module_complete");
  }

  if (!assessment) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-7 text-center shadow-sm">
          <h1 className="text-2xl font-black text-slate-950">
            Start from the learner-group page
          </h1>

          <p className="mt-3 leading-7 text-slate-600">
            Select your learner group before beginning this benchmark.
          </p>

          <a
            href="/memory-challenge"
            className="mt-6 inline-flex rounded-2xl bg-indigo-600 px-6 py-3 font-black text-white"
          >
            Choose learner group
          </a>
        </div>
      </main>
    );
  }

  /* -----------------------------------------
     INTRO
  ----------------------------------------- */
  if (phase === "intro") {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)] sm:p-9">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-indigo-600">
                Part 1 of 5
              </p>

              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                Immediate Recall
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Study {immediateModule.scoring.maxRaw} items
            </h1>

            <p className="mt-4 text-base font-medium leading-7 text-slate-600">
              You will have {immediateModule.studySeconds} seconds to study
              them. When the timer ends, all{" "}
              {immediateModule.scoring.maxRaw} items will disappear.
            </p>

            <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm font-medium leading-6 text-amber-900">
              Do not write the items down or take a screenshot. Just study them
              carefully and try to remember as many as possible.
            </div>

            <button
              type="button"
              onClick={startImmediateStudy}
              className="mt-7 w-full rounded-2xl bg-indigo-600 px-6 py-4 text-base font-black text-white transition hover:bg-indigo-700"
            >
              Start {immediateModule.studySeconds}-Second Study
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* -----------------------------------------
     STUDY
  ----------------------------------------- */
  if (phase === "study") {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 sm:py-10">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-300">
                Part 1 of 5
              </p>

              <h1 className="mt-1 text-2xl font-black sm:text-3xl">
                Immediate Recall
              </h1>
            </div>

            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-indigo-400 bg-slate-900 text-xl font-black">
              {studySecondsRemaining}
            </div>
          </div>

          <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-indigo-400 transition-[width] duration-1000 ease-linear"
              style={{
                width: `${
                  (studySecondsRemaining /
                    immediateModule.studySeconds) *
                  100
                }%`,
              }}
            />
          </div>

          <p className="mt-6 text-center text-base font-bold text-slate-300">
            {immediateModule.instructions.study}
          </p>

          <section className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
            {immediateModule.items.map((item) => (
              <div
                key={item.id}
                className="flex min-h-[110px] items-center justify-center rounded-[1.5rem] border border-slate-700 bg-slate-900 p-4 text-center shadow-lg"
              >
                <span className="text-lg font-black sm:text-xl">
                  {item.label}
                </span>
              </div>
            ))}
          </section>

          <p className="mt-7 text-center text-sm font-medium text-slate-400">
            Keep studying until the timer ends.
          </p>
        </div>
      </main>
    );
  }

  /* -----------------------------------------
     RECALL READY
  ----------------------------------------- */
  if (phase === "recall_ready") {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
          <div className="w-full text-center">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-indigo-300">
              Part 1 of 5
            </p>

            <h1 className="mt-4 text-3xl font-black sm:text-4xl">
              Now recall the items
            </h1>

            <p className="mt-4 text-base font-medium leading-7 text-slate-300">
              The study items are hidden. You will have{" "}
              {immediateModule.recallSeconds} seconds to enter as many as you
              remember.
            </p>

            <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-sm font-medium leading-6 text-slate-300">
              Order does not matter. Enter one item at a time. You will not be
              shown whether an answer is correct.
            </div>

            <button
              type="button"
              onClick={startImmediateRecall}
              className="mt-7 w-full rounded-2xl bg-indigo-500 px-6 py-4 font-black text-white transition hover:bg-indigo-400"
            >
              Start 60-Second Recall
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* -----------------------------------------
     RECALL
  ----------------------------------------- */
  if (phase === "recall") {
    const maxItems = immediateModule.scoring.maxRaw;

    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-600">
                Part 1 of 5
              </p>

              <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">
                What do you remember?
              </h1>
            </div>

            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-indigo-500 bg-white text-xl font-black text-slate-950">
              {recallSecondsRemaining}
            </div>
          </div>

          <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-indigo-500 transition-[width] duration-1000 ease-linear"
              style={{
                width: `${
                  (recallSecondsRemaining /
                    immediateModule.recallSeconds) *
                  100
                }%`,
              }}
            />
          </div>

          <div className="mt-7 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <p className="font-black text-slate-950">
              Enter one remembered item at a time
            </p>

            <p className="mt-1 text-sm font-medium text-slate-500">
              {recalledItems.length} of {maxItems} entered
            </p>

            <form
              className="mt-5 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                addRecallItem();
              }}
            >
              <input
                autoFocus
                type="text"
                value={recallInput}
                onChange={(event) => setRecallInput(event.target.value)}
                disabled={recalledItems.length >= maxItems}
                placeholder="Type an item you remember"
                autoComplete="off"
                className="min-w-0 flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-4 text-base font-bold text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100"
              />

              <button
                type="submit"
                disabled={
                  !recallInput.trim() ||
                  recalledItems.length >= maxItems
                }
                className="rounded-2xl bg-indigo-600 px-5 py-4 font-black text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Add
              </button>
            </form>

            {recalledItems.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {recalledItems.map((item, index) => (
                  <button
                    key={`${normalizeRecallValue(item)}-${index}`}
                    type="button"
                    onClick={() => removeRecallItem(index)}
                    className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-black text-indigo-800"
                    title="Tap to remove"
                  >
                    {item} ×
                  </button>
                ))}
              </div>
            )}

            <p className="mt-5 text-xs font-medium leading-5 text-slate-500">
              Duplicate entries are ignored. No correctness feedback is shown
              during the benchmark.
            </p>

            <button
              type="button"
              onClick={finishImmediateRecall}
              className="mt-7 w-full rounded-2xl border border-slate-300 bg-white px-6 py-4 font-black text-slate-800 transition hover:bg-slate-50"
            >
              Finish Part 1
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* -----------------------------------------
     PART 1 COMPLETE
  ----------------------------------------- */
  if (phase === "module_complete") {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
          <div className="w-full text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-3xl">
              ✓
            </div>

            <p className="mt-6 text-sm font-black uppercase tracking-[0.16em] text-indigo-300">
              Part 1 of 5 completed
            </p>

            <h1 className="mt-4 text-3xl font-black sm:text-4xl">
              Immediate Recall recorded
            </h1>

            <p className="mt-4 text-base font-medium leading-7 text-slate-300">
              Your responses have been saved for scoring later. No answers are
              revealed during Form A.
            </p>

            <button
              type="button"
              onClick={() => setPhase("ordered_intro")}
              className="mt-8 w-full rounded-2xl bg-indigo-500 px-6 py-4 font-black text-white transition hover:bg-indigo-400"
            >
              Continue to Part 2
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* -----------------------------------------
     ORDERED RECALL INTRO
  ----------------------------------------- */
  if (phase === "ordered_intro") {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)] sm:p-9">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-indigo-600">
                Part 2 of 5
              </p>

              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                Ordered Recall
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Remember the exact order
            </h1>

            <p className="mt-4 text-base font-medium leading-7 text-slate-600">
              You will have {orderedModule.studySeconds} seconds to study 6
              items in sequence.
            </p>

            <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm font-medium leading-6 text-amber-900">
              Remember both the items and their positions. After the timer ends,
              the sequence will disappear.
            </div>

            <button
              type="button"
              onClick={startOrderedStudy}
              className="mt-7 w-full rounded-2xl bg-indigo-600 px-6 py-4 text-base font-black text-white transition hover:bg-indigo-700"
            >
              Start 20-Second Study
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* -----------------------------------------
     ORDERED RECALL STUDY
  ----------------------------------------- */
  if (phase === "ordered_study") {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 sm:py-10">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-300">
                Part 2 of 5
              </p>

              <h1 className="mt-1 text-2xl font-black sm:text-3xl">
                Ordered Recall
              </h1>
            </div>

            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-indigo-400 bg-slate-900 text-xl font-black">
              {orderedStudySecondsRemaining}
            </div>
          </div>

          <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-indigo-400 transition-[width] duration-1000 ease-linear"
              style={{
                width: `${
                  (orderedStudySecondsRemaining /
                    orderedModule.studySeconds) *
                  100
                }%`,
              }}
            />
          </div>

          <p className="mt-6 text-center text-base font-bold text-slate-300">
            {orderedModule.instructions.study}
          </p>

          <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {orderedModule.items.map((item, index) => (
              <div
                key={item.id}
                className="rounded-[1.5rem] border border-slate-700 bg-slate-900 p-5 shadow-lg"
              >
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-400 text-sm font-black text-slate-950">
                  {index + 1}
                </div>

                <p className="text-center text-xl font-black">
                  {item.label}
                </p>
              </div>
            ))}
          </section>

          <p className="mt-7 text-center text-sm font-medium text-slate-400">
            Remember the exact sequence from 1 to 6.
          </p>
        </div>
      </main>
    );
  }

  /* -----------------------------------------
     ORDERED RECALL READY
  ----------------------------------------- */
  if (phase === "ordered_recall_ready") {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
          <div className="w-full text-center">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-indigo-300">
              Part 2 of 5
            </p>

            <h1 className="mt-4 text-3xl font-black sm:text-4xl">
              Now rebuild the sequence
            </h1>

            <p className="mt-4 text-base font-medium leading-7 text-slate-300">
              The original sequence is hidden. You will have{" "}
              {orderedModule.recallSeconds} seconds to arrange the shuffled
              cards into the order you remember.
            </p>

            <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-sm font-medium leading-6 text-slate-300">
              You will not be told which positions are correct during Form A.
            </div>

            <button
              type="button"
              onClick={startOrderedRecall}
              className="mt-7 w-full rounded-2xl bg-indigo-500 px-6 py-4 font-black text-white transition hover:bg-indigo-400"
            >
              Start 40-Second Reorder
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* -----------------------------------------
     ORDERED RECALL
  ----------------------------------------- */
  if (phase === "ordered_recall") {
    const allPlaced =
      orderedAnswer.length === orderedModule.scoring.maxRaw;

    const footer = (
      <div className="mt-5 space-y-3">
        <button
          type="button"
          disabled={!allPlaced}
          onClick={finishOrderedRecall}
          className="w-full rounded-2xl bg-indigo-600 px-5 py-4 font-black text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Finish Part 2
        </button>

        {orderedAnswer.length > 0 && (
          <button
            type="button"
            onClick={resetOrderedRecall}
            className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50"
          >
            Reset sequence
          </button>
        )}

        {!allPlaced && (
          <p className="text-center text-xs font-bold text-slate-500">
            Arrange all 6 cards to finish early. If time runs out, your current
            sequence will be recorded automatically.
          </p>
        )}
      </div>
    );

    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-600">
                Part 2 of 5
              </p>

              <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">
                Rebuild the sequence
              </h1>
            </div>

            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-indigo-500 bg-white text-xl font-black text-slate-950">
              {orderedRecallSecondsRemaining}
            </div>
          </div>

          <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-indigo-500 transition-[width] duration-1000 ease-linear"
              style={{
                width: `${
                  (orderedRecallSecondsRemaining /
                    orderedModule.recallSeconds) *
                  100
                }%`,
              }}
            />
          </div>

          <div className="mt-7">
            <ReorderExerciseCard
              title="Ordered Recall"
              subtitle={orderedModule.instructions.recall}
              answer={orderedAnswer}
              tiles={orderedTiles}
              status="idle"
              answerPlaceholder="Tap the cards in the order you remember"
              onTileClick={handleOrderedTileClick}
              onAnswerClick={handleOrderedAnswerClick}
              footer={footer}
            />
          </div>
        </div>
      </main>
    );
  }

  /* -----------------------------------------
     PART 2 COMPLETE
  ----------------------------------------- */
  if (phase === "ordered_complete") {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
          <div className="w-full text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-3xl">
              ✓
            </div>

            <p className="mt-6 text-sm font-black uppercase tracking-[0.16em] text-indigo-300">
              Part 2 of 5 completed
            </p>

            <h1 className="mt-4 text-3xl font-black sm:text-4xl">
              Ordered Recall recorded
            </h1>

            <p className="mt-4 text-base font-medium leading-7 text-slate-300">
              Your sequence has been saved for scoring later. No correct
              positions are revealed during Form A.
            </p>

            <button
              type="button"
              onClick={() => setPhase("association_intro")}
              className="mt-8 w-full rounded-2xl bg-indigo-500 px-6 py-4 font-black text-white transition hover:bg-indigo-400"
            >
              Continue to Part 3
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* -----------------------------------------
     ASSOCIATION RECALL INTRO
  ----------------------------------------- */
  if (phase === "association_intro") {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)] sm:p-9">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-indigo-600">
                Part 3 of 5
              </p>

              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                Association Recall
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Remember each word-number pair
            </h1>

            <p className="mt-4 text-base font-medium leading-7 text-slate-600">
              You will have {associationModule.studySeconds} seconds to study
              five pairs.
            </p>

            <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm font-medium leading-6 text-amber-900">
              Try to connect each word with its number. After the timer ends,
              all five pairs will disappear.
            </div>

            <button
              type="button"
              onClick={startAssociationStudy}
              className="mt-7 w-full rounded-2xl bg-indigo-600 px-6 py-4 text-base font-black text-white transition hover:bg-indigo-700"
            >
              Start 40-Second Study
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* -----------------------------------------
     ASSOCIATION RECALL STUDY
  ----------------------------------------- */
  if (phase === "association_study") {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 sm:py-10">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-300">
                Part 3 of 5
              </p>

              <h1 className="mt-1 text-2xl font-black sm:text-3xl">
                Association Recall
              </h1>
            </div>

            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-indigo-400 bg-slate-900 text-xl font-black">
              {associationStudySecondsRemaining}
            </div>
          </div>

          <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-indigo-400 transition-[width] duration-1000 ease-linear"
              style={{
                width: `${
                  (associationStudySecondsRemaining /
                    associationModule.studySeconds) *
                  100
                }%`,
              }}
            />
          </div>

          <p className="mt-6 text-center text-base font-bold text-slate-300">
            {associationModule.instructions.study}
          </p>

          <section className="mt-8 grid gap-4 sm:grid-cols-2">
            {associationModule.pairs.map((pair) => (
              <div
                key={pair.id}
                className="flex items-center justify-between rounded-[1.5rem] border border-slate-700 bg-slate-900 px-6 py-5 shadow-lg"
              >
                <span className="text-xl font-black">
                  {pair.prompt}
                </span>

                <span className="text-2xl font-black text-indigo-300">
                  {pair.answer}
                </span>
              </div>
            ))}
          </section>

          <p className="mt-7 text-center text-sm font-medium text-slate-400">
            Remember which number belongs to each word.
          </p>
        </div>
      </main>
    );
  }

  /* -----------------------------------------
     ASSOCIATION RECALL READY
  ----------------------------------------- */
  if (phase === "association_recall_ready") {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
          <div className="w-full text-center">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-indigo-300">
              Part 3 of 5
            </p>

            <h1 className="mt-4 text-3xl font-black sm:text-4xl">
              Now recall the numbers
            </h1>

            <p className="mt-4 text-base font-medium leading-7 text-slate-300">
              The pairs are hidden. You will have{" "}
              {associationModule.recallSeconds} seconds to enter the number
              that belonged to each word.
            </p>

            <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-sm font-medium leading-6 text-slate-300">
              The words will appear in a different order. No answers or
              correctness feedback will be shown during Form A.
            </div>

            <button
              type="button"
              onClick={startAssociationRecall}
              className="mt-7 w-full rounded-2xl bg-indigo-500 px-6 py-4 font-black text-white transition hover:bg-indigo-400"
            >
              Start 45-Second Recall
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* -----------------------------------------
     ASSOCIATION RECALL
  ----------------------------------------- */
  if (phase === "association_recall") {
    const pairById = new Map(
      associationModule.pairs.map((pair) => [pair.id, pair]),
    );

    const recallPairs = associationModule.recallOrder
      .map((id) => pairById.get(id))
      .filter(Boolean);

    const answeredCount = recallPairs.filter(
      (pair) => String(associationAnswers[pair.id] || "").trim() !== "",
    ).length;

    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-600">
                Part 3 of 5
              </p>

              <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">
                Which number belonged to each word?
              </h1>
            </div>

            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-indigo-500 bg-white text-xl font-black text-slate-950">
              {associationRecallSecondsRemaining}
            </div>
          </div>

          <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-indigo-500 transition-[width] duration-1000 ease-linear"
              style={{
                width: `${
                  (associationRecallSecondsRemaining /
                    associationModule.recallSeconds) *
                  100
                }%`,
              }}
            />
          </div>

          <p className="mt-4 text-sm font-bold text-slate-500">
            {answeredCount} of {recallPairs.length} answered
          </p>

          <section className="mt-6 space-y-3">
            {recallPairs.map((pair, index) => (
              <label
                key={pair.id}
                className="flex items-center gap-4 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-black text-indigo-700">
                  {index + 1}
                </div>

                <span className="min-w-0 flex-1 text-lg font-black text-slate-950">
                  {pair.prompt}
                </span>

                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={associationAnswers[pair.id] || ""}
                  onChange={(event) =>
                    updateAssociationAnswer(pair.id, event.target.value)
                  }
                  placeholder="?"
                  aria-label={`Number paired with ${pair.prompt}`}
                  className="w-24 rounded-2xl border border-slate-300 bg-white px-3 py-3 text-center text-xl font-black text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                />
              </label>
            ))}
          </section>

          <p className="mt-5 text-center text-xs font-medium leading-5 text-slate-500">
            Enter only the number you remember. You may leave an answer blank
            if you are unsure.
          </p>

          <button
            type="button"
            onClick={finishAssociationRecall}
            className="mt-6 w-full rounded-2xl bg-indigo-600 px-6 py-4 font-black text-white transition hover:bg-indigo-700"
          >
            Finish Part 3
          </button>
        </div>
      </main>
    );
  }

  /* -----------------------------------------
     PART 3 COMPLETE
  ----------------------------------------- */
  if (phase === "association_complete") {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
          <div className="w-full text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-3xl">
              ✓
            </div>

            <p className="mt-6 text-sm font-black uppercase tracking-[0.16em] text-indigo-300">
              Part 3 of 5 completed
            </p>

            <h1 className="mt-4 text-3xl font-black sm:text-4xl">
              Association Recall recorded
            </h1>

            <p className="mt-4 text-base font-medium leading-7 text-slate-300">
              Your responses have been saved for scoring later. The correct
              word-number pairs are not revealed during Form A.
            </p>

            <button
              type="button"
              onClick={() => setPhase("academic_intro")}
              className="mt-8 w-full rounded-2xl bg-indigo-500 px-6 py-4 font-black text-white transition hover:bg-indigo-400"
            >
              Continue to Part 4
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* -----------------------------------------
     ACADEMIC RECALL INTRO
  ----------------------------------------- */
  if (phase === "academic_intro") {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)] sm:p-9">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-indigo-600">
                Part 4 of 5
              </p>

              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                Academic Recall
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Read and remember
            </h1>

            <p className="mt-4 text-base font-medium leading-7 text-slate-600">
              You will have {academicModule.studySeconds} seconds to read a
              short passage carefully.
            </p>

            <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm font-medium leading-6 text-amber-900">
              Important: the passage will disappear when the timer ends. Read
              for meaning and try to remember the important details.
            </div>

            <button
              type="button"
              onClick={startAcademicStudy}
              className="mt-7 w-full rounded-2xl bg-indigo-600 px-6 py-4 text-base font-black text-white transition hover:bg-indigo-700"
            >
              Start 60-Second Reading
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* -----------------------------------------
     ACADEMIC RECALL STUDY
  ----------------------------------------- */
  if (phase === "academic_study") {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 sm:py-10">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-300">
                Part 4 of 5
              </p>

              <h1 className="mt-1 text-2xl font-black sm:text-3xl">
                Academic Recall
              </h1>
            </div>

            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-indigo-400 bg-slate-900 text-xl font-black">
              {academicStudySecondsRemaining}
            </div>
          </div>

          <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-indigo-400 transition-[width] duration-1000 ease-linear"
              style={{
                width: `${
                  (academicStudySecondsRemaining /
                    academicModule.studySeconds) *
                  100
                }%`,
              }}
            />
          </div>

          <article className="mt-8 rounded-[2rem] border border-slate-700 bg-slate-900 p-6 shadow-xl sm:p-8">
            <p className="text-sm font-black uppercase tracking-[0.14em] text-indigo-300">
              Read carefully
            </p>

            <h2 className="mt-3 text-3xl font-black text-white">
              {academicModule.title}
            </h2>

            <p className="mt-6 text-lg font-medium leading-9 text-slate-200">
              {academicModule.passage}
            </p>
          </article>

          <p className="mt-6 text-center text-sm font-medium text-slate-400">
            The passage will disappear when the timer reaches zero.
          </p>
        </div>
      </main>
    );
  }

  /* -----------------------------------------
     ACADEMIC RECALL READY
  ----------------------------------------- */
  if (phase === "academic_recall_ready") {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
          <div className="w-full text-center">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-indigo-300">
              Part 4 of 5
            </p>

            <h1 className="mt-4 text-3xl font-black sm:text-4xl">
              Now answer from memory
            </h1>

            <p className="mt-4 text-base font-medium leading-7 text-slate-300">
              The passage is hidden. Answer the five questions using only what
              you remember.
            </p>

            <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-sm font-medium leading-6 text-slate-300">
              This section is untimed. You will not see correct answers or
              correctness feedback during Form A.
            </div>

            <button
              type="button"
              onClick={startAcademicRecall}
              className="mt-7 w-full rounded-2xl bg-indigo-500 px-6 py-4 font-black text-white transition hover:bg-indigo-400"
            >
              Answer 5 Questions
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* -----------------------------------------
     ACADEMIC RECALL QUESTIONS
  ----------------------------------------- */
  if (phase === "academic_recall") {
    const answeredCount = academicModule.questions.filter(
      (question) =>
        String(academicAnswers[question.id] || "").trim() !== "",
    ).length;

    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-2xl">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-600">
              Part 4 of 5
            </p>

            <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
              What do you remember?
            </h1>

            <p className="mt-2 text-sm font-bold text-slate-500">
              {answeredCount} of {academicModule.questions.length} answered
            </p>
          </div>

          <section className="mt-7 space-y-4">
            {academicModule.questions.map((question, index) => (
              <label
                key={question.id}
                className="block rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-black text-indigo-700">
                    {index + 1}
                  </div>

                  <p className="pt-1 text-base font-black leading-6 text-slate-950">
                    {question.prompt}
                  </p>
                </div>

                <input
                  type="text"
                  autoComplete="off"
                  value={academicAnswers[question.id] || ""}
                  onChange={(event) =>
                    updateAcademicAnswer(
                      question.id,
                      event.target.value,
                    )
                  }
                  placeholder="Type your answer"
                  className="mt-4 w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-base font-bold text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                />
              </label>
            ))}
          </section>

          <p className="mt-5 text-center text-xs font-medium leading-5 text-slate-500">
            Answer from memory only. You may leave a question blank if you are
            unsure.
          </p>

          <button
            type="button"
            onClick={finishAcademicRecall}
            className="mt-6 w-full rounded-2xl bg-indigo-600 px-6 py-4 font-black text-white transition hover:bg-indigo-700"
          >
            Finish Part 4
          </button>
        </div>
      </main>
    );
  }

  /* -----------------------------------------
     PART 4 COMPLETE
  ----------------------------------------- */
  if (phase === "academic_complete") {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
          <div className="w-full text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-3xl">
              ✓
            </div>

            <p className="mt-6 text-sm font-black uppercase tracking-[0.16em] text-indigo-300">
              Part 4 of 5 completed
            </p>

            <h1 className="mt-4 text-3xl font-black sm:text-4xl">
              Academic Recall recorded
            </h1>

            <p className="mt-4 text-base font-medium leading-7 text-slate-300">
              Your responses have been saved. Continue when you are ready.
            </p>

            <button
              type="button"
              onClick={startDelayedRecall}
              className="mt-8 w-full rounded-2xl bg-indigo-500 px-6 py-4 font-black text-white transition hover:bg-indigo-400"
            >
              Continue
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* -----------------------------------------
     DELAYED RECALL
  ----------------------------------------- */
  if (phase === "delayed_recall") {
    const maxItems = delayedModule.scoring.maxRaw;

    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-600">
                Final memory check
              </p>

              <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">
                Think back to Part 1
              </h1>
            </div>

            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-indigo-500 bg-white text-xl font-black text-slate-950">
              {delayedRecallSecondsRemaining}
            </div>
          </div>

          <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-indigo-500 transition-[width] duration-1000 ease-linear"
              style={{
                width: `${
                  (delayedRecallSecondsRemaining /
                    delayedModule.recallSeconds) *
                  100
                }%`,
              }}
            />
          </div>

          <div className="mt-7 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <p className="text-lg font-black text-slate-950">
              What were the original items?
            </p>

            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              {delayedModule.instructions.recall}
            </p>

            <p className="mt-3 text-sm font-bold text-slate-500">
              {delayedRecalledItems.length} of {maxItems} entered
            </p>

            <form
              className="mt-5 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                addDelayedRecallItem();
              }}
            >
              <input
                autoFocus
                type="text"
                value={delayedRecallInput}
                onChange={(event) =>
                  setDelayedRecallInput(event.target.value)
                }
                disabled={delayedRecalledItems.length >= maxItems}
                placeholder="Type an item you remember"
                autoComplete="off"
                className="min-w-0 flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-4 text-base font-bold text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100"
              />

              <button
                type="submit"
                disabled={
                  !delayedRecallInput.trim() ||
                  delayedRecalledItems.length >= maxItems
                }
                className="rounded-2xl bg-indigo-600 px-5 py-4 font-black text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Add
              </button>
            </form>

            {delayedRecalledItems.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {delayedRecalledItems.map((item, index) => (
                  <button
                    key={`${normalizeRecallValue(item)}-${index}`}
                    type="button"
                    onClick={() => removeDelayedRecallItem(index)}
                    className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-black text-indigo-800"
                    title="Tap to remove"
                  >
                    {item} ×
                  </button>
                ))}
              </div>
            )}

            <p className="mt-5 text-xs font-medium leading-5 text-slate-500">
              Duplicate entries are ignored. No correctness feedback is shown.
            </p>

            <button
              type="button"
              onClick={finishDelayedRecall}
              className="mt-7 w-full rounded-2xl bg-indigo-600 px-6 py-4 font-black text-white transition hover:bg-indigo-700"
            >
              Finish Benchmark
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* -----------------------------------------
     SCORING
  ----------------------------------------- */
  if (phase === "scoring") {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
          <div className="w-full text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-indigo-300 border-t-transparent" />

            <p className="mt-6 text-sm font-black uppercase tracking-[0.16em] text-indigo-300">
              Benchmark completed
            </p>

            <h1 className="mt-4 text-3xl font-black sm:text-4xl">
              Calculating your result
            </h1>

            <p className="mt-4 text-base font-medium leading-7 text-slate-300">
              Your five recall sections are being scored now.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (phase === "scoring_error") {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
          <div className="w-full text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15 text-3xl">
              !
            </div>

            <p className="mt-6 text-sm font-black uppercase tracking-[0.16em] text-amber-300">
              Result not calculated yet
            </p>

            <h1 className="mt-4 text-3xl font-black sm:text-4xl">
              Your answers are still saved
            </h1>

            <p className="mt-4 text-base font-medium leading-7 text-slate-300">
              {scoringError}
            </p>

            <button
              type="button"
              onClick={submitAssessmentForScoring}
              className="mt-8 w-full rounded-2xl bg-indigo-500 px-6 py-4 font-black text-white transition hover:bg-indigo-400"
            >
              Retry Result
            </button>
          </div>
        </div>
      </main>
    );
  }

  return null;
}
