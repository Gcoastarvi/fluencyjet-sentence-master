// client/src/pages/student/Lessons.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/api/apiClient";

export default function Lessons() {
  const navigate = useNavigate();

  const [showModePicker, setShowModePicker] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState(null);

  function openModePicker(lesson) {
    setSelectedLesson(lesson);
    setShowModePicker(true);
  }

  function closeModePicker() {
    setShowModePicker(false);
    setSelectedLesson(null);
  }

  const [loading, setLoading] = useState(true);
  const [lessons, setLessons] = useState([]);
  const [unlocked, setUnlocked] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    const fetchLessons = async () => {
      setLoading(true);
      setError("");

      try {
        const res = await api.get("/lessons");
        const data = res?.data ?? res;

        if (!data?.ok) throw new Error(data?.error || "Failed to load lessons");

        if (!alive) return;
        setLessons(data.lessons || []);
        setUnlocked(data.unlocked || []);
      } catch (err) {
        console.error("❌ Lessons fetch failed:", err);
        if (!alive) return;
        setError(err?.message || "Failed to load lessons");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    fetchLessons();

    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <div className="p-4">Loading…</div>;

  if (loading)
    return (
      <div className="text-center text-xl text-indigo-600 mt-20">
        Loading lessons…
      </div>
    );

  if (error)
    return (
      <div className="text-center text-xl text-red-600 mt-20">{error}</div>
    );

  if (!lesson.dayNumber) {
    console.error("Lesson missing dayNumber", lesson);
    return null;
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

          return (
            <div
              key={lesson.id}
              className={`relative p-5 bg-white rounded-xl shadow hover:shadow-lg transition group`}
            >
              {/* Lock Overlay */}
              {!isUnlocked && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-sm rounded-xl flex items-center justify-center text-3xl text-gray-600">
                  🔒
                </div>
              )}

              <div className={isUnlocked ? "" : "opacity-40"}>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  Lesson {index + 1}: {lesson.title}
                  {isCompleted && (
                    <span className="text-green-600 text-lg font-bold">✓</span>
                  )}
                </h2>

                <p className="text-gray-500 mt-1">{lesson.description}</p>

                <div className="mt-4">
                  {isUnlocked ? (
                    <Link
                      to={`/lessons/${lesson.lessonSlug || lesson.slug}`}
                      state={{ lesson }}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-full hover:scale-105 transition inline-block"
                    >
                      Start →
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="px-4 py-2 bg-gray-300 text-gray-600 rounded-full cursor-not-allowed inline-block"
                      disabled
                    >
                      Locked
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* Mode Picker Modal */}
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
                  navigate(`/practice/typing?lessonId=${selectedLesson.id}`);
                }}
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-white font-semibold hover:opacity-95"
              >
                Typing Practice →
              </button>

              <button
                type="button"
                onClick={() => {
                  closeModePicker();
                  navigate(`/practice/reorder?lessonId=${selectedLesson.id}`);
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
