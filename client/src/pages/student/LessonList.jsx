import React, { useMemo, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import * as api from "../../api/apiClient";
import { useAuth } from "../../context/AuthContext";
import LessonCard from "../../components/student/LessonCard";

export default function LessonList({ difficulty }) {
  // 🎯 1. Fundamental Hooks
  const navigate = useNavigate();
  const location = useLocation();
  const { auth } = useAuth();

  // 🎯 2. Local State
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState({ 1: true });

  // 🎯 3. Toggle Logic
  const toggleModule = (id) => {
    setExpandedModules((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // 🎯 4. Data Fetching (Starting your original useEffect)

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        setLoading(true);
        const response = await api.api.get(`/lessons?difficulty=${difficulty}`);

        // 🎯 Dig into the correct object property based on your console log
        const incomingData = response?.data || [];

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
      return (
      <>
        {/* 🏆 Sticky Unit Progress & Navigation */}
        <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
          <div className="max-w-2xl mx-auto px-6 pt-4 pb-2">
            {/* Your existing progress bar logic */}
            <div className="flex justify-between items-end mb-2">
              <div>
                <h3 className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">
                  Current Progress
                </h3>
                <p className="text-sm font-bold text-slate-900">
                  Module Mastery
                </p>
              </div>
              <span className="text-xs font-black text-indigo-600">
                {/* Keep your existing Math.round calculation here */}
                Overall
              </span>
            </div>
            {/* Progress Bar Container */}
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-indigo-500 transition-all duration-1000"
                style={{ width: "0%" }}
              />
            </div>

            {/* 🎯 NEW: Quick Navigation Pill Menu */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {modules.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    if (!expandedModules[m.id]) toggleModule(m.id);
                    document
                      .getElementById(`unit-${m.id}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-tighter transition-all whitespace-nowrap border-2 ${
                    expandedModules[m.id]
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "bg-white border-slate-100 text-slate-400"
                  }`}
                >
                  Unit {m.id}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 📚 Lesson Path */}
        <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
          {modules.map((module) => (
            <section
              key={module.id}
              id={`unit-${module.id}`}
              className="relative"
            >
              {/* 🎯 UPDATED: Clickable Unit Header */}
              <button
                onClick={() => toggleModule(module.id)}
                className="w-full mb-4 p-6 rounded-[2rem] bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-xl flex justify-between items-center transition-transform active:scale-95"
              >
                <h2 className="text-2xl font-black italic">Unit {module.id}</h2>
                <span className="text-xl opacity-50">
                  {expandedModules[module.id] ? "▲" : "▼"}
                </span>
              </button>

              {/* 🎯 Staggered Path Block - Only shows if expanded */}
              {expandedModules[module.id] && (
                <div className="flex flex-col items-center gap-8 relative animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="absolute top-0 bottom-0 w-1 bg-slate-100 left-1/2 -translate-x-1/2 -z-10" />
                  {module.lessons.map((lesson, idx) => {
                    const displayNum = (module.id - 1) * 10 + (idx + 1);
                    const isLocked =
                      auth?.user?.has_access === false && displayNum > 3;
                    return (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        displayNum={displayNum}
                        isLocked={isLocked}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      </>
      );
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
