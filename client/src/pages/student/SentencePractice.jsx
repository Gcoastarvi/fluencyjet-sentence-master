import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/api/apiClient";

const DEFAULT_PRACTICE_MODE = "reorder";
const SUPPORTED_PRACTICE_MODES = new Set([
  "reorder",
  "typing",
  "cloze",
  "audio",
]);
const MAX_ATTEMPTS = 3;

export default function SentencePractice() {
  const { mode: urlMode } = useParams();

  // robust fallback: extract mode from URL path if useParams fails
  const segments = window.location.pathname.split("/").filter(Boolean);
  const practiceIdx = segments.indexOf("practice");
  const pathMode = practiceIdx >= 0 ? segments[practiceIdx + 1] : null;

  const rawMode = String(
    urlMode || pathMode || DEFAULT_PRACTICE_MODE,
  ).toLowerCase();

  const activeMode = SUPPORTED_PRACTICE_MODES.has(rawMode)
    ? rawMode
    : DEFAULT_PRACTICE_MODE;

  const safeMode =
    activeMode === "typing" || activeMode === "reorder" ? activeMode : "typing";

  const search = new URLSearchParams(window.location.search);
  const lessonId = Number(search.get("lessonId") || 1);

  // -------------------
  // refs
  // -------------------
  const correctSoundRef = useRef(null);
  const wrongSoundRef = useRef(null);

  // -------------------
  // state
  // -------------------
  const [currentIndex, setCurrentIndex] = useState(0);

  const [tiles, setTiles] = useState([]);
  const [answer, setAnswer] = useState([]);

  const [attempts, setAttempts] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | wrong | correct | reveal
  const [showHint, setShowHint] = useState(false);
  const [wrongIndexes, setWrongIndexes] = useState([]);

  const [lessonExercises, setLessonExercises] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [sessionTarget] = useState(10); // MVP: 10 questions per session

  // typing/cloze shared input state
  const [selectedOption, setSelectedOption] = useState(null);
  const [typedAnswer, setTypedAnswer] = useState("");

  // server-driven UI
  const [earnedXP, setEarnedXP] = useState(0);
  const [showXPToast, setShowXPToast] = useState(false);
  const [streak, setStreak] = useState(0);

  const totalQuestions = Math.min(lessonExercises.length || 0, sessionTarget);

  const currentQuestion = useMemo(() => {
    const q = lessonExercises[currentIndex];
    if (!q) return null;

    // ensure typing has a usable target
    const target =
      q.answer?.trim() ||
      (Array.isArray(q.correctOrder) ? q.correctOrder.join(" ") : "");

    return {
      ...q,
      // keep backend-provided type (TYPING / REORDER)
      answer: target,
    };
  }, [lessonExercises, currentIndex]);

  // -------------------
  // effects
  // -------------------

  // 🔁 Smart Resume (optional)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("resume") === "1") {
      try {
        const last = JSON.parse(
          localStorage.getItem("fj_last_session") || "null",
        );
        if (last?.questionIndex != null) {
          setCurrentIndex(last.questionIndex);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    setCurrentIndex(0);
    setLessonExercises([]);
    loadLessonBatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeMode, lessonId]);

  useEffect(() => {
    initQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, safeMode, lessonExercises]);

  // ✅ Typing Word Bank (shows shuffled words as a hint, but we don't reveal the full sentence)
  const typingWordBank = useMemo(() => {
    if (safeMode !== "typing") return [];
    const words = Array.isArray(currentQuestion?.correctOrder)
      ? [...currentQuestion.correctOrder]
      : [];
    return words.sort(() => Math.random() - 0.5);
  }, [safeMode, currentQuestion, currentIndex]);

  // 🔊 Initialize sounds once
  useEffect(() => {
    correctSoundRef.current = new Audio("/sounds/correct.mp3");
    wrongSoundRef.current = new Audio("/sounds/wrong.mp3");
  }, []);

  // AUTO NEXT after correct/reveal
  useEffect(() => {
    if (status === "correct" || status === "reveal") {
      const timer = setTimeout(() => {
        loadNextQuestion();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // -------------------
  // XP update (stable + backend-friendly)
  // -------------------
  async function commitXP({ isCorrect, attemptNo, mode }) {
    const attemptId =
      globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `att_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    // backend-friendly numeric IDs
    const numericQuestionId = Number(currentIndex + 1); // 1..N

    // choose xp by mode (keep your economy)
    const xpValue = isCorrect ? (mode === "typing" ? 150 : 100) : 0;

    // ✅ build payload correctly (NO statements inside object literal)
    const payload = {
      attemptId,
      attemptNo: Number(attemptNo ?? 1) || 1,

      // ✅ REQUIRED for XP award logic
      xp: xpValue,
      event: isCorrect ? `${mode}_correct` : `${mode}_wrong`,
      meta: {
        lessonId,
        mode,
        questionId: numericQuestionId,
      },

      // keep your existing fields (safe/backward compatible)
      lessonId, // numeric (dynamic)
      questionId: numericQuestionId,

      lessonKey: `L${lessonId}`,
      questionKey: `Q${numericQuestionId}`,

      practiceType: mode,
      mode,

      isCorrect: !!isCorrect,
      completedQuiz: false,
      timeTakenSec: null,
    };

    try {
      const res = await api.post("/progress/update", payload);
      const data = res?.data ?? res;

      if (!data || data.ok !== true) {
        console.error("[XP] /progress/update not ok", {
          payload,
          response: data,
        });
        setEarnedXP(0);
        return;
      }

      const awarded =
        Number(
          data.xpAwarded ??
            data.xpDelta ??
            data.xp_delta ??
            data.earnedXP ??
            data.xp ??
            0,
        ) || 0;

      // TEMP DEBUG (remove later if you want)
      console.log("[XP] awarded from server:", awarded, "raw:", data);

      setEarnedXP(awarded);
      setStreak(Number(data.streak ?? data.currentStreak ?? 0) || 0);

      setShowXPToast(true);
      setTimeout(() => setShowXPToast(false), 1200);

      window.dispatchEvent(new Event("fj:xp_updated"));
    } catch (err) {
      console.error("[XP] update failed", err);
      setEarnedXP(0);
    }
  }

  // -------------------
  // helpers
  // -------------------
  function normalizeExercise(raw) {
    if (!raw) return null;

    const ex = raw.exercise ?? raw;

    return {
      id: ex.id ?? ex.exerciseId ?? null,
      type: ex.type ?? ex.practiceType ?? ex.mode ?? null, // ✅ ADD THIS
      tamil: ex.tamil ?? ex.promptTamil ?? ex.tamilLine ?? ex.promptTa ?? "",
      correctOrder: Array.isArray(ex.correctOrder) ? ex.correctOrder : [],
      answer: ex.answer ?? ex.english ?? "",
      xp: ex.xp ?? 0, // optional, but useful
    };
  }

  async function loadLessonBatch() {
    setLoading(true);
    setLoadError("");

    try {
      const res = await api.get(
        `/quizzes/by-lesson/${lessonId}?mode=${encodeURIComponent(safeMode)}`,
      );

      const data = res?.data ?? res;

      const ok = Array.isArray(data) ? true : data?.ok;
      if (!ok) {
        throw new Error((data && data.error) || "Failed to load questions");
      }

      const arr = Array.isArray(data)
        ? data
        : Array.isArray(data.questions)
          ? data.questions
          : Array.isArray(data.data?.questions)
            ? data.data.questions
            : Array.isArray(data.items)
              ? data.items
              : Array.isArray(data.exercises)
                ? data.exercises
                : [];

      const normalized = arr.map(normalizeExercise).filter(Boolean);

      if (!normalized.length) {
        setLessonExercises([]);
        setLoadError(
          `No exercises found. mode=${safeMode} lessonId=${lessonId}`,
        );
        return;
      }

      setLessonExercises(normalized);
    } catch (e) {
      console.error("[Practice] loadLessonBatch failed", e);
      setLoadError("Failed to load lesson exercises.");
    } finally {
      setLoading(false);
    }
  }

  async function loadRandomOne() {
    setLoading(true);
    setLoadError("");
    try {
      const res = await api.get("/quizzes/random", {
        params: { mode: activeMode, lessonId }, // lessonId optional if backend supports
      });
      const data = res?.data ?? res;
      const ex = normalizeExercise(data);

      if (!ex) {
        setLoadError("No exercise returned.");
        return;
      }

      setLessonExercises([ex]); // single-item “batch”
      setCurrentIndex(0);
    } catch (e) {
      console.error("[Practice] loadRandomOne failed", e);
      setLoadError("Failed to load a random exercise.");
    } finally {
      setLoading(false);
    }
  }

  function initQuiz() {
    setAttempts(0);
    setStatus("idle");
    setShowHint(false);
    setWrongIndexes([]);
    setEarnedXP(0);
    setTypedAnswer("");

    // initialize by mode
    if (safeMode === "reorder") {
      const shuffled = [...(currentQuestion?.correctOrder || [])].sort(
        () => Math.random() - 0.5,
      );
      setTiles(shuffled);
      setAnswer([]);
    } else {
      setTiles([]);
      setAnswer([]);
    }
  }

  function loadNextQuestion() {
    setCurrentIndex((prev) => prev + 1);
  }

  function addToAnswer(word) {
    if (status === "correct" || status === "reveal") return;
    setAnswer((prev) => [...prev, word]);
    setTiles((prev) => {
      const idx = prev.indexOf(word);
      if (idx === -1) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
  }

  // ✅ Typing helper: tap a word chip to append into typedAnswer
  function addToTyped(word) {
    if (status === "correct" || status === "reveal") return;

    setTypedAnswer((prev) => {
      const t = String(prev || "").trimEnd();
      return (t ? t + " " : "") + word + " ";
    });
  }

  function handleTryAgain() {
    setAnswer([]);
    setWrongIndexes([]);
    setStatus("idle");
    setShowHint(false);
    setAttempts(0);

    if (safeMode === "typing") {
      setTypedAnswer("");
      return;
    }

    if (safeMode === "reorder") {
      const reshuffled = [...(currentQuestion?.correctOrder || [])].sort(
        () => Math.random() - 0.5,
      );
      setTiles(reshuffled);
    }
  }

  function checkAnswer() {
    if (!currentQuestion) return;
    if (status === "correct") return;

    // ⌨️ TYPING validation
    if (safeMode === "typing") {
      const normalize = (s) =>
        String(s || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ");

      const target =
        currentQuestion.answer?.trim() ||
        (currentQuestion.correctOrder || []).join(" ");
      const user = typedAnswer;

      if (!normalize(user)) {
        setStatus("wrong");
        setShowHint(true);
        return;
      }

      const attemptNumber = attempts + 1;

      if (normalize(user) === normalize(target)) {
        correctSoundRef.current?.play?.();
        setStatus("correct");
        setWrongIndexes([]);

        commitXP({
          isCorrect: true,
          attemptNo: attemptNumber,
          mode: "typing",
        });

        localStorage.setItem(
          "fj_last_session",
          JSON.stringify({
            practiceType: "typing",
            questionIndex: currentIndex + 1,
            timestamp: Date.now(),
          }),
        );
        return;
      }

      // wrong typing
      wrongSoundRef.current?.play?.();
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      setStatus("wrong");
      setShowHint(true);

      if (nextAttempts >= MAX_ATTEMPTS) {
        setStatus("reveal");
        setEarnedXP(0);
      }
      return;
    }

    // ✅ REORDER validation
    if (answer.length !== currentQuestion.correctOrder.length) {
      setStatus("wrong");
      setShowHint(true);
      return;
    }

    const incorrect = [];
    answer.forEach((word, index) => {
      if (word !== currentQuestion.correctOrder[index]) incorrect.push(index);
    });

    if (incorrect.length === 0) {
      correctSoundRef.current?.play?.();
      const attemptNumber = attempts + 1;

      setWrongIndexes([]);
      setStatus("correct");

      commitXP({
        isCorrect: true,
        attemptNo: attemptNumber,
        mode: "reorder",
      });

      localStorage.setItem(
        "fj_last_session",
        JSON.stringify({
          practiceType: "reorder",
          questionIndex: currentIndex + 1,
          timestamp: Date.now(),
        }),
      );
      return;
    }

    // WRONG
    wrongSoundRef.current?.play?.();
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    setStatus("wrong");
    setShowHint(true);
    setWrongIndexes(incorrect);

    if (nextAttempts >= MAX_ATTEMPTS) {
      setStatus("reveal");
      setEarnedXP(0);
    }
  }

  // -------------------
  // mode guard (MVP)
  // -------------------
  if (safeMode !== "reorder" && safeMode !== "typing") {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Practice mode: {safeMode}</h1>
        <p className="text-gray-600">
          This mode is coming next. For now, use <b>/practice/reorder</b> or{" "}
          <b>/practice/typing</b>.
        </p>
      </div>
    );
  }

  // -------------------
  // completion
  // -------------------
  if (totalQuestions > 0 && currentIndex >= totalQuestions) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">🎉 Session Complete!</h1>
        <p className="mb-4">Great job! You finished today’s practice.</p>

        <button
          className="bg-purple-600 text-white px-6 py-3 rounded-lg"
          onClick={() => {
            setCurrentIndex(0);
            setStatus("idle");
            loadLessonBatch(); // reload for another run
          }}
        >
          Practice Again
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <div className="text-lg font-semibold">Loading practice…</div>
        <div className="text-sm text-slate-500 mt-2">Fetching exercises</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <div className="text-lg font-semibold text-red-600">{loadError}</div>
        <button
          className="mt-4 bg-purple-600 text-white px-5 py-2 rounded-lg"
          onClick={() => loadLessonBatch()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">No questions found</h1>
        <p className="text-gray-600">Please reload.</p>
      </div>
    );
  }

  // -------------------
  // UI
  // -------------------
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-center mb-6">
        Build the sentence
      </h1>

      <div className="text-center text-xs text-slate-400 mb-3">
        urlMode: <b>{String(urlMode)}</b> | activeMode: <b>{activeMode}</b> |
        safeMode: <b>{safeMode}</b> | lessonId: <b>{lessonId}</b>
      </div>

      <div className="text-center text-sm text-gray-500 mb-3">
        Question {currentIndex + 1} / {totalQuestions}
      </div>

      <div className="flex justify-center items-center gap-2 mb-4 text-orange-600 font-semibold">
        🔥 {streak}-day streak
      </div>

      {/* Tamil Prompt */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6 text-lg">
        {currentQuestion.tamil}
      </div>

      {/* Hint */}
      {showHint && status !== "correct" && (
        <div className="bg-purple-100 text-purple-800 p-3 rounded mb-4">
          💡 Hint: Subject → Verb → Action
        </div>
      )}

      {/* ⌨️ TYPING UI */}
      {safeMode === "typing" && (
        <div className="bg-white shadow-lg rounded-xl p-5 border border-purple-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-purple-700">
              Typing Practice
            </h2>

            <button
              onClick={() => setTypedAnswer("")}
              className="text-xs px-3 py-1 rounded bg-slate-100 hover:bg-slate-200"
              disabled={status === "correct" || status === "reveal"}
            >
              Clear
            </button>
          </div>

          {/* Tamil prompt (what they should convert to English) */}
          <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 mb-3">
            <div className="text-xs font-semibold text-purple-700 mb-1">
              Tamil prompt
            </div>
            <div className="text-sm text-slate-800">
              {currentQuestion.tamil}
            </div>
          </div>

          {/* Word Bank (hint only — not clickable) */}
          <div className="mb-3">
            <div className="text-xs font-semibold text-slate-600 mb-2">
              Word Bank (hint only)
            </div>

            <div className="flex flex-wrap gap-2">
              {typingWordBank.map((w, idx) => (
                <span
                  key={`${w}_${idx}`}
                  className="px-3 py-1 rounded-full border border-slate-200 bg-slate-50 text-sm"
                >
                  {w}
                </span>
              ))}
            </div>
          </div>

          {/* Input */}
          <textarea
            value={typedAnswer}
            onChange={(e) => setTypedAnswer(e.target.value)}
            placeholder="Type the full English sentence here..."
            className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
            rows={3}
            disabled={status === "correct" || status === "reveal"}
          />

          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={checkAnswer}
              className="px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700"
              disabled={status === "correct" || status === "reveal"}
            >
              Submit
            </button>

            <button
              onClick={() => setStatus("reveal")}
              className="px-4 py-2 rounded bg-yellow-500 text-white hover:bg-yellow-600"
              disabled={status === "correct" || status === "reveal"}
            >
              Show Answer
            </button>
          </div>
        </div>
      )}

      {/* REORDER UI */}
      {safeMode === "reorder" && (
        <>
          {/* Answer Area */}
          <div className="border-2 border-dashed rounded-lg p-4 min-h-[70px] mb-4 flex flex-wrap gap-2">
            {answer.map((word, index) => {
              const isWrong = wrongIndexes.includes(index);
              return (
                <span
                  key={`${word}-${index}`}
                  className={`px-4 py-2 rounded-full text-white transition ${
                    isWrong ? "bg-red-500 animate-shake" : "bg-blue-600"
                  }`}
                >
                  {word}
                </span>
              );
            })}
          </div>

          {/* Tile Bank */}
          <div className="border-2 border-dashed rounded-lg p-4 mb-6 flex flex-wrap gap-2">
            {tiles.map((word, index) => (
              <button
                key={`${word}-${index}`}
                type="button"
                onClick={() => addToAnswer(word)}
                disabled={status === "correct" || status === "reveal"}
                className="px-4 py-2 rounded-full bg-blue-600 text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {word}
              </button>
            ))}
          </div>

          {/* Check Answer button (REORDER only) */}
          {status === "idle" && (
            <button
              type="button"
              onClick={checkAnswer}
              className="w-full bg-purple-600 text-white py-3 rounded-lg text-lg"
            >
              Check Answer
            </button>
          )}
        </>
      )}

      {/* Wrong */}
      {status === "wrong" && (
        <div className="mt-6">
          <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
            ❌ Not correct. Try again. ({attempts}/{MAX_ATTEMPTS})
          </div>
          <button
            onClick={handleTryAgain}
            className="w-full bg-purple-600 text-white py-3 rounded-lg text-lg"
          >
            Try again
          </button>
        </div>
      )}

      {/* XP Toast */}
      {showXPToast && (
        <div className="fixed top-24 right-6 bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg animate-bounce z-50">
          +{earnedXP} XP ✨
        </div>
      )}

      {/* Correct */}
      {status === "correct" && (
        <div className="bg-green-100 text-green-700 p-4 rounded mt-6 text-center">
          ✅ Correct! Well done. <br />
          <span className="font-semibold">+{earnedXP} XP earned</span>
        </div>
      )}

      {/* Reveal */}
      {status === "reveal" && (
        <div className="bg-yellow-100 p-4 rounded mt-6">
          📘 <strong>Good attempt! Here is the correct sentence:</strong>
          <div className="mt-3">
            <div className="flex flex-wrap gap-2">
              {(currentQuestion?.correctOrder || []).map((word, index) => (
                <span key={index} className="px-3 py-1 bg-green-200 rounded">
                  {word}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Shake animation */}
      <style>
        {`
          @keyframes shake {
            0% { transform: translateX(0); }
            25% { transform: translateX(-4px); }
            50% { transform: translateX(4px); }
            75% { transform: translateX(-4px); }
            100% { transform: translateX(0); }
          }
          .animate-shake {
            animation: shake 0.3s ease-in-out;
          }
        `}
      </style>
    </div>
  );
}
