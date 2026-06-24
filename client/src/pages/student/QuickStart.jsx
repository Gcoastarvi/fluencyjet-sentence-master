import { useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  getStoredFunnelContext,
  sendToFunnelSheet,
} from "@/lib/funnelSheet";

const QUICK_START_DAY_NUMBER = 900001;

const PRACTICE_MODES = [
  {
    title: "Reorder",
    description: "Arrange the words to build each sentence.",
    mode: "reorder",
    variant: "",
    badge: "Recommended First",
    accent: "border-violet-300 bg-violet-50 text-violet-950",
  },
  {
    title: "Typing",
    description: "Type each English sentence from the Tamil prompt.",
    mode: "typing",
    variant: "",
    accent: "border-amber-300 bg-amber-50 text-amber-950",
  },
  {
    title: "Audio Repeat",
    description: "Listen, repeat and build speaking confidence.",
    mode: "audio",
    variant: "repeat",
    accent: "border-emerald-300 bg-emerald-50 text-emerald-950",
  },
  {
    title: "Dictation",
    description: "Listen carefully and type what you hear.",
    mode: "audio",
    variant: "dictation",
    accent: "border-sky-300 bg-sky-50 text-sky-950",
  },
];

export default function QuickStart() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewedRef = useRef(false);

  const context = useMemo(() => getStoredFunnelContext(), []);
  const user = context.user || {};
  const segment = String(
    searchParams.get("segment") || context.segment || "general",
  )
    .trim()
    .toLowerCase();

  function sendQuickStartAction(action, mode = "", variant = "") {
    sendToFunnelSheet({
      type: "quick_start_action",
      action,
      source: "free_live_class",
      name: user.name || "",
      email: user.email || "",
      whatsapp_number: user.whatsapp_number || user.whatsapp || "",
      segment,
      main_goal: context.main_goal || user.main_goal || "",
      track: context.track || user.track || "BEGINNER",
      mode,
      variant,
      page_url: window.location.href,
    });
  }

  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    sendQuickStartAction("Quick Start Viewed");
  }, []);

  function selectMode(mode, variant) {
    sendQuickStartAction("Quick Start Mode Selected", mode, variant);

    const params = new URLSearchParams({
      lessonId: String(QUICK_START_DAY_NUMBER),
      difficulty: "beginner",
      context: "quick-start",
      source: "free_live_class",
      segment,
    });

    if (variant) params.set("variant", variant);
    navigate(`/practice/${mode}?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6">
      <main className="mx-auto max-w-5xl">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-700 via-indigo-700 to-slate-900 p-7 shadow-2xl sm:p-10">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-100">
            First step in your 120-lesson FluencyJet learning path
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-6xl">
            Your First Sentence Challenge
          </h1>
          <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-indigo-100 sm:text-xl">
            Complete your first 10 sentences in Reorder mode in approximately
            three minutes. Then practise the same sentences through Typing,
            Audio and Dictation.
          </p>

          <div className="mt-7 inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-black">
            <span className="text-xl">10</span> useful sentences
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {PRACTICE_MODES.map((card) => (
            <button
              key={`${card.mode}-${card.variant || "default"}`}
              type="button"
              onClick={() => selectMode(card.mode, card.variant)}
              className={`rounded-3xl border p-6 text-left shadow-lg transition hover:-translate-y-1 hover:shadow-xl ${card.accent}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">{card.title}</h2>
                  <p className="mt-2 font-semibold leading-6 opacity-80">
                    {card.description}
                  </p>
                </div>
                {card.badge ? (
                  <span className="shrink-0 rounded-full bg-violet-700 px-3 py-1 text-xs font-black text-white">
                    {card.badge}
                  </span>
                ) : null}
              </div>
              <p className="mt-6 font-black">Start {card.title} →</p>
            </button>
          ))}
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 text-center sm:p-8">
          <h2 className="text-2xl font-black">This is your starter challenge</h2>
          <p className="mx-auto mt-3 max-w-3xl font-semibold leading-7 text-slate-300">
            FluencyJet includes 120 guided lessons that build your English step
            by step. These 10 sentences are simply your first quick win.
          </p>
        </section>
      </main>
    </div>
  );
}
