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

/**
 * ✅ IMPORTANT
 * - XP must be updated via the existing stable endpoint: /api/progress/update
 * - apiClient.js already dispatches: window.dispatchEvent(new CustomEvent("fj:xp_updated"))
 *   after XP updates. So we DO NOT dispatch anything here.
 */
const QUESTIONS = [
  {
    type: "REORDER",
    tamil: "அவள் annual exams ல pass ஆக hard ஆக study பண்ணிட்டு இருக்கா",
    correctOrder: [
      "She",
      "is",
      "studying",
      "hard",
      "to",
      "pass",
      "her",
      "annual",
      "exams",
    ],
  },
  {
    type: "REORDER",
    tamil: "அவன் job கிடைக்க hard ஆக prepare பண்ணிட்டு இருக்கான்",
    correctOrder: ["He", "is", "preparing", "hard", "to", "get", "a", "job"],
  },
  {
    type: "REORDER",
    tamil: "நான் English improve பண்ண daily practice பண்ணுறேன்",
    correctOrder: ["I", "practice", "daily", "to", "improve", "my", "English"],
  },
  {
    type: "REORDER",
    tamil: "அவர்கள் exam clear பண்ண confidence build பண்ணுறாங்க",
    correctOrder: [
      "They",
      "are",
      "building",
      "confidence",
      "to",
      "clear",
      "the",
      "exam",
    ],
  },
  {
    type: "REORDER",
    tamil: "நீ fluency improve பண்ண slow ஆக start பண்ணலாம்",
    correctOrder: ["You", "can", "start", "slowly", "to", "improve", "fluency"],
  },
];

export default function SentencePractice() {
  const { mode: urlMode } = useParams();
  const rawMode = (urlMode || DEFAULT_PRACTICE_MODE).toLowerCase();
  const activeMode = SUPPORTED_PRACTICE_MODES.has(rawMode)
    ? rawMode
    : DEFAULT_PRACTICE_MODE;

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

  // typing/cloze shared input state
  const [selectedOption, setSelectedOption] = useState(null);
  const [typedAnswer, setTypedAnswer] = useState("");

  // server-driven UI
  const [earnedXP, setEarnedXP] = useState(0);
  const [showXPToast, setShowXPToast] = useState(false);
  const [streak, setStreak] = useState(0);

  const totalQuestions = QUESTIONS.length;

  const currentQuestion = useMemo(() => {
    if (currentIndex >= QUESTIONS.length) return null;
    const q = QUESTIONS[currentIndex];
    if (!q) return null;
    return { ...q, type: q.type || "REORDER" };
  }, [currentIndex]);

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

  // 🔊 Initialize sounds once
  useEffect(() => {
    correctSoundRef.current = new Audio("/sounds/correct.mp3");
    wrongSoundRef.current = new Audio("/sounds/wrong.mp3");
  }, []);

  // Initialize question when index OR mode changes
  useEffect(() => {
    initQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, activeMode]);

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
  // XP update (must match stable backend)
  // -------------------
  async function commitXP({ isCorrect, attemptNo, mode }) {
    try {
      const res = await api.post("/xp/commit", {
        attemptId: crypto.randomUUID(),
        mode,
        lessonId: "L1", // keep static for now
        questionId: `Q${currentIndex + 1}`,
        isCorrect,
        attemptNo,
        timeTakenSec: null,
        completedQuiz: false,
      });

      const data = res?.data ?? res;

      if (!data?.ok) {
        setEarnedXP(0);
        return;
      }

      // ✅ backend may return xp as xpAwarded OR xpDelta OR xp_delta OR earnedXP
      const awarded = Number(
        data.xpAwarded ??
          data.xpDelta ??
          data.xp_delta ??
          data.earnedXP ??
          data.xp ??
          0,
      );

      setEarnedXP(awarded);
      setStreak(Number(data.streak ?? data.currentStreak ?? 0));

      setShowXPToast(true);
      setTimeout(() => setShowXPToast(false), 1200);

      // ✅ tell Dashboard to refresh instantly
      try {
        window.dispatchEvent(
          new CustomEvent("fj:xp_updated", {
            detail: { xpAwarded: awarded, mode },
          }),
        );
      } catch {}
    } catch (err) {
      console.error("XP commit failed", err);
      setEarnedXP(0);
    }
  }

  // -------------------
  // helpers
  // -------------------
  function initQuiz() {
    if (!currentQuestion) return;

    // reset common
    setAttempts(0);
    setStatus("idle");
    setShowHint(false);
    setWrongIndexes([]);
    setEarnedXP(0);

    // reset typing/cloze
    setSelectedOption(null);
    setTypedAnswer("");

    // initialize by mode
    if (activeMode === "reorder" && currentQuestion.type === "REORDER") {
      const shuffled = [...currentQuestion.correctOrder].sort(
        () => Math.random() - 0.5,
      );
      setTiles(shuffled);
      setAnswer([]);
    } else {
      setTiles([]);
      setAnswer([]);
    }
  } // ✅ IMPORTANT: this closing brace was missing in your backup

  function loadNextQuestion() {
    setCurrentIndex((prev) =>
      prev + 1 < QUESTIONS.length ? prev + 1 : QUESTIONS.length,
    );
  }

  function addToAnswer(word) {
    if (status === "correct" || status === "reveal") return;
    setAnswer((prev) => [...prev, word]);
    setTiles((prev) => prev.filter((w) => w !== word));
  }

  function handleTryAgain() {
    setAnswer([]);
    setWrongIndexes([]);
    setStatus("idle");
    setShowHint(false);
    setAttempts(0);

    if (activeMode === "typing") {
      setTypedAnswer("");
      return;
    }

    if (currentQuestion?.type === "REORDER") {
      const reshuffled = [...currentQuestion.correctOrder].sort(
        () => Math.random() - 0.5,
      );
      setTiles(reshuffled);
    }
  }

  function checkAnswer() {
    if (!currentQuestion) return;
    if (status === "correct") return;

    // ⌨️ TYPING validation
    if (activeMode === "typing") {
      const normalize = (s) =>
        String(s || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ");

      const target = (currentQuestion.correctOrder || []).join(" ");
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

        commitXP({ isCorrect: true, attemptNo: attemptNumber, mode: "typing" });

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

      commitXP({ isCorrect: true, attemptNo: attemptNumber, mode: "reorder" });

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
  if (activeMode !== "reorder" && activeMode !== "typing") {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Practice mode: {activeMode}</h1>
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
  if (currentIndex >= QUESTIONS.length) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">🎉 Session Complete!</h1>
        <p className="mb-4">Great job! You finished today’s practice.</p>

        <button
          className="bg-purple-600 text-white px-6 py-3 rounded-lg"
          onClick={() => {
            setCurrentIndex(0);
            setStatus("idle");
          }}
        >
          Practice Again
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
      {activeMode === "typing" && (
        <>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
            <div className="text-sm text-slate-600 mb-2">
              Type this sentence:
            </div>
            <div className="text-lg font-semibold">
              {(currentQuestion.correctOrder || []).join(" ")}
            </div>
          </div>

          <textarea
            value={typedAnswer}
            onChange={(e) => setTypedAnswer(e.target.value)}
            placeholder="Type the full sentence here..."
            className="w-full border rounded-lg p-3 mb-4 min-h-[90px]"
            disabled={status === "correct" || status === "reveal"}
          />
        </>
      )}

      {/* REORDER UI */}
      {activeMode === "reorder" && currentQuestion.type === "REORDER" && (
        <>
          {/* Answer Area */}
          <div className="border-2 border-dashed rounded-lg p-4 min-h-[70px] mb-4 flex flex-wrap gap-2">
            {answer.map((word, index) => {
              const isWrong = wrongIndexes.includes(index);
              return (
                <span
                  key={index}
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
                onClick={() => addToAnswer(word)}
                className="px-4 py-2 rounded-full bg-blue-600 text-white hover:opacity-90"
              >
                {word}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Check */}
      {status === "idle" && (
        <button
          onClick={checkAnswer}
          className="w-full bg-purple-600 text-white py-3 rounded-lg text-lg"
        >
          Check Answer
        </button>
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
              {currentQuestion.correctOrder.map((word, index) => (
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
