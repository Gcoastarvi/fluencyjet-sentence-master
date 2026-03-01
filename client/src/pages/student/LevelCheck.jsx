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
          {mode === "pick" && (
            <div className="grid gap-8 md:grid-cols-2 mt-8">
              {/* Left: Coach Info */}
              <div className="flex flex-col items-center text-center md:items-start md:text-left">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img
                      src="/coach.jpg"
                      alt="Coach Aravind"
                      className="h-16 w-16 rounded-full border-2 border-violet-100 object-cover shadow-sm bg-slate-100"
                      onError={(e) => {
                        e.currentTarget.src = "/avatar-fallback.png";
                      }}
                    />
                    <div className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500"></div>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-slate-900 leading-tight">
                      Aravind • English Coach
                    </div>
                    <div className="text-xs font-medium text-violet-600">
                      FluencyJet Expert
                    </div>
                  </div>
                </div>

                {/* Conversational "Coach" Bubble */}
                <div className="relative mt-6 w-full">
                  <div className="absolute -top-1 left-6 h-3 w-3 rotate-45 border-l border-t border-violet-100 bg-violet-50" />
                  <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-5 shadow-sm backdrop-blur-sm">
                    <p className="text-[15px] leading-relaxed text-violet-900">
                      "I’ll help you find your current level. It’s just{" "}
                      <span className="font-bold underline decoration-violet-300 underline-offset-4">
                        10 quick questions
                      </span>
                      ."
                    </p>
                    <div className="mt-4 flex items-center justify-between border-t border-violet-100/50 pt-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-500">
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Takes 2 minutes
                      </div>
                      <div className="flex gap-1.5">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className={`h-1.5 w-1.5 rounded-full ${i === 0 ? "bg-violet-400" : "bg-slate-200"}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Start Action */}
              <div className="flex flex-col justify-center rounded-2xl bg-slate-50 p-8 text-center border border-slate-100">
                <div className="mb-4 text-sm font-medium text-slate-500">
                  Ready to start?
                </div>
                <button
                  type="button"
                  onClick={() => setMode("quiz")}
                  className="group flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-violet-200 transition-all hover:bg-violet-700 hover:shadow-violet-300 active:scale-95"
                >
                  Start Level Test
                  <span className="transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </button>
                <div className="mt-6 flex justify-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <span>10 Questions</span>
                  <span>•</span>
                  <span>Instant Result</span>
                </div>
              </div>
            </div>
          )}

          {mode === "quiz" && (
            <div className="max-w-2xl mx-auto">
              {/* Quiz Content Logic (Your lines 272-337 would stay inside here) */}
              <div className="mb-8">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs font-bold text-violet-600 uppercase tracking-widest">
                    Question {idx + 1} of {QUESTIONS.length}
                  </span>
                  <span className="text-xs text-slate-400">
                    Initial Assessment
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 transition-all duration-300"
                    style={{
                      width: `${((idx + 1) / QUESTIONS.length) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="text-xl font-bold text-slate-900 mb-6">
                {QUESTIONS[idx].q}
              </div>

              <div className="grid gap-3">
                {QUESTIONS[idx].options.map((opt, optIdx) => (
                  <button
                    key={opt}
                    onClick={() =>
                      setAnswers((a) => ({ ...a, [QUESTIONS[idx].id]: optIdx }))
                    }
                    className={`p-4 text-left rounded-xl border-2 transition-all ${
                      answers[QUESTIONS[idx].id] === optIdx
                        ? "border-violet-600 bg-violet-50"
                        : "border-slate-100 hover:border-violet-200"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => setIdx((i) => Math.max(0, i - 1))}
                  className="text-slate-500 font-medium"
                >
                  Back
                </button>
                {idx < QUESTIONS.length - 1 ? (
                  <button
                    onClick={() => setIdx((i) => i + 1)}
                    disabled={answers[QUESTIONS[idx].id] === undefined}
                    className="bg-slate-900 text-white px-6 py-2 rounded-lg disabled:opacity-50"
                  >
                    Next Question
                  </button>
                ) : (
                  <button
                    onClick={finishQuiz}
                    className="bg-violet-600 text-white px-6 py-2 rounded-lg font-bold"
                  >
                    See My Result
                  </button>
                )}
              </div>
            </div>
          )}

          {mode === "result" && (
            <div className="text-center py-10">
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                Your Level: {result?.track}
              </h2>
              <p className="text-slate-600 mb-8">
                Great job completing the assessment!
              </p>
              <button
                onClick={() => goToTrack(result.track)}
                className="bg-violet-600 text-white px-10 py-4 rounded-xl font-bold shadow-lg"
              >
                Start Learning Now
              </button>

              <div className="mt-12 pt-6 border-t border-slate-100 flex justify-between items-center text-slate-400 text-xs">
                <span>Test complete • 2 min session</span>
                <span className="font-medium uppercase tracking-widest opacity-60">
                  FluencyJet Engine v1.0
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
