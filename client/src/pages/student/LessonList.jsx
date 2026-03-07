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
        // 🎯 Use the 'api' object to call your backend
        // Your endpoint likely expects 'difficulty' as a query param
        const res = await api.api.get(`/lessons?difficulty=${difficulty}`);
        const data = res?.data ?? res;
        setLessons(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Fetch error:", err);
        setLessons([]); // Fallback to empty array to prevent .slice crash
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
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-16">
      {modules.map((module) => (
        <section key={module.id} className="relative">
          {/* Unit Header */}
          <div className="mb-8 p-6 rounded-[2rem] bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-xl">
            <h2 className="text-2xl font-black italic">Unit {module.id}</h2>
          </div>

          {/* Staggered Path */}
          <div className="flex flex-col items-center gap-8 relative">
            <div className="absolute top-0 bottom-0 w-1 bg-slate-100 left-1/2 -translate-x-1/2 -z-10" />
            {module.lessons.map((lesson, idx) => (
              <div
                key={lesson.id}
                className={
                  idx % 2 !== 0 ? "sm:translate-x-12" : "sm:-translate-x-12"
                }
              >
                <LessonNode
                  lesson={lesson}
                  isLocked={idx > 2 && module.id > 1}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
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
