import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/apiClient";

// ─────────────────────────────────────────────────────────────────────────────
// Practice Question Bank
// NOTE: These are currently REORDER-style questions. Typing mode reuses these.
// ─────────────────────────────────────────────────────────────────────────────
const QUESTIONS = [
  {
    id: "RJ_001",
    type: "REORDER",
    tamil: "நான் இன்று பள்ளிக்குச் சென்றேன்.",
    correctOrder: ["I", "went", "to", "school", "today."],
    distractors: ["go", "tomorrow", "market", "yesterday"],
  },
  {
    id: "RJ_002",
    type: "REORDER",
    tamil: "அவர் நேற்று என்னை பார்த்தார்.",
    correctOrder: ["He", "saw", "me", "yesterday."],
    distractors: ["see", "tomorrow", "her", "today"],
  },
  {
    id: "RJ_003",
    type: "REORDER",
    tamil: "நாங்கள் காலை உணவு சாப்பிட்டோம்.",
    correctOrder: ["We", "ate", "breakfast", "in", "the", "morning."],
    distractors: ["eat", "night", "dinner", "on"],
  },
  {
    id: "RJ_004",
    type: "REORDER",
    tamil: "அவர்கள் மிகவும் மகிழ்ச்சியாக இருந்தார்கள்.",
    correctOrder: ["They", "were", "very", "happy."],
    distractors: ["are", "sad", "now", "was"],
  },
  {
    id: "RJ_005",
    type: "REORDER",
    tamil: "நான் அவருக்கு உதவி செய்தேன்.",
    correctOrder: ["I", "helped", "him."],
    distractors: ["help", "her", "tomorrow", "yesterday"],
  },
];

// Supported practice modes
const SUPPORTED_PRACTICE_MODES = new Set([
  "reorder",
  "typing",
  "cloze",
  "audio",
]);
const DEFAULT_PRACTICE_MODE = "reorder";

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function SentencePractice() {
  const { mode } = useParams();
  const navigate = useNavigate();

  const activeMode = SUPPORTED_PRACTICE_MODES.has(mode || "")
    ? mode
    : DEFAULT_PRACTICE_MODE;

  // Redirect /practice to /practice/reorder (or default mode)
  useEffect(() => {
    if (!mode)
      navigate(`/practice/${DEFAULT_PRACTICE_MODE}`, { replace: true });
  }, [mode, navigate]);

  // Session / Quiz state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tiles, setTiles] = useState([]);
  const [answer, setAnswer] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | correct | wrong | reveal
  const [earnedXP, setEarnedXP] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [attempts, setAttempts] = useState(0);

  // For "FILL" style and Typing
  const [selectedOption, setSelectedOption] = useState("");
  const [typedAnswer, setTypedAnswer] = useState("");

  // Audio feedback
  const correctSoundRef = useRef(null);
  const wrongSoundRef = useRef(null);

  // XP config
  const XP_PER_CORRECT = activeMode === "typing" ? 150 : 150;

  // ───────────────────────────────────────────────────────────────────────────
  // Derived current question
  // ───────────────────────────────────────────────────────────────────────────
  const currentQuestion = useMemo(() => {
    const q = QUESTIONS[currentIndex % QUESTIONS.length];
    const baseType = q.type || "REORDER";

    // Typing mode uses the SAME questions as reorder, but checks typed sentence instead of dragging tiles.
    const type = activeMode === "typing" ? "TYPING" : baseType;

    return { ...q, type };
  }, [activeMode, currentIndex]);

  const correctSentence = useMemo(() => {
    if (!currentQuestion?.correctOrder) return "";
    return currentQuestion.correctOrder.join(" ");
  }, [currentQuestion]);

  const normalizeText = (s) =>
    String(s || "")
      .toLowerCase()
      // keep letters/numbers/spaces/apostrophes; drop punctuation
      .replace(/[^a-z0-9\s']/g, "")
      .replace(/\s+/g, " ")
      .trim();

  // ───────────────────────────────────────────────────────────────────────────
  // Init question
  // ───────────────────────────────────────────────────────────────────────────
  function initQuiz() {
    setStatus("idle");
    setEarnedXP(0);
    setShowHint(false);
    setAttempts(0);

    // reset answer inputs
    setSelectedOption("");
    setTypedAnswer("");

    if (currentQuestion.type === "REORDER") {
      // shuffle tiles: correct words + distractors
      const allWords = [
        ...currentQuestion.correctOrder,
        ...currentQuestion.distractors,
      ];
      const shuffled = [...allWords].sort(() => Math.random() - 0.5);

      setTiles(shuffled);
      setAnswer([]);
    } else {
      // typing / fill: no tiles
      setTiles([]);
      setAnswer([]);
    }
  }

  useEffect(() => {
    initQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, activeMode]);

  // ───────────────────────────────────────────────────────────────────────────
  // Tile click (reorder)
  // ───────────────────────────────────────────────────────────────────────────
  function pickTile(word) {
    if (status !== "idle") return;
    setAnswer((prev) => [...prev, word]);
    setTiles((prev) =>
      prev.filter((w, idx) => !(w === word && idx === prev.indexOf(word))),
    );
  }

  function removeLastWord() {
    if (status !== "idle") return;
    setAnswer((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setTiles((t) => [...t, last]);
      return prev.slice(0, -1);
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Commit XP to backend
  // ───────────────────────────────────────────────────────────────────────────
  async function commitXP(payload) {
    try {
      const res = await api.post("/xp/commit", payload);
      const data = res?.data ?? res;

      if (data?.ok) {
        setEarnedXP(Number(data.xpAwarded || XP_PER_CORRECT));
        // Let dashboard refresh
        window.dispatchEvent(
          new CustomEvent("fj:xp_updated", { detail: data }),
        );
      }
    } catch (e) {
      console.error("commitXP failed:", e);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Try again handler
  // ───────────────────────────────────────────────────────────────────────────
  function handleTryAgain() {
    setStatus("idle");
    setShowHint(false);
    setAttempts(0);

    if (currentQuestion.type === "REORDER") {
      // re-init reorder tiles/answer
      const allWords = [
        ...currentQuestion.correctOrder,
        ...currentQuestion.distractors,
      ];
      const reshuffled = [...allWords].sort(() => Math.random() - 0.5);
      setTiles(reshuffled);
      setAnswer([]);
    } else {
      // typing / fill
      setTypedAnswer("");
      setSelectedOption("");
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Check Answer
  // ───────────────────────────────────────────────────────────────────────────
  function checkAnswer() {
    if (status !== "idle") return;

    const MAX_ATTEMPTS = 2;

    // ✍️ TYPING validation (compare typed sentence with the correct sentence)
    if (currentQuestion.type === "TYPING") {
      const user = normalizeText(typedAnswer);
      const target = normalizeText(correctSentence);

      if (!user) {
        setStatus("wrong");
        setShowHint(true);
        return;
      }

      const attemptNumber = attempts + 1;

      if (user === target) {
        correctSoundRef.current?.play?.();
        setStatus("correct");

        commitXP({
          mode: "typing",
          questionId: currentQuestion.id,
          correct: true,
          attempt: attemptNumber,
        });

        try {
          localStorage.setItem(
            "fj_last_session",
            JSON.stringify({ practiceType: "typing" }),
          );
        } catch {}

        // go next
        setTimeout(() => {
          setAttempts(0);
          setStatus("idle");
          setShowHint(false);
          setTypedAnswer("");
          setCurrentIndex((i) => i + 1);
        }, 700);

        return;
      }

      // wrong
      wrongSoundRef.current?.play?.();
      setAttempts(attemptNumber);
      setStatus("wrong");

      if (attemptNumber >= MAX_ATTEMPTS) {
        // reveal correct answer after max attempts
        setStatus("reveal");
        setEarnedXP(0);
        setShowHint(true);
      } else {
        setShowHint(true);
      }

      return;
    }

    // FILL validation (if ever used later)
    if (currentQuestion.type === "FILL") {
      const userAnswer = (selectedOption || typedAnswer || "").trim();
      const correct = (currentQuestion.correct || "").trim();

      if (!userAnswer) {
        setStatus("wrong");
        setShowHint(true);
        return;
      }

      const attemptNumber = attempts + 1;

      if (userAnswer.toLowerCase() === correct.toLowerCase()) {
        correctSoundRef.current?.play?.();
        setStatus("correct");
        commitXP({
          mode: "cloze",
          questionId: currentQuestion.id,
          correct: true,
          attempt: attemptNumber,
        });
        setTimeout(() => {
          setAttempts(0);
          setStatus("idle");
          setShowHint(false);
          setSelectedOption("");
          setTypedAnswer("");
          setCurrentIndex((i) => i + 1);
        }, 700);
      } else {
        wrongSoundRef.current?.play?.();
        setAttempts(attemptNumber);
        setStatus("wrong");
        if (attemptNumber >= MAX_ATTEMPTS) {
          setStatus("reveal");
          setEarnedXP(0);
          setShowHint(true);
        } else {
          setShowHint(true);
        }
      }
      return;
    }

    // REORDER validation
    const correct =
      answer.length === currentQuestion.correctOrder.length &&
      answer.every((word, i) => word === currentQuestion.correctOrder[i]);

    const attemptNumber = attempts + 1;

    if (correct) {
      correctSoundRef.current?.play?.();
      setStatus("correct");

      commitXP({
        mode: "reorder",
        questionId: currentQuestion.id,
        correct: true,
        attempt: attemptNumber,
      });

      try {
        localStorage.setItem(
          "fj_last_session",
          JSON.stringify({ practiceType: activeMode }),
        );
      } catch {}

      setTimeout(() => {
        setAttempts(0);
        setStatus("idle");
        setShowHint(false);
        setCurrentIndex((i) => i + 1);
      }, 700);
    } else {
      wrongSoundRef.current?.play?.();
      setAttempts(attemptNumber);
      setStatus("wrong");
      if (attemptNumber >= 2) {
        setStatus("reveal");
        setEarnedXP(0);
        setShowHint(true);
      } else {
        setShowHint(true);
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Coming soon guard (typing is enabled)
  // ───────────────────────────────────────────────────────────────────────────
  // typing is now enabled; keep other modes as "coming next"
  if (activeMode !== "reorder" && activeMode !== "typing") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <div className="max-w-xl w-full text-center p-6 rounded-2xl border bg-white shadow-sm">
          <h1 className="text-2xl font-semibold mb-2">
            Practice mode: {activeMode}
          </h1>
          <p className="text-slate-600">
            This mode is coming next. For now, use{" "}
            <code>/practice/reorder</code> or <code>/practice/typing</code>.
          </p>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <audio ref={correctSoundRef} src="/sounds/correct.mp3" preload="auto" />
      <audio ref={wrongSoundRef} src="/sounds/wrong.mp3" preload="auto" />

      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold">Sentence Practice</h1>
        <span className="text-sm text-slate-600">
          Mode: <strong>{activeMode}</strong>
        </span>
      </div>

      <div className="p-4 rounded-xl border bg-white shadow-sm">
        <div className="text-slate-700 mb-2">
          <span className="font-semibold">Tamil:</span> {currentQuestion.tamil}
        </div>

        {/* ✍️ Typing UI */}
        {currentQuestion.type === "TYPING" && (
          <div className="mb-4">
            <div className="text-sm text-slate-600 mb-2">
              Type the correct English sentence:
            </div>
            <textarea
              className="w-full border rounded-lg p-3 min-h-[90px]"
              value={typedAnswer}
              onChange={(e) => setTypedAnswer(e.target.value)}
              placeholder="Type here..."
              disabled={status === "correct"}
            />
            <div className="text-xs text-slate-500 mt-2">
              Tip: Extra spaces and punctuation won’t matter.
            </div>

            {showHint && status !== "correct" && (
              <div className="mt-3 text-sm text-slate-700">
                <span className="font-semibold">Hint:</span> {correctSentence}
              </div>
            )}
          </div>
        )}

        {/* 🔀 Reorder UI */}
        {currentQuestion.type === "REORDER" && (
          <>
            <div className="mb-3">
              <span className="text-sm text-slate-600">
                Tap words to form the sentence:
              </span>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {tiles.map((word, idx) => (
                <button
                  key={`${word}_${idx}`}
                  className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 border text-sm"
                  onClick={() => pickTile(word)}
                  disabled={status !== "idle"}
                >
                  {word}
                </button>
              ))}
            </div>

            <div className="p-3 border rounded-lg bg-slate-50 min-h-[56px]">
              {answer.length === 0 ? (
                <span className="text-slate-400 text-sm">
                  Your sentence appears here…
                </span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {answer.map((word, idx) => (
                    <span
                      key={`${word}_${idx}`}
                      className="px-3 py-1 rounded bg-white border"
                    >
                      {word}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                className="px-3 py-2 text-sm rounded bg-slate-900 text-white disabled:opacity-50"
                onClick={removeLastWord}
                disabled={status !== "idle" || answer.length === 0}
              >
                Undo last
              </button>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center gap-3">
          {status === "idle" && (
            <button
              className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={checkAnswer}
            >
              Check Answer
            </button>
          )}

          {status === "wrong" && (
            <>
              <div className="text-red-600 font-semibold">
                Wrong — try again.
              </div>
              <button
                className="px-4 py-2 rounded bg-slate-900 text-white"
                onClick={handleTryAgain}
              >
                Try again
              </button>
            </>
          )}

          {status === "correct" && (
            <div className="text-green-700 font-semibold">
              ✅ Correct! +{earnedXP || XP_PER_CORRECT} XP
            </div>
          )}
        </div>

        {/* Reveal */}
        {status === "reveal" && (
          <div className="bg-yellow-100 p-4 rounded mt-6">
            📘 <strong>Good attempt! Here is the correct answer:</strong>
            {currentQuestion.type === "REORDER" ? (
              <div className="flex flex-wrap gap-2 mt-3">
                {currentQuestion.correctOrder.map((word, index) => (
                  <span key={index} className="px-3 py-1 bg-green-200 rounded">
                    {word}
                  </span>
                ))}
              </div>
            ) : currentQuestion.type === "TYPING" ? (
              <div className="mt-3 p-3 bg-white rounded border text-slate-800">
                {correctSentence}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
