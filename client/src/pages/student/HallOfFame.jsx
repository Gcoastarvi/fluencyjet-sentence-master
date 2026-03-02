import React, { useEffect, useState } from "react";
import { api } from "@/api/apiClient";
import PracticeHeader from "@/components/layout/PracticeHeader";

export default function HallOfFame() {
  const [completedLessons, setCompletedLessons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHallOfFame() {
      try {
        const res = await api.get("/quizzes/hall-of-fame");
        if (res.ok) setCompletedLessons(res.lessons || []);
      } catch (err) {
        console.error("Failed to load Hall of Fame", err);
      } finally {
        setLoading(false);
      }
    }
    fetchHallOfFame();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="mx-auto max-w-xl p-4">
        <header className="mb-8 text-center pt-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-[10px] font-black uppercase tracking-widest mb-4">
            <span className="text-sm">🏆</span> Hall of Fame
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Your Mastery Wall
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-medium">
            Every lesson you've crushed is recorded here.
          </p>
        </header>

        {loading ? (
          <div className="flex justify-center p-20">
            <div className="animate-spin h-8 w-8 border-4 border-violet-500 border-t-transparent rounded-full" />
          </div>
        ) : completedLessons.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] p-12 text-center border border-slate-200 shadow-sm">
            <div className="text-5xl mb-4">🧗</div>
            <h2 className="text-lg font-bold text-slate-800">
              The wall is empty... for now
            </h2>
            <p className="text-slate-500 text-sm mt-2">
              Complete a lesson to 100% to earn your first entry.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {completedLessons.map((lesson) => (
              <div
                key={lesson.id}
                className="group relative bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">
                      Lesson {lesson.dayNumber}
                    </h3>
                    <div className="text-xs font-bold text-emerald-600 uppercase tracking-tight flex items-center gap-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />{" "}
                      Verified Mastery
                    </div>
                  </div>
                  <div className="text-4xl">📜</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
