import React from "react";
import { uiFor } from "@/lib/modeUi";

import { useAuth } from "../../context/AuthContext";

export default function PracticeHeader({
  lid,
  difficulty,
  mode,
  currentIndex,
  total,
  streakText,
  onBack,
}) {
  const ui = uiFor(mode);
  const safeTotal = Math.max(Number(total || 0), 0);
  const q = Math.min(Number(currentIndex || 0) + 1, Math.max(safeTotal, 1));
  const pct = safeTotal ? Math.round((q / safeTotal) * 100) : 0;
  const { auth } = useAuth();
  const displayStreakText = `${Number(auth?.user?.daily_streak || 0)}-day streak`;

  const difficultyLabel =
    String(difficulty || "").toLowerCase() === "intermediate"
      ? "INTERMEDIATE"
      : "BEGINNER";

  return (
    <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-3xl px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">
                Lesson {lid || "—"}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {difficultyLabel}
              </span>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                {ui.title}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Question <span className="font-semibold text-slate-800">{q}</span>
              <span className="text-slate-300"> / </span>
              <span className="font-semibold text-slate-800">{safeTotal}</span>
            </span>
            <span className="inline-flex items-center gap-2 font-semibold text-orange-600">
              🔥 {displayStreakText}
            </span>
          </div>

          <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-slate-900"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
      {/* 🎯 Premium Status: Flame + Shield */}
      <div className="flex items-center gap-3">
        {auth?.user?.daily_streak > 0 && (
          <div className="flex items-center gap-1 bg-orange-50 border border-orange-100 px-3 py-1 rounded-full shadow-sm animate-fade-in">
            <span className="text-lg leading-none">🔥</span>
            <span className="text-xs font-black text-orange-600 uppercase tracking-tight">
              {auth?.user?.daily_streak} Day Streak
            </span>
            <div className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse ml-1" />
          </div>
        )}

        {/* 🛡️ Streak Freeze Shield (Premium Only) */}
        {auth?.user?.plan === "BEGINNER" && (
          <div className="group relative">
            <div className="bg-blue-50 border border-blue-100 p-1.5 rounded-full shadow-sm cursor-help">
              <span title="Streak Protected" className="text-sm">
                🛡️
              </span>
            </div>
            <div className="absolute top-full right-0 mt-2 hidden group-hover:block bg-slate-900 text-[10px] text-white py-1 px-2 rounded whitespace-nowrap z-50 shadow-xl">
              Premium Streak Freeze Active
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
