// client/src/pages/TypingQuiz.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { awardXP } from "@/lib/xpTracker"; // XP system (your existing file)

// 🧠 Sample Tamil→English sentences
const QUESTIONS = [
  { id: 1, tamil: "நான் பள்ளிக்கு போகிறேன்", english: "I am going to school" },
  {
    id: 2,
    tamil: "அவள் புத்தகம் படிக்கிறாள்",
    english: "She is reading a book",
  },
  { id: 3, tamil: "அவர் ஒரு மருத்துவர்", english: "He is a doctor" },
  {
    id: 4,
    tamil: "அவர்கள் பாடல் பாடுகிறார்கள்",
    english: "They are singing a song",
  },
  {
    id: 5,
    tamil: "நாம் ஒன்றாக விளையாடுகிறோம்",
    english: "We are playing together",
  },
];

// Normalize English answers
function normalize(str) {
  return str.trim().toLowerCase().replace(/\s+/g, " ");
}

export default function TypingQuiz() {
  const [current, setCurrent] = useState(0);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  const [toast, setToast] = useState(null); // 🔥 New: toast feedback

  const q = QUESTIONS[current];

  function showToast(msg, type = "info") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2000);
  }

  // ====== HANDLE SUBMISSION ======
  async function handleSubmit(e) {
    e.preventDefault();
    if (!answer || loading) return;

    const correct = normalize(answer) === normalize(q.english);

    if (correct) {
      setFeedback("✅ Correct!");
      setScore((s) => s + 1);
      showToast("+150 XP", "success");

      try {
        setLoading(true);
        await awardXP({
          xpEarned: 150,
          type: "QUESTION_CORRECT",
          questionId: q.id,
          mode: "typing",
        });
      } catch (err) {
        console.error("XP award failed (question):", err);
      } finally {
        setLoading(false);
      }
    } else {
      setFeedback(`❌ Correct answer: "${q.english}"`);
      showToast("Incorrect", "error");
    }

    setTimeout(() => {
      if (current + 1 < QUESTIONS.length) {
        setCurrent((c) => c + 1);
        setAnswer("");
        setFeedback("");
      } else {
        handleQuizComplete();
      }
    }, 1000);
  }

  // ====== QUIZ COMPLETION ======
  async function handleQuizComplete() {
    setFinished(true);
    showToast("Completed! +300 XP", "success");

    try {
      setLoading(true);
      await awardXP({
        xpEarned: 300,
        type: "QUIZ_COMPLETED",
        totalQuestions: QUESTIONS.length,
        correct: score,
        mode: "typing",
      });
    } catch (err) {
      console.error("XP award failed (quiz complete):", err);
    } finally {
      setLoading(false);
    }
  }

  // ====== RESET QUIZ ======
  function restartQuiz() {
    setCurrent(0);
    setScore(0);
    setAnswer("");
    setFeedback("");
    setFinished(false);
    showToast("Restarted", "info");
  }

  return (
    <div className="max-w-xl mx-auto text-center mt-10 p-4 space-y-6">
      {/* TOAST */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div
            className={`px-4 py-2 rounded-full text-white shadow ${
              toast.type === "success"
                ? "bg-emerald-600"
                : toast.type === "error"
                  ? "bg-red-600"
                  : "bg-gray-700"
            }`}
          >
            {toast.msg}
          </div>
        </div>
      )}

      {/* TITLE */}
      <h2 className="text-2xl font-bold text-indigo-700">
        ✍️ Typing Translation Quiz
      </h2>

      {!finished ? (
        <>
          {/* QUESTION CARD */}
          <div className="text-gray-700 text-lg">
            <p className="mb-3">Translate to English:</p>
            <div className="bg-indigo-50 p-3 rounded-xl text-xl font-semibold">
              {q.tamil}
            </div>
          </div>

          {/* INPUT */}
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

          {/* FEEDBACK */}
          {feedback && (
            <p
              className={`text-lg font-semibold ${
                feedback.startsWith("✅") ? "text-green-600" : "text-red-500"
              }`}
            >
              {feedback}
            </p>
          )}

          {/* PROGRESS */}
          <p className="text-gray-500 text-sm">
            Question {current + 1} of {QUESTIONS.length}
          </p>
        </>
      ) : (
        <>
          <h3 className="text-xl font-semibold text-green-600">
            🎉 Quiz Completed!
          </h3>
          <p>
            You scored <b>{score}</b> / {QUESTIONS.length}
          </p>
          <p className="text-sm text-gray-600">
            XP has been added to your dashboard.
          </p>

          <div className="flex justify-center gap-3">
            <button
              onClick={restartQuiz}
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
        </>
      )}
    </div>
  );
}
