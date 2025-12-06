// client/src/pages/Lessons.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "@/hooks/useApi.js";

export default function Lessons() {
  const [loading, setLoading] = useState(true);
  const [lessons, setLessons] = useState([]);
  const [unlocked, setUnlocked] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);

      const data = await apiRequest("/api/lessons");

      if (!data?.ok) throw new Error(data.message);

      setLessons(data.lessons || []);
      setUnlocked(data.unlocked || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load lessons");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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
                      to={`/lessons/${lesson.id}`}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-full hover:scale-105 transition inline-block"
                    >
                      Start →
                    </Link>
                  ) : (
                    <button className="px-4 py-2 bg-gray-300 text-gray-600 rounded-full cursor-not-allowed inline-block">
                      Locked
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
