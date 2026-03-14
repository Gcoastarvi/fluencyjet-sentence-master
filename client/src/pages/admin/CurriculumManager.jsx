import React, { useState, useEffect } from "react";
import { getAdminLessons } from "@/api/adminApi"; // Ensure this exists

export default function CurriculumManager() {
  const [modules, setModules] = useState([]);

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12">
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">
            Curriculum Master
          </h2>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2">
            12 Modules • 120 Mastery Lessons
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((mod) => (
            <div
              key={mod}
              className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl group hover:border-indigo-500 transition-all"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-xl font-black">
                  {mod}
                </div>
                <span className="bg-emerald-50 text-emerald-600 text-[10px] font-black px-3 py-1 rounded-full uppercase">
                  10 Lessons Active
                </span>
              </div>
              <h4 className="text-xl font-black text-slate-900 mb-2">
                Module {mod}: Basic Structures
              </h4>
              <p className="text-slate-500 text-sm font-medium mb-6">
                Mastering subject-verb-object patterns in Tamil & English.
              </p>

              <button className="w-full py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-colors">
                Audit Lessons
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
