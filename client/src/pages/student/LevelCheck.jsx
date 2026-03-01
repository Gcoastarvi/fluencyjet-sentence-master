import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getToken } from "@/utils/tokenStore";

import confetti from "canvas-confetti";

import SentenceBuilder from "@/components/quiz/SentenceBuilder";

const TRACK_KEY = "fj_track";

const TRACK_METADATA = {
  beginner: {
    title: "Solid Foundations",
    description:
      "Great start! You have a clear grasp of basic sentence structures. We'll focus on building your core vocabulary and daily conversational confidence.",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  intermediate: {
    title: "Natural Flow",
    description:
      "Impressive work! You're navigating complex word orders well. Now, let's polish your nuances and master those tricky advanced tenses.",
    color: "text-violet-600",
    bg: "bg-violet-50",
  },
  advanced: {
    title: "Fluent Mastery",
    description:
      "Exceptional! Your structural accuracy is top-tier. We will focus on idiomatic expressions and high-level professional communication to reach native-like fluency.",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
};

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

  // 173: Async function to sync results with Railway DB
  async function finishQuiz() {
    const finalScore = score;
    let track = "beginner";
    if (finalScore >= 8) track = "advanced";
    else if (finalScore >= 5) track = "intermediate";

    // Set local state first for immediate UI feedback
    setResult({ score: finalScore, track });

    try {
      // 🚀 Trigger the Backend Sync
      const response = await api.post("/quizzes/sync-placement", {
        track: track,
      });

      if (response.data?.ok) {
        console.log("[SYNC] Profile successfully updated to:", track);
      }
    } catch (err) {
      console.error("❌ Placement sync failed:", err);
      // We don't block the user if sync fails; they still see their results
    }

    // Trigger the premium celebration effects
    const levelUpSound = new Audio("/sounds/levelup.mp3");
    levelUpSound.volume = 0.5;
    levelUpSound.play().catch(() => {});

    setMode("result");

    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#8b5cf6", "#a78bfa", "#c4b5fd"],
    });
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

              {/* 251: Right Column - Finalized Start Action */}
              <div className="relative flex flex-col justify-center rounded-3xl bg-slate-50/50 p-8 text-center border border-slate-100 shadow-inner">
                {/* Decorative Background Element */}
                <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-violet-100/30 blur-2xl" />

                <div className="relative">
                  <div className="mb-6 text-sm font-semibold uppercase tracking-widest text-slate-400">
                    Ready to start?
                  </div>

                  <button
                    type="button"
                    onClick={() => setMode("quiz")}
                    className="group relative w-full flex items-center justify-center gap-3 rounded-2xl bg-violet-600 px-8 py-5 text-xl font-extrabold text-white shadow-xl shadow-violet-200 transition-all hover:-translate-y-1 hover:bg-violet-700 hover:shadow-violet-300 active:scale-95"
                  >
                    <span>Start Level Test</span>
                    <svg
                      className="h-6 w-6 transition-transform group-hover:translate-x-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </button>

                  <div className="mt-8 flex items-center justify-center gap-6 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                      10 Questions
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Instant Result
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 290: Refined Quiz Interface */}
          {mode === "quiz" && (
            <div className="max-w-md mx-auto py-8 flex flex-col items-center">
              {/* Top Progress Header */}
              <div className="mb-12">
                <div className="flex justify-between items-end mb-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-violet-500 uppercase tracking-[0.2em] mb-1">
                      Assessment in Progress
                    </span>
                    <h2 className="text-xl font-extrabold text-slate-900">
                      Question {idx + 1}{" "}
                      <span className="text-slate-400 font-medium">
                        / {QUESTIONS.length}
                      </span>
                    </h2>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <div className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                      Live Analysis
                    </span>
                  </div>
                </div>

                {/* Smooth Progress Bar */}
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-violet-400 to-violet-600 transition-all duration-500 ease-out rounded-full"
                    style={{
                      width: `${((idx + 1) / QUESTIONS.length) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Question Text */}
              {/* Tightened Question Text */}
              <div className="mb-6 text-center">
                <div className="inline-block px-3 py-1 rounded-md bg-violet-50 text-violet-700 text-[10px] font-bold uppercase tracking-widest mb-4">
                  Grammar & Structure
                </div>
                <h3 className="text-2xl font-black text-slate-800 leading-tight px-4">
                  {QUESTIONS[idx].q}
                </h3>
              </div>

              {/* Option Grid */}
              {/* 386: Option Grid with Sound Feedback */}
              {/* 389: Smart Question Content Switcher */}
              <div className="w-full">
                {QUESTIONS[idx].type === "reorder" ? (
                  <SentenceBuilder
                    key={QUESTIONS[idx].id}
                    correctSentence={QUESTIONS[idx].correctAnswer}
                    onCorrect={() => {
                      const audio = new Audio("/sounds/correct.mp3");
                      audio.play().catch(() => {});
                      // Set the answer in state to enable the "Next" button
                      setAnswers((a) => ({ ...a, [QUESTIONS[idx].id]: true }));
                    }}
                    accentColor="violet"
                  />
                ) : (
                  /* Standard Multiple Choice Grid */
                  <div className="grid gap-3 w-full max-w-sm mx-auto">
                    {QUESTIONS[idx].options.map((opt, optIdx) => {
                      const isSelected = answers[QUESTIONS[idx].id] === optIdx;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            const clickSound = new Audio("/sounds/correct.mp3");
                            clickSound.volume = 0.4;
                            clickSound.play().catch(() => {});
                            setAnswers((a) => ({
                              ...a,
                              [QUESTIONS[idx].id]: optIdx,
                            }));
                          }}
                          className={`group relative flex items-center gap-4 p-5 text-left rounded-2xl border-2 transition-all duration-200 active:scale-[0.98] ${
                            isSelected
                              ? "border-violet-600 bg-violet-50 shadow-md translate-x-1"
                              : "border-slate-100 bg-white hover:border-violet-200 hover:bg-slate-50/50 hover:-translate-y-0.5"
                          }`}
                        >
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 font-bold transition-all ${
                              isSelected
                                ? "border-violet-600 bg-violet-600 text-white shadow-lg shadow-violet-200"
                                : "border-slate-100 bg-slate-50 text-slate-400 group-hover:border-violet-200 group-hover:text-violet-600"
                            }`}
                          >
                            {String.fromCharCode(65 + optIdx)}
                          </div>
                          <span
                            className={`text-lg font-medium ${isSelected ? "text-violet-900" : "text-slate-700"}`}
                          >
                            {opt}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 382: Refined Navigation - Forward Only */}
              {/* 421: Compact & Polished Navigation */}
              <div className="mt-8 flex justify-center pt-6 border-t border-slate-100/60">
                {idx < QUESTIONS.length - 1 ? (
                  <button
                    onClick={() => setIdx((i) => i + 1)}
                    disabled={answers[QUESTIONS[idx].id] === undefined}
                    className="group flex items-center gap-3 bg-slate-900 text-white px-10 py-4 rounded-xl font-bold shadow-lg hover:bg-slate-800 disabled:opacity-30 transition-all active:scale-95"
                  >
                    Next Question
                    <svg
                      className="h-5 w-5 transition-transform group-hover:translate-x-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={finishQuiz}
                    disabled={answers[QUESTIONS[idx].id] === undefined}
                    className="bg-violet-600 text-white px-12 py-4 rounded-2xl font-black text-lg shadow-xl shadow-violet-200 hover:bg-violet-700 hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-50"
                  >
                    Calculate Level
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 439: Shareable Result Card */}
          {mode === "result" && (
            <div className="py-6 text-center">
              {/* Badge Header */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold uppercase tracking-widest mb-6 border border-emerald-100">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Assessment Verified
              </div>

              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em] mb-2">
                Proficiency Level
              </h2>

              {/* Dynamic Result Visual */}
              <div className="relative inline-block mb-10">
                <div className="absolute inset-0 bg-violet-400 blur-3xl opacity-20 animate-pulse" />
                <div className="relative bg-white border-2 border-violet-100 rounded-3xl px-12 py-8 shadow-2xl shadow-violet-100">
                  <h1 className="text-6xl font-black text-violet-600 capitalize leading-none tracking-tight">
                    {result?.track}
                  </h1>
                </div>
              </div>

              {/* 478: Score Breakdown Tiles */}
              <div className="max-w-md mx-auto grid grid-cols-2 gap-4 mb-8">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Accuracy
                  </div>
                  <div className="text-xl font-bold text-slate-800">High</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Pace
                  </div>
                  <div className="text-xl font-bold text-slate-800">Fast</div>
                </div>
              </div>

              {/* Personalized Level Feedback */}
              <div
                className={`mb-10 p-6 rounded-3xl border ${TRACK_METADATA[result.track].bg} border-opacity-50 inline-block max-w-sm mx-auto shadow-sm`}
              >
                <h3
                  className={`text-xs font-black uppercase tracking-[0.2em] mb-2 ${TRACK_METADATA[result.track].color}`}
                >
                  {TRACK_METADATA[result.track].title}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed font-medium">
                  {TRACK_METADATA[result.track].description}
                </p>
              </div>

              {/* Primary Actions */}
              <div className="flex flex-col gap-4 max-w-sm mx-auto">
                <button
                  onClick={() => goToTrack(result.track)}
                  className="w-full bg-violet-600 text-white px-10 py-5 rounded-2xl font-black text-xl shadow-xl shadow-violet-200 hover:bg-violet-700 hover:-translate-y-1 active:scale-95 transition-all"
                >
                  Start {result?.track} Journey
                </button>

                <button
                  onClick={() => window.location.reload()}
                  className="text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors"
                >
                  Retake Assessment
                </button>
              </div>

              {/* Shareable Footer */}
              <div className="mt-16 pt-8 border-t border-slate-100 flex justify-between items-center text-slate-300">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                  Verified by FluencyJet AI
                </div>
                <span className="text-[9px] font-medium uppercase tracking-[0.2em] opacity-60">
                  FJ-ENGINE V1.0
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
