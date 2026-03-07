import React from "react";
import { useNavigate } from "react-router-dom";

export default function LessonNode({ lesson, isLocked }) {
  const navigate = useNavigate();

  // Calculate progress circle (circumference)
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const progress = lesson.progress || 0; // 0 to 100
  const offset = circumference - (progress / 100) * circumference;

  const handleClick = () => {
    if (isLocked) return;
    // Routes to your specific pathing logic
    const path = lesson.level === "INTERMEDIATE" ? "/i/lesson" : "/b/lesson";
    navigate(
      `${path}/${lesson.id}?difficulty=${lesson.level === "INTERMEDIATE" ? "intermediate" : "basic"}`,
    );
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
            stroke="#e2e8f0"
            strokeWidth="8"
          />
          {/* Active Progress Ring */}
          {!isLocked && (
            <circle
              cx="48"
              cy="48"
              r={radius}
              fill="transparent"
              stroke="#6366f1" // Indigo-600
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
          {isLocked ? "🔒" : lesson.id}
        </div>
      </div>

      {/* 📝 Label */}
      <div className="mt-2 text-center">
        <p className="text-[10px] font-black uppercase text-slate-500 tracking-tighter">
          Lesson {lesson.id}
        </p>
        <p className="text-xs font-bold text-slate-800 max-w-[100px] truncate">
          {lesson.title || "Simple Present"}
        </p>
      </div>
    </button>
  );
}
