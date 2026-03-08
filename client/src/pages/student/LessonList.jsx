import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
// 🎯 Use the asterisk (*) to grab all exports and name them 'api'
import * as api from "../../api/apiClient";
import LessonNode from "../../components/LessonNode";

export default function LessonList({ difficulty }) {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        setLoading(true);
        const response = await api.api.get(`/lessons?difficulty=${difficulty}`);

        // 🎯 Dig into the correct object property based on your console log
        const incomingData = response?.data?.lessons || [];

        if (Array.isArray(incomingData) && incomingData.length > 0) {
          setLessons(incomingData);
        } else {
          console.warn(
            "No lessons found in the 'lessons' array for:",
            difficulty,
          );
          setLessons([]);
        }
      } catch (err) {
        console.error("Fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLessons();
  }, [difficulty]);

  const modules = useMemo(() => {
    if (!lessons.length) return [];
    return Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      lessons: lessons.slice(i * 10, (i + 1) * 10),
    }));
  }, [lessons]);

  if (loading) return <LessonSkeleton />;

  return (
    <>
      {/* 🏆 Sticky Unit Progress Bar */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 py-4 shadow-sm">
        <div className="max-w-2xl mx-auto px-6">
          <div className="flex justify-between items-end mb-2">
            <div>
              <h3 className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">
                Current Progress
              </h3>
              <p className="text-sm font-bold text-slate-900">Module Mastery</p>
            </div>
            <span className="text-xs font-black text-indigo-600">
              {Math.round(
                (lessons.filter((l) => (l.progress || 0) >= 100).length / 120) *
                  100,
              )}
              % Overall
            </span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all duration-1000 ease-out"
              style={{
                width: `${(lessons.filter((l) => (l.progress || 0) >= 100).length / 120) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* 📚 Lesson Path */}
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-16">
        {modules.map((module) => (
          <section key={module.id} className="relative">
            {/* Unit Header */}
            <div className="mb-8 p-6 rounded-[2rem] bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-xl">
              <h2 className="text-2xl font-black italic">Unit {module.id}</h2>
            </div>

            {/* 🎯 Staggered Path Block */}
            <div className="flex flex-col items-center gap-8 relative">
              <div className="absolute top-0 bottom-0 w-1 bg-slate-100 left-1/2 -translate-x-1/2 -z-10" />

              {module.lessons.map((lesson, idx) => {
                // Calculate display number: Unit 1 starts at 1, Unit 2 starts at 11
                const displayNum = (module.id - 1) * 10 + (idx + 1);
                return (
                  <div
                    key={lesson.id}
                    className={
                      idx % 2 !== 0 ? "sm:translate-x-12" : "sm:-translate-x-12"
                    }
                  >
                    <LessonNode
                      lesson={lesson}
                      displayNum={displayNum}
                      // 🎯 Respects Mango's database access instead of a hardcoded limit
                      isLocked={!auth?.user?.has_access && displayNum > 3}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

// 🎯 Dopamine-friendly Skeleton Screen
const LessonSkeleton = () => (
  <div className="max-w-2xl mx-auto px-4 py-10 animate-pulse space-y-12">
    {[1, 2].map((i) => (
      <div key={i}>
        <div className="h-24 w-full bg-slate-200 rounded-3xl mb-8" />
        <div className="flex flex-col items-center gap-8">
          {[1, 2, 3].map((j) => (
            <div key={j} className="h-20 w-20 rounded-full bg-slate-100" />
          ))}
        </div>
      </div>
    ))}
  </div>
);
