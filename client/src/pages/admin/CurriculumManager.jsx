//client/src/pages/admin/CurriculumManager.jsx
import React, { useState, useEffect } from "react";
import { getAdminLessons } from "@/api/adminApi";
import api from "@/api/api"; // Ensure this import is correct for your axios instance

export default function CurriculumManager() {
  // 🎯 State Hooks
  const [modules, setModules] = useState([]);
  const [editingLesson, setEditingLesson] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  // 🎯 CSV Validation Logic
  const validateCSV = (data) => {
    const errors = [];
    data.forEach((row, index) => {
      if (!row.tamil_sentence)
        errors.push(`Line ${index + 1}: Missing Tamil translation`);
      if (!row.english_mastery_goal)
        errors.push(`Line ${index + 1}: Missing English goal`);
      if (!row.module_id)
        errors.push(`Line ${index + 1}: No Module ID assigned`);
    });

    if (errors.length > 0) {
      alert("❌ CSV Errors Found:\n" + errors.slice(0, 5).join("\n"));
      return false;
    }
    return true;
  };

  // 🎯 CSV Upload Logic with Progress Bar
  const handleCSVUpload = async (file) => {
    if (!file) return;

    setIsImporting(true);
    setProgress(10);

    // Simulation of progress while uploading
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 90 ? 90 : prev + 10));
    }, 200);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // This calls your backend bulk-import route
      const response = await api.post(
        "/api/admin/lessons/bulk-import",
        formData,
      );

      if (response.data.ok) {
        setProgress(100);
        alert(`Success! ${response.data.count} lessons imported. 🚀`);
      }
    } catch (err) {
      console.error("Import error:", err);
      alert("Import failed. Check CSV format or Server logs.");
    } finally {
      clearInterval(interval);
      setTimeout(() => {
        setIsImporting(false);
        setProgress(0);
      }, 1500);
    }
  };

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

        <div className="flex justify-between items-center mb-12">
          <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">
              Curriculum Master
            </h2>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2">
              12 Modules • 120 Mastery Lessons
            </p>
          </div>

          <label className="cursor-pointer bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2">
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleCSVUpload(e.target.files[0])}
            />
            📥 Bulk Import CSV
          </label>
        </div>

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
      {/* ✍️ Instant Lesson Editor Slide-over */}
      {editingLesson && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-[300] p-8 animate-in slide-in-from-right duration-300 border-l border-slate-100">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter text-indigo-600">
              Edit Lesson
            </h3>
            <button
              onClick={() => setEditingLesson(null)}
              className="h-10 w-10 bg-slate-50 rounded-full flex items-center justify-center font-bold text-slate-400 hover:text-rose-500 transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="space-y-8">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                Tamil Sentence (Native)
              </label>
              <textarea
                className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                value={editingLesson.tamil}
                rows={3}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                English Mastery Goal
              </label>
              <textarea
                className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                value={editingLesson.english}
                rows={3}
              />
            </div>

            <button
              onClick={() => {
                // 🎯 Logic: api.put(`/api/admin/lessons/${editingLesson.id}`, editingLesson)
                alert("Lesson Updated! 🚀");
                setEditingLesson(null);
              }}
              className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 transition-all active:scale-95"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}
      {isImporting && (
        <div className="mb-8 p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex justify-between mb-2">
            <span className="text-[10px] font-black uppercase text-indigo-600">
              Importing Curriculum...
            </span>
            <span className="text-[10px] font-black text-slate-400">
              {progress}%
            </span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-300 shadow-[0_0_15px_rgba(79,70,229,0.4)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
