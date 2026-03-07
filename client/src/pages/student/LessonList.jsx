// client/src/pages/student/LessonList.jsx

import React, { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import LessonNode from "../../components/LessonNode"; // We will create this next

export default function LessonList({ lessons }) {
  // 1. Logic to group 120 lessons into 12 Modules (10 each)
  const modules = useMemo(() => {
    // 🎯 Guard: If lessons is undefined or null, return an empty array
    if (!lessons) return [];

    return Array.from({ length: 12 }, (_, i) => {
      const moduleNumber = i + 1;
      const startIdx = i * 10;
      return {
        id: moduleNumber,
        title: `Unit ${moduleNumber}`,
        // 🎯 Safe slice: Now we know lessons exists
        lessons: lessons.slice(startIdx, startIdx + 10),
      };
    });
  }, [lessons]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {modules.map((module) => (
        <section key={module.id} className="mb-16 relative">
          {/* 🎯 Unit Header Card */}
          <div className="mb-8 p-6 rounded-[2rem] bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-70">
                Module {module.id}
              </span>
              <h2 className="text-2xl font-black mt-1">
                {module.id === 1
                  ? "The Foundation"
                  : `Unit ${module.id} Mastery`}
              </h2>
            </div>
            {/* Background Decoration */}
            <div className="absolute -right-4 -bottom-4 text-8xl opacity-10 rotate-12">
              {module.id}
            </div>
          </div>

          {/* 🚀 The Vertical Path (Stepping Stones) */}
          <div className="flex flex-col items-center gap-6 relative">
            {/* Vertical connector line */}
            <div className="absolute top-0 bottom-0 w-1 bg-slate-100 left-1/2 -translate-x-1/2 -z-10 rounded-full" />

            {module.lessons.map((lesson, idx) => {
              // Stagger the nodes left and right for a "path" feel
              const isStaggered = idx % 2 !== 0;

              return (
                <div
                  key={lesson.id}
                  className={`flex w-full items-center ${isStaggered ? "justify-center sm:translate-x-12" : "justify-center sm:-translate-x-12"}`}
                >
                  <LessonNode
                    lesson={lesson}
                    isLocked={lesson.id > 10} // Optional: Lock logic for demo
                  />
                </div>
              );
            })}
          </div>

          {/* Module Completion Reward Indicator */}
          <div className="mt-10 flex justify-center">
            <div className="px-6 py-2 bg-emerald-50 text-emerald-600 border-2 border-dashed border-emerald-200 rounded-2xl text-[10px] font-black uppercase tracking-tighter">
              Complete Unit {module.id} for a Badge 🏆
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
