import React from "react";
import { uiFor } from "@/lib/modeUi";

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
                {difficulty}
              </span>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                {ui.title}
              </span>
            </div>

            <div className="mt-1 text-xs text-slate-500">{ui.sub}</div>
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
              🔥 {streakText || "0-day streak"}
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
    </div>
  );
}
