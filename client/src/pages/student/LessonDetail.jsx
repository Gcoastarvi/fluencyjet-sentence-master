// client/src/pages/LessonDetail.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/api/apiClient";

export default function LessonDetail() {
  const params = useParams();
  const rawLessonId = params.lessonId ?? params.id; // fallback safety
  const lessonId = Number(rawLessonId);

  const [loading, setLoading] = useState(true);
  const [lesson, setLesson] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");

        if (!Number.isFinite(lessonId)) {
          throw new Error("Invalid lesson id");
        }

        const res = await api.get(`/lessons/${lessonId}`);
        const data = res?.data ?? res;

        if (!data?.ok) throw new Error(data?.error || "Failed to load lesson");

        setLesson(data.lesson || null);
      } catch (e) {
        setLesson(null);
        setError(e?.message || "Failed to load lesson");
      } finally {
        setLoading(false);
      }
    })();
  }, [lessonId]);  

  // Loading state
  if (loading) {
    return (
      <div className="text-center mt-16 text-xl text-indigo-500">
        Loading lesson…
      </div>
    );
  }

  // Lesson missing
  if (!lesson) {
    return (
      <div className="text-center mt-16 text-xl text-red-500">
        Lesson not found
      </div>
    );
  }

  // Locked state
  if (locked) {
    return (
      <div className="max-w-xl mx-auto p-6 mt-10 text-center bg-red-50 border border-red-200 rounded-xl">
        <h2 className="text-2xl font-bold text-red-600 mb-3">
          🔒 This lesson is locked
        </h2>
        <p className="text-gray-700 mb-4">
          Please complete the previous lesson to unlock this one.
        </p>
        <Link
          to="/lessons"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:scale-105 transition"
        >
          Go back to Lessons
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-indigo-700">{lesson.title}</h1>

        {progress?.completed && (
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
            ✓ Completed
          </span>
        )}
      </div>

      {/* Lesson Content */}
      <div className="prose max-w-none text-gray-800 bg-white p-5 shadow rounded-xl">
        <div dangerouslySetInnerHTML={{ __html: lesson.content }} />
      </div>

      {/* Start Lesson Quiz → NOW GOES TO /practice */}
      <div className="flex justify-center">
        <button
          onClick={() => navigate(`/practice?lessonId=${lessonId}`)}
          className="px-5 py-3 bg-indigo-600 text-white rounded-xl shadow hover:scale-105 transition text-lg font-semibold"
        >
          Start Lesson Quiz →
        </button>
      </div>

      {/* Next Lesson */}
      {progress?.completed && nextLessonId && (
        <div className="flex justify-center">
          <Link
            to={`/lessons/${nextLessonId}`}
            className="px-5 py-3 bg-green-600 text-white rounded-xl shadow hover:scale-105 transition"
          >
            Continue to Next Lesson →
          </Link>
        </div>
      )}
    </div>
  );
}
