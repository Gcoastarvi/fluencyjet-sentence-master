// client/src/pages/student/LessonDetail.jsx
import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api } from "@/api/apiClient";

export default function LessonDetail() {
  const { lessonId } = useParams(); // route is /lessons/:lessonId
  const id = Number(lessonId);
  const navigate = useNavigate();

  const [lesson, setLesson] = useState(null);
  const [userProgress, setUserProgress] = useState(null);

  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      setLesson(null);
      setUserProgress(null);
      setLocked(false);

      // ✅ invalid id handling must be INSIDE effect (not an early return above hooks)
      if (!Number.isFinite(id)) {
        setLoading(false);
        setError("Invalid lesson id");
        return;
      }

      try {
        const res = await api.get(`/lessons/${id}`);
        const data = res?.data ?? res;

        if (!data?.ok) throw new Error(data?.error || "Failed to load lesson");

        if (cancelled) return;

        setLesson(data.lesson || null);
        setUserProgress(data.userProgress || null);

        // backend sends isLocked; we also keep is_locked alias in some places
        const isLocked = Boolean(
          data?.lesson?.isLocked ?? data?.lesson?.is_locked,
        );
        setLocked(isLocked);
      } catch (e) {
        if (cancelled) return;
        setError(e?.message || "Failed to load lesson");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // ---------- RENDER ----------
  if (!Number.isFinite(id)) {
    return (
      <div className="max-w-xl mx-auto p-6 mt-10 text-center">
        <div className="text-xl text-red-600 font-semibold">
          Lesson not found
        </div>
        <div className="mt-4">
          <Link
            to="/lessons"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
          >
            Go back to Lessons
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center mt-16 text-xl text-indigo-500">
        Loading lesson…
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto p-6 mt-10 text-center">
        <div className="text-xl text-red-600 font-semibold">{error}</div>
        <div className="mt-4">
          <Link
            to="/lessons"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
          >
            Go back to Lessons
          </Link>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="text-center mt-16 text-xl text-red-500">
        Lesson not found
      </div>
    );
  }

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
      </div>

      {/* Content (backend does NOT provide lesson.content right now) */}
      <div className="bg-white p-5 shadow rounded-xl">
        <p className="text-gray-700">{lesson.description}</p>

        {userProgress && (
          <div className="mt-4 text-sm text-gray-600">
            <div>XP: {userProgress.xp ?? 0}</div>
            <div>Streak: {userProgress.streak ?? 0}</div>
          </div>
        )}
      </div>

      {/* Start Practice */}
      <div className="flex gap-3 justify-center flex-wrap">
        <button
          onClick={() => navigate(`/practice/typing?lessonId=${id}`)}
          className="px-5 py-3 bg-indigo-600 text-white rounded-xl shadow hover:scale-105 transition text-lg font-semibold"
        >
          Start Typing →
        </button>

        <button
          onClick={() => navigate(`/practice/reorder?lessonId=${id}`)}
          className="px-5 py-3 bg-indigo-100 text-indigo-700 rounded-xl shadow hover:scale-105 transition text-lg font-semibold"
        >
          Start Reorder →
        </button>
      </div>
    </div>
  );
}
