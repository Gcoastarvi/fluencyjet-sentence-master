import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getToken } from "@/utils/tokenStore";

const TRACK_KEY = "fj_track";

const QUESTIONS = [
  // Beginner-ish (1–5)
  {
    id: 1,
    level: "beginner",
    q: "Choose the correct sentence:",
    options: [
      "He go to school.",
      "He goes to school.",
      "He going to school.",
      "He gone to school.",
    ],
    answer: 1,
  },
  {
    id: 2,
    level: "beginner",
    q: "Choose the correct word order:",
    options: [
      "Coffee I want.",
      "I coffee want.",
      "I want coffee.",
      "Want I coffee.",
    ],
    answer: 2,
  },
  {
    id: 3,
    level: "beginner",
    q: "Fill in the blank: I ___ a teacher.",
    options: ["is", "are", "am", "be"],
    answer: 2,
  },
  {
    id: 4,
    level: "beginner",
    q: "Choose the correct question:",
    options: [
      "Where you are going?",
      "Where are you going?",
      "Where going you are?",
      "Where you going are?",
    ],
    answer: 1,
  },
  {
    id: 5,
    level: "beginner",
    q: "Pick the correct option: She ___ like tea.",
    options: ["don't", "doesn't", "isn't", "aren't"],
    answer: 1,
  },

  // Intermediate-ish (6–10)
  {
    id: 6,
    level: "intermediate",
    q: "Choose the correct sentence:",
    options: [
      "I have seen him yesterday.",
      "I saw him yesterday.",
      "I have saw him yesterday.",
      "I seen him yesterday.",
    ],
    answer: 1,
  },
  {
    id: 7,
    level: "intermediate",
    q: "Fill in the blank: If I had time, I ___ help you.",
    options: ["will", "would", "am", "can"],
    answer: 1,
  },
  {
    id: 8,
    level: "intermediate",
    q: "Choose the correct sentence:",
    options: [
      "She has been working here since 2 years.",
      "She is working here since 2 years.",
      "She has been working here for 2 years.",
      "She working here for 2 years.",
    ],
    answer: 2,
  },
  {
    id: 9,
    level: "intermediate",
    q: "Pick the correct preposition: I’m interested ___ learning English.",
    options: ["on", "in", "at", "for"],
    answer: 1,
  },
  {
    id: 10,
    level: "intermediate",
    q: "Choose the best sentence:",
    options: [
      "Can you suggest me a book?",
      "Can you suggest a book to me?",
      "Can you suggesting a book?",
      "Can you suggested me a book?",
    ],
    answer: 1,
  },
];

export default function LevelCheck() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("pick"); // "pick" | "quiz" | "result"
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // { [questionId]: optionIndex }
  const [result, setResult] = useState(null); // { score, track }

  function goToTrack(track) {
    try {
      localStorage.setItem(TRACK_KEY, track);

      const raw = localStorage.getItem("user");
      const u = raw ? JSON.parse(raw) : {};
      localStorage.setItem("user", JSON.stringify({ ...u, track }));
    } catch {}

    const target = track === "intermediate" ? "/i/lessons" : "/b/lessons";
    const token = getToken();

    if (!token) {
      navigate(`/login?next=${encodeURIComponent(target)}`, { replace: true });
      return;
    }

    navigate(target, { replace: true });
  }

  const current = QUESTIONS[idx];

  const score = useMemo(() => {
    let s = 0;
    for (const q of QUESTIONS) {
      const a = answers[q.id];
      if (typeof a === "number" && a === q.answer) s += 1;
    }
    return s;
  }, [answers]);

  function finishQuiz() {
    const finalScore = score;
    const track = finalScore >= 6 ? "intermediate" : "beginner";
    setResult({ score: finalScore, track });
    setMode("result");
  }

  return (
    <div className="mx-auto max-w-3xl p-6 mt-8">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">Level Check</h1>
        <p className="mt-2 text-gray-600">
          Pick your starting level or take a 2-minute test. You can switch
          later.
        </p>

        {mode === "pick" && (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => goToTrack("beginner")}
                className="rounded-2xl border p-5 text-left hover:bg-gray-50"
              >
                <div className="text-lg font-semibold">Beginner</div>
                <div className="mt-1 text-sm text-gray-600">
                  Start from basics and build fluency step-by-step.
                </div>
                <div className="mt-3 inline-flex items-center text-sm font-semibold text-indigo-600">
                  Start Beginner →
                </div>
              </button>

              <button
                type="button"
                onClick={() => goToTrack("intermediate")}
                className="rounded-2xl border p-5 text-left hover:bg-gray-50"
              >
                <div className="text-lg font-semibold">Intermediate</div>
                <div className="mt-1 text-sm text-gray-600">
                  If you can form basic sentences already, start here.
                </div>
                <div className="mt-3 inline-flex items-center text-sm font-semibold text-indigo-600">
                  Start Intermediate →
                </div>
              </button>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <div className="text-xs text-gray-500">
                Tip: If you’re unsure, take the test.
              </div>
              <button
                type="button"
                onClick={() => {
                  setAnswers({});
                  setIdx(0);
                  setResult(null);
                  setMode("quiz");
                }}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-white font-semibold hover:opacity-95"
              >
                Take 2-minute test →
              </button>
            </div>
          </>
        )}

        {mode === "quiz" && (
          <div className="mt-6">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div>
                Question <span className="font-semibold">{idx + 1}</span> /{" "}
                {QUESTIONS.length}
              </div>
              <div className="text-xs">
                Score so far: <span className="font-semibold">{score}</span>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border p-5">
              <div className="text-lg font-semibold text-gray-900">
                {current.q}
              </div>

              <div className="mt-4 grid gap-3">
                {current.options.map((opt, optIdx) => {
                  const selected = answers[current.id] === optIdx;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        setAnswers((a) => ({ ...a, [current.id]: optIdx }))
                      }
                      className={`rounded-xl border p-4 text-left hover:bg-gray-50 ${
                        selected ? "border-indigo-600 bg-indigo-50" : ""
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMode("pick")}
                  className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
                >
                  ← Back
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIdx((n) => Math.max(0, n - 1))}
                    disabled={idx === 0}
                    className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-40"
                  >
                    Prev
                  </button>

                  {idx < QUESTIONS.length - 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setIdx((n) => Math.min(QUESTIONS.length - 1, n + 1))
                      }
                      className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                    >
                      Next →
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={finishQuiz}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                    >
                      See result →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {mode === "result" && result && (
          <div className="mt-6 rounded-2xl border p-6">
            <div className="text-sm text-gray-600">Your score</div>
            <div className="text-3xl font-bold text-gray-900">
              {result.score} / {QUESTIONS.length}
            </div>

            <div className="mt-4 text-lg font-semibold">
              Recommended:{" "}
              <span
                className={
                  result.track === "intermediate"
                    ? "text-indigo-700"
                    : "text-emerald-700"
                }
              >
                {result.track === "intermediate" ? "Intermediate" : "Beginner"}
              </span>
            </div>

            <div className="mt-2 text-sm text-gray-600">
              Don’t worry — you can switch later anytime.
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => goToTrack(result.track)}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-white font-semibold hover:opacity-95"
              >
                Start free lessons →
              </button>

              <button
                type="button"
                onClick={() => {
                  setAnswers({});
                  setIdx(0);
                  setResult(null);
                  setMode("quiz");
                }}
                className="rounded-xl border px-5 py-2.5 font-semibold hover:bg-gray-50"
              >
                Retake
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
