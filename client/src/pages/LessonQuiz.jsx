// client/src/pages/LessonQuiz.jsx
import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getAuthToken } from "@/lib/auth";
import { awardXP } from "@/lib/xpTracker";

export default function LessonQuiz() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadLesson() {
    const res = await fetch(`/api/lessons/${id}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    });

    const data = await res.json();
    if (!data.ok) return;

    setLesson(data.lesson);
    setLoading(false);
  }

  useEffect(() => {
    loadLesson();
  }, []);

  async function finishLesson() {
    try {
      await awardXP({ xpEarned: 200, type: "lesson" });

      // unlock next lesson
      await fetch("/api/progress/unlock-next", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lessonId: Number(id) }),
      });

      navigate("/lessons");
    } catch (err) {
      console.error("Failed to complete lesson:", err);
    }
  }

  if (loading)
    return (
      <div className="text-center text-indigo-600 text-xl mt-20">Loading…</div>
    );

  return (
    <div className="max-w-xl mx-auto p-6 mt-6 space-y-6 text-center">
      <h1 className="text-2xl font-bold text-indigo-700">{lesson.title}</h1>

      <p className="text-gray-700">
        Complete this short exercise to earn XP and unlock the next lesson.
      </p>

      <button
        onClick={finishLesson}
        className="w-full bg-green-600 text-white py-3 rounded-full font-semibold hover:scale-105 transition"
      >
        Complete Lesson +200 XP 🎉
      </button>

      <Link
        to="/lessons"
        className="block text-center text-gray-600 mt-2 hover:underline"
      >
        Back
      </Link>
    </div>
  );
}
