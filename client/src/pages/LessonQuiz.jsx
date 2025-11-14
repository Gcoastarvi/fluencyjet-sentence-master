// client/src/pages/LessonQuiz.jsx
import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useApi, useXP } from "@/hooks/useApi";

/**
 * LessonQuiz
 * - Loads a single lesson from /api/lessons/:id
 * - Shows one question at a time (Tamil -> English)
 * - Awards XP per correct answer and a bonus on completion
 */

const QUESTION_XP = 120; // XP per correct answer
const COMPLETION_XP = 300; // Bonus XP for finishing the quiz

function normalize(str = "") {
  return str.trim().toLowerCase().replace(/\s+/g, " ");
}

export default function LessonQuiz() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApi();
  const { awardXP } = useXP(); // ✅ centralized XP engine

  const [lesson, setLesson] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load lesson on mount / id change
  useEffect(() => {
    async function loadLesson() {
      try {
        setError("");
        setLoading(true);
        const data = await api.get(`/lessons/${id}`);
        // Expecting { ok: true, lesson: { id, title, questions:[{ id, ta, en }, ...] } }
        setLesson(data.lesson);
      } catch (err) {
        console.error("Failed to load lesson:", err);
        setError(err?.message || "Failed to load lesson.");
      } finally {
        setLoading(false);
      }
    }

    loadLesson();
  }, [id, api]);

  if (loading && !lesson) {
    return (
      <div className="max-w-xl mx-auto mt-10 text-center">
        <p className="text-gray-600">Loading lesson...</p>
      </div>
    );
  }

  if (error && !lesson) {
    return (
      <div className="max-w-xl mx-auto mt-10 text-center space-y-4">
        <p className="text-red-500 font-semibold">{error}</p>
        <button
          onClick={() => navigate("/lessons")}
          className="text-indigo-600 underline"
        >
          Back to Lessons
        </button>
      </div>
    );
  }

  if (!lesson) return null;

  const questions = lesson.questions || [];
  const q = questions[currentIndex];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!q || !answer || loading) return;

    const isCorrect = normalize(answer) === normalize(q.en);

    if (isCorrect) {
      setScore((s) => s + 1);
      setFeedback("✅ Correct!");

      try {
        setLoading(true);
        await awardXP(QUESTION_XP, "QUESTION_CORRECT", {
          lessonId: lesson.id,
          questionId: q.id,
          mode: "typing",
        });
      } catch (err) {
        console.error("XP update failed for question:", err);
      } finally {
        setLoading(false);
      }
    } else {
      setFeedback(`❌ Correct answer: "${q.en}"`);
    }

    setTimeout(() => {
      if (currentIndex + 1 < questions.length) {
        setCurrentIndex((i) => i + 1);
        setAnswer("");
        setFeedback("");
      } else {
        handleQuizComplete();
      }
    }, 1000);
  }

  async function handleQuizComplete() {
    setFinished(true);
    try {
      setLoading(true);
      await awardXP(COMPLETION_XP, "LESSON_COMPLETED", {
        lessonId: lesson.id,
      });
    } catch (err) {
      console.error("XP update failed on completion:", err);
    } finally {
      setLoading(false);
    }
  }

  function restart() {
    setCurrentIndex(0);
    setScore(0);
    setAnswer("");
    setFeedback("");
    setFinished(false);
  }

  return (
    <div className="max-w-xl mx-auto mt-10 p-4 space-y-6 text-center">
      <h2 className="text-2xl font-bold text-indigo-700 mb-2">
        {lesson.title} – Quiz
      </h2>

      {!finished ? (
        <>
          <div className="text-gray-700 text-lg">
            <p className="mb-3">Translate this sentence to English:</p>
            <div className="bg-indigo-50 p-3 rounded-xl text-xl font-semibold">
              {q?.ta}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              className="w-full border rounded p-2 text-center"
              placeholder="Type your English translation here"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              autoFocus
              disabled={loading}
            />
            <button
              className="bg-indigo-600 text-white py-2 px-4 rounded-full hover:scale-105 transition disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Updating XP..." : "Submit"}
            </button>
          </form>

          {feedback && (
            <p
              className={`text-lg font-semibold ${
                feedback.startsWith("✅") ? "text-green-600" : "text-red-500"
              }`}
            >
              {feedback}
            </p>
          )}

          <p className="text-gray-500 text-sm">
            Question {currentIndex + 1} of {questions.length}
          </p>

          <button
            onClick={() => navigate("/lessons")}
            className="text-indigo-600 underline text-sm"
          >
            ← Back to Lessons
          </button>
        </>
      ) : (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-green-600">
            Quiz Completed 🎉
          </h3>
          <p>
            You scored <b>{score}</b> / {questions.length}
          </p>
          <p className="text-sm text-gray-600">
            XP has been updated on your dashboard.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={restart}
              className="bg-violet-600 text-white px-4 py-2 rounded-full hover:scale-105 transition"
            >
              Try Again
            </button>
            <Link
              to="/dashboard"
              className="bg-indigo-600 text-white px-4 py-2 rounded-full hover:scale-105 transition"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
