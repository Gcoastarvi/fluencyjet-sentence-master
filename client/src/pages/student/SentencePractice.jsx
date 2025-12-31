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
 * NOTE:
 * XP is server-authoritative. Client only shows what server returns.
 * attemptNo is still useful as an input to server rules.
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

  // If you already have FILL questions in your real app, keep them here (example format):
  // {
  //   type: "FILL",
  //   tamil: "...",
  //   sentence: "I ____ daily to improve my English",
  //   options: ["practice", "sleep", "cry"],
  //   answer: "practice",
  // },
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

  // FILL state
  const [selectedOption, setSelectedOption] = useState(null);
  const [typedAnswer, setTypedAnswer] = useState("");

  // server-driven UI
  const [earnedXP, setEarnedXP] = useState(0);
  const [showXPToast, setShowXPToast] = useState(false);
  const [streak, setStreak] = useState(0);

  const totalQuestions = QUESTIONS.length;

  const currentQuestion = useMemo(() => {
    const q = QUESTIONS[currentIndex];
    if (!q) return null;
    return {
      ...q,
      type: q.type || "REORDER",
    };
  }, [currentIndex]);

  // -------------------
  // effects (ALL INSIDE COMPONENT)
  // -------------------

  // 🔁 Smart Resume on load (optional)
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

  // 🔊 Initialize sound effects once
  useEffect(() => {
    correctSoundRef.current = new Audio("/sounds/correct.mp3");
    wrongSoundRef.current = new Audio("/sounds/wrong.mp3");
  }, []);

  // Initialize question when index changes
  useEffect(() => {
    initQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // AUTO NEXT QUESTION after correct/reveal
  useEffect(() => {
    if (status === "correct" || status === "reveal") {
      const timer = setTimeout(() => {
        loadNextQuestion();
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [status]);

  // -------------------
  // backend canonical XP commit (single pipe)
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

      // apiClient usually returns { ok, data } style or axios-like.
      // We handle both safely:
      const data = res?.data ?? res;
      if (data?.ok) {
        setEarnedXP(data.xpAwarded || 0);
        setStreak(data.streak || 0);
        setShowXPToast(true);
        setTimeout(() => setShowXPToast(false), 1200);
      } else {
        // if server returns ok:false, still show 0 XP
        setEarnedXP(0);
      }
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

    // reset common state
    setAttempts(0);
    setStatus("idle");
    setShowHint(false);
    setWrongIndexes([]);
    setEarnedXP(0);

    // reset FILL
    setSelectedOption(null);
    setTypedAnswer("");

    if (currentQuestion.type === "REORDER") {
      const shuffled = [...currentQuestion.correctOrder].sort(
        () => Math.random() - 0.5,
      );
      setTiles(shuffled);
      setAnswer([]);
    } else {
      // FILL: no tiles/answer required
      setTiles([]);
      setAnswer([]);
    }
  }

  function loadNextQuestion() {
    setCurrentIndex((prev) => (prev + 1 < QUESTIONS.length ? prev + 1 : 0));
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

    if (currentQuestion?.type === "REORDER") {
      const reshuffled = [...currentQuestion.correctOrder].sort(
        () => Math.random() - 0.5,
      );
      setTiles(reshuffled);
    }
  }

  function checkAnswer() {
    if (!currentQuestion) return;

    // ⛔ GUARD: already solved
    if (status === "correct") return;

    // 🧩 FILL validation
    if (currentQuestion.type === "FILL") {
      const userAnswer = (selectedOption || typedAnswer || "").trim();

      if (!userAnswer) {
        setStatus("wrong");
        setShowHint(true);
        return;
      }

      const attemptNumber = attempts + 1;

      if (userAnswer === currentQuestion.answer) {
        correctSoundRef.current?.play?.();
        setStatus("correct");

        commitXP({
          isCorrect: true,
          attemptNo: attemptNumber,
          mode: "fill",
        });

        return;
      }

      // wrong FILL
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
    // ⛔ GUARD: incomplete answer
    if (answer.length !== currentQuestion.correctOrder.length) {
      setStatus("wrong");
      setShowHint(true);
      return;
    }

    const incorrect = [];
    answer.forEach((word, index) => {
      if (word !== currentQuestion.correctOrder[index]) {
        incorrect.push(index);
      }
    });

    // CORRECT
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
  if (activeMode !== "reorder") {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Practice mode: {activeMode}</h1>
        <p className="text-gray-600">
          This mode is coming next. For now, use <b>/practice/reorder</b>.
        </p>
      </div>
    );
  }

  // -------------------
  // conditional return (MUST BE INSIDE)
  // -------------------
  if (!currentQuestion) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">No questions found</h1>
        <p className="text-gray-600">Please reload.</p>
      </div>
    );
  }

  if (currentIndex >= QUESTIONS.length) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">🎉 Session Complete!</h1>
        <p className="mb-4">Great job! You finished today’s practice.</p>

        <button
          className="bg-purple-600 text-white px-6 py-3 rounded-lg"
          onClick={() => {
            setCurrentIndex(0);
            initQuiz();
          }}
        >
          Practice Again
        </button>
      </div>
    );
  }

  // -------------------
  // final return
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

      {/* 🧩 Fill in the Blank UI */}
      {currentQuestion.type === "FILL" && (
        <>
          <div className="border-2 border-dashed rounded-lg p-4 mb-4 text-lg">
            {currentQuestion.sentence.split("____")[0]}
            <span className="inline-block min-w-[70px] mx-2 px-3 py-1 border-b-2 border-purple-600 text-center font-semibold">
              {selectedOption || "____"}
            </span>
            {currentQuestion.sentence.split("____")[1]}
          </div>

          <div className="flex flex-wrap gap-3 mb-6">
            {(currentQuestion.options || []).map((opt) => (
              <button
                key={opt}
                onClick={() => setSelectedOption(opt)}
                className={`px-4 py-2 rounded-full border transition ${
                  selectedOption === opt
                    ? "bg-purple-600 text-white"
                    : "bg-white"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}

      {/* REORDER UI */}
      {currentQuestion.type === "REORDER" && (
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
      {status === "reveal" && currentQuestion.type === "REORDER" && (
        <div className="bg-yellow-100 p-4 rounded mt-6">
          📘 <strong>Good attempt! Here is the correct order:</strong>
          <div className="flex flex-wrap gap-2 mt-3">
            {currentQuestion.correctOrder.map((word, index) => (
              <span key={index} className="px-3 py-1 bg-green-200 rounded">
                {word}
              </span>
            ))}
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
