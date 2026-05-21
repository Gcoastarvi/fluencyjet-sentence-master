// client/src/components/student/LessonCard.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

import { readProgress, pct } from "@/lib/progressStore";
import { lessonMeta } from "@/data/lessonMeta";

import { useAuth } from "../../context/AuthContext";
import { freeAllowsLesson } from "../../lib/accessRules";

export default function LessonCard({ lesson, displayNum, isLocked }) {
  const navigate = useNavigate();

  const { auth } = useAuth();

  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  })();

  const progressUserId =
    auth?.user?.id ||
    auth?.user?.email ||
    auth?.id ||
    auth?.email ||
    storedUser?.id ||
    storedUser?.email ||
    null;

  const lessonKey = Number(lesson.day_number || displayNum || lesson.id || 0);

  const isIntermediateRoute = window.location.pathname.startsWith("/i/");
  const levelKey = isIntermediateRoute ? "intermediate" : "beginner";

  const meta = lessonMeta?.[levelKey]?.[lessonKey];

  const rawLessonTitle = lesson?.title || "";
  const isGenericLessonTitle =
    rawLessonTitle === `Lesson ${lessonKey}` ||
    rawLessonTitle === `Lesson ${displayNum}`;

  const cardTitle =
    meta?.title ||
    (!isGenericLessonTitle && rawLessonTitle
      ? rawLessonTitle
      : `Lesson ${lessonKey}`);

  const cardOutcome =
    meta?.outcome ||
    lesson?.description ||
    "Master these sentence structures through active practice.";

  const tamilOutcome = meta?.tamilOutcome;

  const typingProg = pct(readProgress(progressUserId, lessonKey, "typing"));
  const reorderProg = pct(readProgress(progressUserId, lessonKey, "reorder"));
  const audioProg = pct(readProgress(progressUserId, lessonKey, "audio"));

  const overallDone = Math.round((typingProg + reorderProg + audioProg) / 3);
  const isStarted = overallDone > 0;

  const handleClick = () => {
    if (isLocked) return;

    const isIntermediate = window.location.pathname.startsWith("/i/");
    const basePath = isIntermediate ? "/i/lesson" : "/b/lesson";
    const difficulty = isIntermediate ? "intermediate" : "beginner";

    const effectivePlan = String(
      auth?.user?.plan || auth?.plan || storedUser?.plan || "FREE",
    ).toUpperCase();

    const effectiveTrack = String(
      auth?.user?.track || auth?.track || storedUser?.track || "",
    ).toUpperCase();

    const currentRouteTrack = isIntermediate ? "INTERMEDIATE" : "BEGINNER";

    const hasManualAccess =
      auth?.user?.has_access === true ||
      auth?.has_access === true ||
      storedUser?.has_access === true ||
      storedUser?.hasAccess === true;

    const hasTrackAccess =
      effectivePlan === "PRO" ||
      effectivePlan === "PAID" ||
      (hasManualAccess &&
        (effectivePlan === currentRouteTrack ||
          effectiveTrack === currentRouteTrack));

    const isFreeLesson = freeAllowsLesson(lessonKey);

    if (!hasTrackAccess && !isFreeLesson) {
      const plan = isIntermediate ? "INTERMEDIATE" : "BEGINNER";
      navigate(
        `/paywall?plan=${encodeURIComponent(plan)}&from=lesson_${lessonKey}&difficulty=${encodeURIComponent(difficulty)}`,
        { replace: true },
      );
      return;
    }

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
          <div className="mb-3 text-lg md:text-xl font-black uppercase tracking-[0.22em] text-slate-600">
            Lesson {lessonKey}
          </div>

          <h3 className="text-2xl md:text-[28px] font-black text-slate-950 leading-tight">
            {cardTitle}
          </h3>

          {tamilOutcome && (
            <div className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
              <p className="text-lg md:text-[19px] font-bold leading-relaxed text-slate-800 font-tamil">
                {tamilOutcome}
              </p>
            </div>
          )}

          {/* 📊 Mode Chips Row */}
          <div className="flex flex-wrap gap-3 mt-5">
            <ModeChip label="Typing" value={typingProg} color="orange" />
            <ModeChip label="Reorder" value={reorderProg} color="indigo" />
            <ModeChip label="Audio" value={audioProg} color="emerald" />
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleClick}
              disabled={isLocked}
              className={`px-9 py-4 rounded-2xl font-black text-base transition-all ${
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
      className={`px-5 py-2.5 rounded-full border text-base md:text-[17px] font-black ${colors[color]}`}
    >
      {label} • {value}%
    </div>
  );
}
