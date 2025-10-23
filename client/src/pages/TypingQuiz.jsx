// client/src/pages/TypingQuiz.jsx
import { useEffect, useState } from "react";
import { awardXP } from "@/lib/xpTracker";
import { Link } from "react-router-dom";

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

export default function TypingQuiz() {
  const [current, setCurrent] = useState(0);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [feedback, setFeedback] = useState("");

  const q = QUESTIONS[current];

  function normalize(str) {
    return str.trim().toLowerCase().replace(/\s+/g, " ");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!answer) return;

    if (normalize(answer) === normalize(q.english)) {
      setFeedback("✅ Correct!");
      setScore((s) => s + 1);
      await awardXP({ type: "typing" }); // +150 XP for correct
    } else {
      setFeedback(`❌ Correct answer: "${q.english}"`);
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

  async function handleQuizComplete() {
    setFinished(true);
    await awardXP({ type: "typing", completedQuiz: true }); // +300 bonus XP
  }

  function restartQuiz() {
    setCurrent(0);
    setScore(0);
    setAnswer("");
    setFeedback("");
    setFinished(false);
  }

  return (
    <div className="max-w-xl mx-auto text-center mt-10 p-4 space-y-6">
      <h2 className="text-2xl font-bold text-indigo-700">
        Typing Translation Quiz
      </h2>

      {!finished ? (
        <>
          <div className="text-gray-700 text-lg">
            <p className="mb-3">Translate this sentence to English:</p>
            <div className="bg-indigo-50 p-3 rounded-xl text-xl font-semibold">
              {q.tamil}
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
            />
            <button className="bg-indigo-600 text-white py-2 px-4 rounded-full hover:scale-105 transition">
              Submit
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
            Question {current + 1} of {QUESTIONS.length}
          </p>
        </>
      ) : (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-green-600">
            Quiz Completed 🎉
          </h3>
          <p>
            You scored <b>{score}</b> / {QUESTIONS.length}
          </p>
          <p className="text-sm text-gray-600">
            XP automatically updated to your dashboard!
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
        </div>
      )}
    </div>
  );
}
