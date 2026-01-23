// client/src/pages/Practice.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import QuizCard from "../../components/quiz/QuizCard";
import ProgressBar from "../../components/quiz/ProgressBar";
import ResultScreen from "../../components/quiz/ResultScreen";
import ConfettiBlast from "../../components/quiz/ConfettiBlast";
import { api } from "@/api/apiClient";

const XP_PER_CORRECT = 150;

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function normalizeAnswer(s = "") {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[.!?,;:]/g, "");
}

function Practice() {
  const navigate = useNavigate();
  const query = useQuery();
  const lessonId = query.get("lessonId");

  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState(null); // "correct" | "wrong" | null
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);

  // NEW: XP flash per correct
  const [showXpFlash, setShowXpFlash] = useState(false);
  const [lastGain, setLastGain] = useState(0);

  // NEW: Confetti on finish
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (!lessonId) {
      setError("Missing lessonId. Please start from a lesson.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadQuestions() {
      try {
        setLoading(true);
        setError("");

        const token = localStorage.getItem("token");
        if (!token) {
          setError("Not authenticated. Please log in again.");
          setLoading(false);
          return;
        }

        const res = await fetch(
          `/api/quizzes/random?lessonId=${lessonId}&limit=10&difficulty=beginner`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          },
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));

          // ✅ PAYWALL → redirect to LessonDetail (upgrade screen)
          if (
            res.status === 403 &&
            (errData.code === "PAYWALL" ||
              /upgrade|locked/i.test(errData.message || ""))
          ) {
            window.location.href = `/lesson/${lessonId}`;
            return;
          }

          // ✅ Auth expired / invalid token
          if (res.status === 401) {
            setError("Session expired. Please log in again.");
            setLoading(false);
            return;
          }

          throw new Error(errData.message || "Failed to load quiz");
        }

        const data = await res.json();
        if (!data.questions || !data.questions.length) {
          throw new Error("No quiz questions found for this lesson yet.");
        }

        setQuestions(data.questions);
        setCurrentIndex(0);
        setUserAnswer("");
        setCorrectCount(0);
        setFeedback(null);
        setFinished(false);
        setXpAwarded(0);
        setShowConfetti(false);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Practice load error:", err);
          setError(err.message || "Something went wrong");
        }
      } finally {
        setLoading(false);
      }
    }

    loadQuestions();

    return () => controller.abort();
  }, [lessonId]);

  const currentQuestion = questions[currentIndex] || null;

  const handleSubmit = () => {
    if (!currentQuestion || !userAnswer.trim() || submitting) return;

    setSubmitting(true);

    const userNorm = normalizeAnswer(userAnswer);
    const correctNorm = normalizeAnswer(currentQuestion.en);
    const isCorrect = userNorm === correctNorm;

    // Calculate new correct count immmediately to keep XP + summary accurate
    const newCorrectCount = isCorrect ? correctCount + 1 : correctCount;
    if (isCorrect) {
      setCorrectCount(newCorrectCount);
      setLastGain(XP_PER_CORRECT);
      setShowXpFlash(true);
      setTimeout(() => setShowXpFlash(false), 700);
    }

    setFeedback(isCorrect ? "correct" : "wrong");

    setTimeout(() => {
      setFeedback(null);
      setUserAnswer("");

      const nextIndex = currentIndex + 1;

      if (nextIndex >= questions.length) {
        handleFinishQuiz(newCorrectCount);
      } else {
        setCurrentIndex(nextIndex);
      }

      setSubmitting(false);
    }, 800);
  };

  const handleFinishQuiz = async (finalCorrectCount) => {
    setFinished(true);
    setShowConfetti(true);

    const totalQuestions = questions.length || 1;
    const earnedXP = finalCorrectCount * XP_PER_CORRECT;
    setXpAwarded(earnedXP);

    // Remove confetti after a short burst
    setTimeout(() => setShowConfetti(false), 2500);

    // Award XP to backend
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      if (earnedXP > 0) {
        await api.post("/xp/award", {
          amount: earnedXP,
          event: "QUIZ_COMPLETED",
          meta: {
            lessonId: Number(lessonId),
            totalQuestions,
            correctCount: finalCorrectCount,
            mode: "typing",
          },
        });
      }
    } catch (err) {
      console.error("Failed to award XP:", err);
    }
  };

  const handleRetry = () => {
    setFinished(false);
    setCurrentIndex(0);
    setUserAnswer("");
    setCorrectCount(0);
    setFeedback(null);
    setXpAwarded(0);
    setShowConfetti(false);
  };

  const handleBackToLesson = () => {
    navigate(`/lessons/${lessonId}`);
  };

  if (!lessonId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 px-4">
        <p className="text-red-400 mb-3">
          Missing lessonId. Please open a lesson and click &quot;Start Lesson
          Quiz&quot;.
        </p>
        <button
          onClick={() => navigate("/lessons")}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium"
        >
          Go to Lessons
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-slate-300">Loading quiz…</p>
      </div>
    );
  }

  if (error || !currentQuestion) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 px-4">
        <p className="text-red-400 mb-3">
          {error || "No questions found for this lesson"}
        </p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium"
        >
          ← Back
        </button>
      </div>
    );
  }

  if (finished) {
    return (
      <>
        {showConfetti && <ConfettiBlast />}
        <ResultScreen
          total={questions.length}
          correct={correctCount}
          xp={xpAwarded}
          onRetry={handleRetry}
          onBackToLesson={handleBackToLesson}
          onGoDashboard={() => navigate("/dashboard")}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      {showConfetti && <ConfettiBlast />}

      {/* XP flash pill */}
      {showXpFlash && lastGain > 0 && (
        <div className="fixed top-4 right-4 z-30">
          <div className="bg-emerald-500 text-white text-sm font-semibold px-3 py-1 rounded-full shadow-lg animate-bounce">
            +{lastGain} XP
          </div>
        </div>
      )}

      <div className="max-w-xl mx-auto space-y-5">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={handleBackToLesson}
            className="text-sm text-slate-300 hover:text-white flex items-center gap-1"
          >
            <span className="text-lg">←</span>
            <span>Back to Lesson</span>
          </button>
          <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-300">
            Typing Practice
          </span>
        </div>

        <ProgressBar current={currentIndex + 1} total={questions.length} />

        <QuizCard
          question={currentQuestion}
          userAnswer={userAnswer}
          onChangeAnswer={setUserAnswer}
          onSubmit={handleSubmit}
          feedback={feedback}
          disabled={submitting}
        />
      </div>
    </div>
  );
}

export default Practice;
