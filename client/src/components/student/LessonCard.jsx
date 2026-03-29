// client/src/components/student/LessonCard.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

import { readProgress, pct } from "@/lib/progressStore";

export default function LessonCard({ lesson, displayNum, isLocked }) {
  const navigate = useNavigate();  

  const lessonKey = Number(lesson.day_number || displayNum || lesson.id || 0);

  const typingProg = pct(readProgress(lessonKey, "typing"));
  const reorderProg = pct(readProgress(lessonKey, "reorder"));
  const audioProg = pct(readProgress(lessonKey, "audio"));

  const overallDone = Math.round((typingProg + reorderProg + audioProg) / 3);
  const isStarted = overallDone > 0;

  const handleClick = () => {
    if (isLocked) return;
    const basePath = window.location.pathname.startsWith("/i/")
      ? "/i/lesson"
      : "/b/lesson";
    const difficulty = window.location.pathname.startsWith("/i/")
      ? "intermediate"
      : "basic";

    navigate(`${basePath}/${lessonKey}?difficulty=${difficulty}`, {
      state: { lessonNumber: displayNum },
    });
  };

  return (
    <div
      className={`relative bg-white rounded-[2.5rem] border p-6 mb-4 transition-all 
          ${isLocked ? "opacity-75" : "hover:shadow-xl hover:-translate-y-1"}
          ${overallDone === 100 ? "border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.15)]" : "border-slate-200"}`}
    >
      {/* 🏆 Golden Medal: Only appears at 100% Mastery */}
      {overallDone === 100 && (
        <div className="absolute -top-3 -left-3 h-10 w-10 bg-amber-400 rounded-full flex items-center justify-center shadow-lg animate-bounce-subtle z-20 border-2 border-white">
          <span className="text-white text-lg">🏅</span>
        </div>
      )}

      {/* 📊 Overall Progress Badge */}
      <div
        className={`absolute top-6 right-6 px-3 py-1 rounded-full text-[10px] font-black uppercase ${overallDone === 100 ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-500"}`}
      >
        {overallDone}% done
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex-1">
          <h3 className="text-xl font-black text-slate-900">
            Lesson {displayNum}: {lesson.title || `Mastery Path ${displayNum}`}
          </h3>
          <p className="text-sm font-medium text-slate-400 mt-1">
            {lesson.description ||
              "Master these sentence structures through active practice."}
          </p>

          {/* 📊 Mode Chips Row */}
          <div className="flex flex-wrap gap-2 mt-4">
            <ModeChip label="Typing" value={typingProg} color="orange" />
            <ModeChip label="Reorder" value={reorderProg} color="indigo" />
            <ModeChip label="Audio" value={audioProg} color="emerald" />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleClick}
            disabled={isLocked}
            className={`px-8 py-3 rounded-2xl font-black text-sm transition-all ${
              isLocked
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95"
            }`}
          >
            {isLocked ? "Locked 🔒" : isStarted ? "Continue →" : "Start →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// 🎨 Helper Component for Mode Chips
function ModeChip({ label, value, color }) {
  const colors = {
    orange: "bg-orange-50 text-orange-600 border-orange-100",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  };
  return (
    <div
      className={`px-3 py-1 rounded-full border text-[11px] font-bold ${colors[color]}`}
    >
      {label} • {value}%
    </div>
  );
}
