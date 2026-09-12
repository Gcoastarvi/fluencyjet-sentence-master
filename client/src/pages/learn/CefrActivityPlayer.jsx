import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  completeCefrActivityAttempt,
  getCefrDay,
  getCefrProgress,
  startCefrActivityAttempt,
  submitCefrActivityResponse,
} from "@/api/cefrApi";

import CefrMcqActivity from "@/components/cefr/CefrMcqActivity";
import CefrReorderActivity from "@/components/cefr/CefrReorderActivity";

function createIdempotencyKey() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `cefr-response-${crypto.randomUUID()}`;
  }

  return `cefr-response-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

function apiErrorMessage(response, fallback) {
  return (
    response?.data?.message ||
    response?.error ||
    fallback
  );
}

export default function CefrActivityPlayer() {
  const {
    programSlug = "",
    dayNumber = "",
    activityId = "",
  } = useParams();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [program, setProgram] = useState(null);
  const [day, setDay] = useState(null);
  const [activity, setActivity] = useState(null);
  const [attempt, setAttempt] = useState(null);

  const [completedItemIds, setCompletedItemIds] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [result, setResult] = useState(null);
  const [xpAward, setXpAward] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState("");

  const [completing, setCompleting] = useState(false);
  const [completionError, setCompletionError] = useState("");
  const [activityCompleted, setActivityCompleted] = useState(false);

  const pendingIdempotencyKeyRef = useRef("");
  const itemStartedAtRef = useRef(Date.now());

  const items = useMemo(
    () =>
      Array.isArray(activity?.items)
        ? activity.items
        : [],
    [activity],
  );

  const completedSet = useMemo(
    () => new Set(completedItemIds),
    [completedItemIds],
  );

  const currentItem = items[currentIndex] || null;

  const allItemsComplete =
    items.length > 0 &&
    items.every((item) => completedSet.has(item.id));

  const dayPath =
    `/learn/${encodeURIComponent(programSlug)}` +
    `/day/${encodeURIComponent(dayNumber)}`;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError("");

      const dayResponse = await getCefrDay(
        programSlug,
        dayNumber,
      );

      if (cancelled) return;

      if (!dayResponse.ok) {
        setLoadError(
          apiErrorMessage(
            dayResponse,
            "Unable to load this activity.",
          ),
        );
        setLoading(false);
        return;
      }

      const loadedDay = dayResponse.data?.day || null;
      const loadedProgram =
        dayResponse.data?.program || null;

      const loadedActivity =
        loadedDay?.activities?.find(
          (candidate) => candidate.id === activityId,
        ) || null;

      if (!loadedActivity) {
        setLoadError("Activity not found.");
        setLoading(false);
        return;
      }

      if (!["MCQ", "REORDER"].includes(loadedActivity.activityType)) {
        setProgram(loadedProgram);
        setDay(loadedDay);
        setActivity(loadedActivity);
        setLoadError(
          `The ${loadedActivity.activityType} player is not available yet.`,
        );
        setLoading(false);
        return;
      }

      const attemptResponse =
        await startCefrActivityAttempt({
          programSlug,
          dayNumber,
          activityId,
        });

      if (cancelled) return;

      if (!attemptResponse.ok) {
        setLoadError(
          apiErrorMessage(
            attemptResponse,
            "Unable to start this activity.",
          ),
        );
        setLoading(false);
        return;
      }

      const loadedAttempt =
        attemptResponse.data?.attempt || null;

      if (!loadedAttempt?.id) {
        setLoadError(
          "The activity attempt could not be started.",
        );
        setLoading(false);
        return;
      }

      let resumeIds = [];

      const progressResponse =
        await getCefrProgress(programSlug);

      if (
        !cancelled &&
        progressResponse.ok
      ) {
        const progressDay =
          progressResponse.data?.days?.find(
            (candidate) =>
              Number(candidate.dayNumber) ===
              Number(dayNumber),
          );

        const progressActivity =
          progressDay?.activities?.find(
            (candidate) =>
              candidate.id === activityId,
          );

        if (
          progressActivity?.latestAttempt?.id ===
          loadedAttempt.id
        ) {
          resumeIds = Array.isArray(
            progressActivity?.resume
              ?.completedItemIds,
          )
            ? progressActivity.resume.completedItemIds
            : [];
        }
      }

      if (cancelled) return;

      const resumeSet = new Set(resumeIds);

      const firstIncompleteIndex =
        loadedActivity.items.findIndex(
          (item) => !resumeSet.has(item.id),
        );

      setProgram(loadedProgram);
      setDay(loadedDay);
      setActivity(loadedActivity);
      setAttempt(loadedAttempt);
      setCompletedItemIds(resumeIds);

      setCurrentIndex(
        firstIncompleteIndex >= 0
          ? firstIncompleteIndex
          : 0,
      );

      setActivityCompleted(
        loadedAttempt.status === "COMPLETED",
      );

      setSelectedOptionId("");
      setResult(null);
      setXpAward(null);
      setSubmissionError("");
      setCompletionError("");

      pendingIdempotencyKeyRef.current = "";
      itemStartedAtRef.current = Date.now();

      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [
    programSlug,
    dayNumber,
    activityId,
  ]);

  function handleSelect(optionId) {
    if (result?.isCorrect === true) return;

    setSelectedOptionId(optionId);
    setResult(null);
    setXpAward(null);
    setSubmissionError("");

    pendingIdempotencyKeyRef.current = "";
  }

  async function handleSubmit(submittedAnswer) {
    if (
      !attempt?.id ||
      !currentItem?.id ||
      !submittedAnswer ||
      submitting
    ) {
      return;
    }

    setSubmitting(true);
    setSubmissionError("");

    if (!pendingIdempotencyKeyRef.current) {
      pendingIdempotencyKeyRef.current =
        createIdempotencyKey();
    }

    const responseTimeMs = Math.max(
      0,
      Date.now() - itemStartedAtRef.current,
    );

    const response =
      await submitCefrActivityResponse({
        programSlug,
        dayNumber,
        activityId,
        attemptId: attempt.id,
        activityItemId: currentItem.id,
        submittedAnswer,
        hintUsed: false,
        answerRevealed: false,
        responseTimeMs,
        idempotencyKey:
          pendingIdempotencyKeyRef.current,
      });

    setSubmitting(false);

    if (!response.ok) {
      setSubmissionError(
        apiErrorMessage(
          response,
          "Unable to check your answer. Please try again.",
        ),
      );
      return;
    }

    pendingIdempotencyKeyRef.current = "";

    const savedResponse =
      response.data?.response || null;

    setResult(savedResponse);
    setXpAward(response.data?.xp || null);

    if (savedResponse?.isCorrect === true) {
      setCompletedItemIds((previous) => {
        if (previous.includes(currentItem.id)) {
          return previous;
        }

        return [...previous, currentItem.id];
      });
    }
  }

  function handleMcqSubmit() {
    if (!selectedOptionId) return;

    return handleSubmit({
      optionId: selectedOptionId,
    });
  }

  function handleReorderSubmit(tokens) {
    if (!Array.isArray(tokens) || tokens.length === 0) {
      return;
    }

    return handleSubmit({
      tokens,
    });
  }

  function handleReorderAnswerChange() {
    if (result?.isCorrect === true) return;

    setResult(null);
    setXpAward(null);
    setSubmissionError("");

    pendingIdempotencyKeyRef.current = "";
  }

  function handleContinue() {
    if (!currentItem) return;

    const done = new Set(completedItemIds);
    done.add(currentItem.id);

    const nextIndex = items.findIndex(
      (item, index) =>
        index > currentIndex &&
        !done.has(item.id),
    );

    setSelectedOptionId("");
    setResult(null);
    setXpAward(null);
    setSubmissionError("");

    pendingIdempotencyKeyRef.current = "";
    itemStartedAtRef.current = Date.now();

    if (nextIndex >= 0) {
      setCurrentIndex(nextIndex);
    }
  }

  async function handleCompleteActivity() {
    if (
      !attempt?.id ||
      !allItemsComplete ||
      completing
    ) {
      return;
    }

    setCompleting(true);
    setCompletionError("");

    const response =
      await completeCefrActivityAttempt({
        programSlug,
        dayNumber,
        activityId,
        attemptId: attempt.id,
      });

    setCompleting(false);

    if (!response.ok) {
      setCompletionError(
        apiErrorMessage(
          response,
          "Unable to complete this activity.",
        ),
      );
      return;
    }

    setAttempt(
      response.data?.attempt || attempt,
    );

    setActivityCompleted(true);
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-3xl">
          <div className="animate-pulse rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="mt-4 h-9 w-3/4 rounded bg-slate-200" />
            <div className="mt-8 h-16 rounded-2xl bg-slate-100" />
            <div className="mt-3 h-16 rounded-2xl bg-slate-100" />
            <div className="mt-3 h-16 rounded-2xl bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-[70vh] bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <Link
            to={dayPath}
            className="text-sm font-black text-indigo-700"
          >
            ← Back to Day {dayNumber}
          </Link>

          <div className="mt-5 rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-500">
              Activity unavailable
            </p>

            <h1 className="mt-3 text-2xl font-black text-slate-950">
              {loadError}
            </h1>
          </div>
        </div>
      </div>
    );
  }

  if (activityCompleted) {
    return (
      <div className="min-h-[70vh] bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-[2rem] border border-emerald-200 bg-white p-8 text-center shadow-sm sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-3xl">
              ✓
            </div>

            <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-emerald-600">
              Activity complete
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              {activity?.title}
            </h1>

            <p className="mt-3 text-sm font-medium text-slate-600">
              Great work. Your progress has been saved.
            </p>

            <Link
              to={dayPath}
              className="mt-7 inline-flex rounded-2xl bg-indigo-600 px-6 py-3 font-black text-white hover:bg-indigo-700"
            >
              Back to Day {dayNumber}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          to={dayPath}
          className="text-sm font-black text-indigo-700"
        >
          ← Day {day?.dayNumber}
        </Link>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-600">
              {program?.name || "Learning Program"}
            </p>

            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              {activity?.title}
            </h1>
          </div>

          <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-600">
            {Math.min(
              completedItemIds.length + 1,
              items.length,
            )}{" "}
            / {items.length}
          </div>
        </div>

        <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all"
            style={{
              width: `${
                items.length
                  ? (completedItemIds.length /
                      items.length) *
                    100
                  : 0
              }%`,
            }}
          />
        </div>

        {!allItemsComplete && currentItem && (
          <div className="mt-7">
            {activity?.activityType === "MCQ" && (
              <CefrMcqActivity
                item={currentItem}
                selectedOptionId={selectedOptionId}
                result={result}
                submitting={submitting}
                onSelect={handleSelect}
                onSubmit={handleMcqSubmit}
              />
            )}

            {activity?.activityType === "REORDER" && (
              <CefrReorderActivity
                item={currentItem}
                activityTitle={activity?.title}
                result={result}
                submitting={submitting}
                onAnswerChange={handleReorderAnswerChange}
                onSubmit={handleReorderSubmit}
              />
            )}

            {submissionError && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                {submissionError}
              </div>
            )}

            {result?.isCorrect === true && (
              <div className="mt-4">
                {Number(xpAward?.amount || 0) > 0 && (
                  <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center font-black text-amber-800">
                    +{xpAward.amount} XP
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleContinue}
                  className="w-full rounded-2xl bg-slate-950 px-5 py-4 font-black text-white transition hover:bg-slate-800"
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        )}

        {allItemsComplete && (
          <div className="mt-7 rounded-[2rem] border border-emerald-200 bg-white p-7 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-2xl">
              ✓
            </div>

            <h2 className="mt-4 text-2xl font-black text-slate-950">
              All questions completed
            </h2>

            <p className="mt-2 text-sm font-medium text-slate-600">
              Finish the activity to save your completion.
            </p>

            {completionError && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                {completionError}
              </div>
            )}

            <button
              type="button"
              disabled={completing}
              onClick={handleCompleteActivity}
              className="mt-6 w-full rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white transition hover:bg-emerald-700 disabled:bg-slate-300"
            >
              {completing
                ? "Finishing..."
                : `Complete ${activity?.title || "Activity"}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
