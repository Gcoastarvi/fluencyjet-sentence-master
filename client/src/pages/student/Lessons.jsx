// client/src/pages/student/Lessons.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/api/apiClient";

// --- local progress helpers (from SentencePractice) ---
const progressKey = (lid, mode) => `fj_progress:${lid}:${mode}`;

function readProgress(lid, mode) {
  try {
    return JSON.parse(localStorage.getItem(progressKey(lid, mode)) || "null");
  } catch {
    return null;
  }
}

function pct(p) {
  const c = Number(p?.completed || 0);
  const t = Number(p?.total || 0);
  if (!t) return 0;
  return Math.max(0, Math.min(100, Math.round((c / t) * 100)));
}

export default function Lessons() {
  const navigate = useNavigate();

  const [lessons, setLessons] = useState([]);
  const [unlocked, setUnlocked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Mode picker modal
  const [showModePicker, setShowModePicker] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState(null);

  const getDayNumber = (lesson, index) =>
    Number(
      lesson?.dayNumber ??
        lesson?.day_number ??
        lesson?.orderIndex ??
        lesson?.order_index ??
        index + 1,
    );

  function openModePicker(lesson) {
    setSelectedLesson(lesson);
    setShowModePicker(true);
  }

  function closeModePicker() {
    setShowModePicker(false);
    setSelectedLesson(null);
  }

  const selectedDayNumber = useMemo(() => {
    if (!selectedLesson) return null;
    const idx = lessons.findIndex((l) => l?.id === selectedLesson?.id);
    return getDayNumber(selectedLesson, idx >= 0 ? idx : 0);
  }, [selectedLesson, lessons]);

  useEffect(() => {
    let alive = true;

    async function fetchLessons() {
      try {
        setLoading(true);
        setError("");

        const res = await api.get("/lessons");
        const data = res?.data ?? res;

        if (!data?.ok) throw new Error(data?.error || "Failed to load lessons");

        if (!alive) return;
        setLessons(Array.isArray(data.lessons) ? data.lessons : []);
        setUnlocked(Array.isArray(data.unlocked) ? data.unlocked : []);
      } catch (err) {
        console.error("❌ Lessons fetch failed:", err);
        if (!alive) return;
        setError(err?.message || "Failed to load lessons");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    fetchLessons();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="text-center text-xl text-indigo-600 mt-20">
        Loading lessons…
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-xl text-red-600 mt-20">{error}</div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6 mt-6">
      <h1 className="text-3xl font-bold text-indigo-700 text-center">
        Lessons
      </h1>

      <div className="space-y-4">
        {lessons.map((lesson, index) => {
          const isUnlocked = unlocked.includes(lesson.id);
          const isCompleted = Boolean(lesson.completed);
          const dayNumber = getDayNumber(lesson, index);

      // ---- local progress for this lesson (uses lesson number as key) ----
      const typingProg = readProgress(dayNumber, "typing");
      const reorderProg = readProgress(dayNumber, "reorder");
      const audioProg = readProgress(dayNumber, "audio");

      const bestPct = Math.max(pct(typingProg), pct(reorderProg), pct(audioProg));

      const hasStarted =
        (Number(typingProg?.completed || 0) > 0 && Number(typingProg?.total || 0) > 0) ||
        (Number(reorderProg?.completed || 0) > 0 && Number(reorderProg?.total || 0) > 0) ||
        (Number(audioProg?.completed || 0) > 0 && Number(audioProg?.total || 0) > 0);

      const primaryLabel = !isUnlocked ? "Locked" : hasStarted ? "Continue" : "Start";

      const goPrimary = () => {
        if (!isUnlocked) {
          navigate(`/paywall?plan=BEGINNER&from=lesson_${dayNumber}`);
          return;
        }
        navigate(`/lesson/${dayNumber}`);
      };

          return (
            <div
              key={lesson.id ?? `${lesson.slug ?? "lesson"}_${index}`}
              className="relative p-5 bg-white rounded-xl shadow hover:shadow-lg transition"
            >
              {/* Lock badge */}
              {!isUnlocked && (
                <div className="absolute right-3 top-3 rounded-full bg-gray-900/90 px-3 py-1 text-xs font-semibold text-white">
                  🔒 Locked
                </div>
              )}

              {/* Progress badge */}
              {isUnlocked && (
                <div className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gray-800 border">
                  {bestPct}% done
                </div>
              )}

              {!isUnlocked && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-sm rounded-xl flex items-center justify-center text-3xl text-gray-600">
                  🔒
                </div>
              )}

              <div className={isUnlocked ? "" : "opacity-40"}>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  Lesson {dayNumber}: {lesson.title}
                  {isCompleted && (
                    <span className="text-green-600 text-lg font-bold">✓</span>
                  )}
                </h2>

                <p className="text-gray-500 mt-1">{lesson.description}</p>
                
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* Progress chips */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "Typing", p: typingProg },
                      { label: "Reorder", p: reorderProg },
                      { label: "Audio", p: audioProg },
                    ].map(({ label, p }) => (
                      <span
                        key={label}
                        className="rounded-full border bg-white px-3 py-1 text-xs text-gray-700"
                        title={`${label}: ${Number(p?.completed || 0)}/${Number(p?.total || 0)}`}
                      >
                        <span className="font-semibold">{label}</span>
                        <span className="text-gray-500"> • </span>
                        <span>{pct(p)}%</span>
                      </span>
                    ))}
                  </div>

                  {/* Primary CTA */}
                  <button
                    type="button"
                    onClick={goPrimary}
                    className={`px-4 py-2 rounded-full transition inline-block ${
                      isUnlocked
                        ? "bg-indigo-600 text-white hover:scale-105"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    {primaryLabel} →
                  </button>
                </div>

              </div>
            </div>
          );
        })}
      </div>
      
      {/* Mode Picker Modal (disabled for MVP) */}
      {showModePicker && selectedLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Choose Practice Mode</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedLesson.title}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModePicker}
                className="text-gray-500 hover:text-gray-800"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={() => {
                  closeModePicker();
                  navigate(`/lesson/${selectedDayNumber}`);
                }}
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-white font-semibold hover:opacity-95"
              >
                Typing Practice →
              </button>

              <button
                type="button"
                onClick={() => {
                  closeModePicker();
                  navigate(`/lesson/${selectedDayNumber}`);
                }}
                className="w-full rounded-xl bg-indigo-100 px-4 py-3 text-indigo-800 font-semibold hover:bg-indigo-200"
              >
                Reorder Practice →
              </button>
            </div>

            <p className="mt-4 text-xs text-gray-400">
              Cloze + Audio will appear here next.
            </p>
          </div>
        </div>
      )}    
    </div>
  );
}
