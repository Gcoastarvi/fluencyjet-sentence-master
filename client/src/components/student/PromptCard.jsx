import React from "react";

export default function PromptCard({ tamil }) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-xs font-semibold text-slate-500">Tamil prompt</div>
        <div className="mt-2 rounded-xl bg-slate-50 p-4 text-xl font-semibold text-slate-900">
          {tamil || "—"}
        </div>
      </div>
    </div>
  );
}
