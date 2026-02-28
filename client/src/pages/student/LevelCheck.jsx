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

  function goToTrack(track, opts = {}) {
    try {
      localStorage.setItem(TRACK_KEY, track);

      const raw = localStorage.getItem("user");
      const u = raw ? JSON.parse(raw) : {};
      localStorage.setItem("user", JSON.stringify({ ...u, track }));
    } catch {}

    const token = getToken();

    // If we want to start Lesson 1 (teach first → then practice)
    if (opts && opts.startLesson1) {
      const difficulty = track === "intermediate" ? "intermediate" : "beginner";
      const base = track === "intermediate" ? "/i" : "/b";
      const lessonHubUrl = `${base}/lesson/1?difficulty=${encodeURIComponent(difficulty)}`;

      if (!token) {
        navigate(`/signup?next=${encodeURIComponent(lessonHubUrl)}`, {
          replace: true,
        });
        return;
      }

      navigate(lessonHubUrl, { replace: true });
      return;
    }

    // Default behavior: go to Lesson 1 hub (teach first → then practice)
    const difficulty = track === "intermediate" ? "intermediate" : "beginner";
    const base = track === "intermediate" ? "/i" : "/b";
    const target = `${base}/lesson/1?difficulty=${encodeURIComponent(difficulty)}`;

    if (!token) {
      navigate(`/signup?next=${encodeURIComponent(target)}`, { replace: true });
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
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-white via-slate-50 to-violet-50/40 py-10">
      <div className="mx-auto max-w-4xl px-4">
        <div className="rounded-3xl border border-slate-200 bg-white/75 p-6 shadow-sm backdrop-blur">
          <h1 className="text-2xl font-semibold text-slate-900">Level Test</h1>
          <p className="mt-2 text-slate-600">
            Find your English level in 2 minutes.
          </p>

          {mode === "pick" && (
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              {/* Left: Coach-guided mini panel */}
              <div className="rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur">
                <div className="flex items-start gap-4">
                  <img
                    src="/coach.jpg"
                    alt="Aravind - English Coach"
                    className="h-14 w-14 rounded-full border border-slate-200 object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "/avatar-fallback.png";
                    }}
                  />

                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">
                      Aravind • English Coach
                    </div>

                    {/* One-line “assistant style” bubble, minimal */}
                    <div className="mt-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white">
                      I will find your level. Just answer 10 questions.
                    </div>

                    <div className="mt-3 text-xs text-slate-500">
                      Takes 2 minutes
                    </div>

                    {/* Preview progress strip */}
                    <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
                      <div className="h-2 w-[18%] rounded-full bg-violet-500/80" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Simple action card */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-xl font-semibold text-slate-900">
                  Find Your English Level
                </div>

                <div className="mt-2 text-sm text-slate-600">
                  10 questions • 2 minutes
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setAnswers({});
                    setIdx(0);
                    setResult(null);
                    setMode("quiz");
                  }}
                  className="group mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-violet-600 px-5 py-4 text-base font-semibold text-white shadow-sm transition
                           hover:bg-violet-700 hover:shadow-md active:scale-[0.99]"
                >
                  Start Level Test
                  <span className="ml-2 transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </button>
              </div>
            </div>
          )}

          {mode === "quiz" && (
            <div className="mt-6">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <div>
                  Question <span className="font-semibold">{idx + 1}</span> of{" "}
                  {QUESTIONS.length}
                </div>
                <div className="text-xs">
                  Score: <span className="font-semibold">{score}</span>
                </div>
              </div>

              <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-violet-500/80 transition-all"
                  style={{
                    width: `${Math.round(((idx + 1) / QUESTIONS.length) * 100)}%`,
                  }}
                />
              </div>

              <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-lg font-semibold text-slate-900">
                  Select the correct sentence
                </div>
                <div className="mt-2 text-sm text-slate-600">{current.q}</div>

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
                        className={`rounded-2xl border border-slate-200 p-4 text-left transition
                        hover:-translate-y-[1px] hover:border-violet-200 hover:bg-violet-50/40
                        ${selected ? "border-violet-600 bg-violet-50 ring-2 ring-violet-200" : ""}
                      `}
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
                        disabled={answers[current.id] == null}
                        className="rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition
                         hover:bg-violet-700 hover:shadow-sm active:scale-[0.99]
                         disabled:opacity-40 disabled:cursor-not-allowed"
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
                  {result.track === "intermediate"
                    ? "Intermediate"
                    : "Beginner"}
                </span>
              </div>

              <div className="mt-2 text-sm text-slate-600">
                You can switch later anytime.
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() =>
                    goToTrack(result.track, { startLesson1: true })
                  }
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-white font-semibold hover:opacity-95"
                >
                  Start Lesson 1 now (Free) →
                </button>

                <button
                  type="button"
                  onClick={() => goToTrack(result.track)}
                  className="rounded-xl border px-5 py-2.5 font-semibold hover:bg-gray-50"
                >
                  See all lessons
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

              <div className="mt-2 text-xs text-slate-500">Takes 2 minutes</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
