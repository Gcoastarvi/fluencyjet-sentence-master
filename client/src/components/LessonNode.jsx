import React from "react";
import { useNavigate } from "react-router-dom";

export default function LessonNode({ lesson, displayNum, isLocked }) {
  const navigate = useNavigate();

  // Calculate progress circle (circumference)
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const progress = lesson.progress || 0;
  const offset = circumference - (progress / 100) * circumference;

  const handleClick = () => {
    if (isLocked) return;

    const isIntermediate =
      lesson.level === "INTERMEDIATE" ||
      window.location.pathname.startsWith("/i/");
    const basePath = isIntermediate ? "/i/lesson" : "/b/lesson";
    const difficulty = isIntermediate ? "intermediate" : "basic";

    // 🎯 Pass the displayNum in the state object
    navigate(`${basePath}/${lesson.id}?difficulty=${difficulty}`, {
      state: { lessonNumber: displayNum },
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLocked}
      className={`group relative flex flex-col items-center transition-all duration-300 ${isLocked ? "cursor-not-allowed grayscale" : "hover:scale-110"}`}
    >
      {/* 🏆 The Circular Node */}
      <div className="relative h-24 w-24 flex items-center justify-center">
        {/* Progress Ring Background */}
        <svg className="absolute h-full w-full -rotate-90">
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth="8"
          />
          {/* Active Progress Ring */}
          {!isLocked && (
            <circle
              cx="48"
              cy="48"
              r={radius}
              fill="transparent"
              stroke="#6366f1"
              strokeWidth="8"
              strokeDasharray={circumference}
              style={{
                strokeDashoffset: offset,
                transition: "stroke-dashoffset 1s ease-in-out",
              }}
              strokeLinecap="round"
            />
          )}
        </svg>

        {/* 🎨 Center Icon/Number */}
        <div
          className={`h-16 w-16 rounded-full flex items-center justify-center text-xl font-black shadow-lg
          ${isLocked ? "bg-slate-200 text-slate-400" : "bg-white text-indigo-600"}`}
        >
          {isLocked ? "🔒" : displayNum}
        </div>
      </div>

      {/* 📝 Label */}
      <div className="mt-2 text-center">
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">
          Lesson {displayNum}
        </p>
        {/* 🎯 Only show the title if it exists, otherwise hide to avoid duplication */}
        {lesson.title && lesson.title !== `Lesson ${displayNum}` && (
          <p className="text-xs font-bold text-slate-800 max-w-[120px] truncate">
            {lesson.title}
          </p>
        )}
      </div>
    </button>
  );
}
