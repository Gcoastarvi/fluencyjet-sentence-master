// client/src/pages/LessonDetail.jsx
import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { apiRequest } from "@/hooks/useApi.js";

export default function LessonDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadLesson() {
    try {
      const data = await apiRequest(`/api/lessons/${id}`);

      if (!data?.ok) throw new Error("Failed to load lesson");

      setLesson(data.lesson);
    } catch (err) {
      setLesson(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLesson();
  }, [id]);

  if (loading)
    return (
      <div className="text-center text-indigo-600 text-xl mt-20">
        Loading lesson…
      </div>
    );

  if (!lesson)
    return (
      <div className="text-center text-red-600 text-xl mt-20">
        Lesson not found.
      </div>
    );

  if (lesson.is_locked)
    return (
      <div className="max-w-xl mx-auto mt-20 text-center">
        <h2 className="text-xl font-bold text-gray-800">🔒 Locked</h2>
        <p className="text-gray-600 mt-3">
          Complete previous lessons to unlock this.
        </p>
        <Link
          to="/lessons"
          className="mt-4 inline-block bg-indigo-600 text-white px-4 py-2 rounded-full"
        >
          Back to Lessons
        </Link>
      </div>
    );

  return (
    <div className="max-w-xl mx-auto p-6 mt-6 space-y-6">
      <h1 className="text-2xl font-bold text-indigo-700">{lesson.title}</h1>
      <p className="text-gray-600">{lesson.description}</p>

      <button
        onClick={() => navigate(`/lessons/${id}/start`)}
        className="w-full bg-indigo-600 text-white py-3 rounded-full font-semibold hover:scale-105 transition"
      >
        Start Lesson →
      </button>

      <Link
        to="/lessons"
        className="block text-center text-gray-600 mt-2 hover:underline"
      >
        Back to Lessons
      </Link>
    </div>
  );
}
