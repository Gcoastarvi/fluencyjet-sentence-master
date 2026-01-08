// client/src/pages/LessonQuiz.jsx
import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useApi, useXP } from "@/hooks/useApi.js";
import confetti from "canvas-confetti";

/* ----------------------------- CONSTANTS ----------------------------- */

const QUESTION_XP = 120;
const COMPLETION_XP = 300;

// XP milestones for celebrations
const MILESTONES = [500, 1000, 2500, 5000];

/* ----------------------------- HELPERS ----------------------------- */

function normalize(str = "") {
  return str.trim().toLowerCase().replace(/\s+/g, " ");
}

// Simple level mapping – lightweight for MVP
function getLevelFromXp(xp) {
  if (xp >= 5000) return 5;
  if (xp >= 2500) return 4;
  if (xp >= 1000) return 3;
  if (xp >= 500) return 2;
  return 1;
}

// XP counter animation helper
function animateValue(start, end, duration, cb) {
  let startTime = null;

  function tick(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const eased = start + (end - start) * progress;
    cb(Math.floor(eased));
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

// Floating XP bubble
function spawnXPBubble(amount = 120) {
  const bubble = document.createElement("div");
  bubble.innerText = `+${amount} XP`;
  bubble.className =
    "fixed text-yellow-500 text-xl font-bold animate-xp-float select-none pointer-events-none";
  bubble.style.left = "50%";
  bubble.style.top = "55%";
  bubble.style.transform = "translate(-50%, -50%)";
  bubble.style.zIndex = "9999";
  document.body.appendChild(bubble);

  setTimeout(() => bubble.remove(), 900);
}

/* ----------------------------- SOUND ENGINE ----------------------------- */

// Put files in: public/sounds/
//   /sounds/correct.mp3
//   /sounds/wrong.mp3
//   /sounds/xp.mp3
//   /sounds/levelup.mp3
const soundFiles = {
  correct: "/sounds/correct.mp3",
  wrong: "/sounds/wrong.mp3",
  xp: "/sounds/xp.mp3",
  levelup: "/sounds/levelup.mp3",
};

const soundPool = {};

function playSound(key) {
  const src = soundFiles[key];
  if (!src) return;
  if (!soundPool[key]) {
    const audio = new Audio(src);
    audio.volume = key === "wrong" ? 0.4 : 0.7;
    soundPool[key] = audio;
  }
  const a = soundPool[key];
  try {
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch {
    // ignore autoplay errors
  }
}

/* ===================================================================== */
/*                         MAIN COMPONENT                                */
/* ===================================================================== */

export default function LessonQuiz() {
  const { lessonId } = useParams();

  // ✅ safe parse
  const id = Number(lessonId);
  const isValidId = Number.isFinite(id) && id > 0;

  const navigate = useNavigate();
  const api = useApi();
  const { awardXP } = useXP();

  const [lesson, setLesson] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(""); // "correct" | "wrong" | ""
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(false);

  // XP + levels
  const [xpTotal, setXpTotal] = useState(0);
  const [level, setLevel] = useState(1);
  const [xpAnimation, setXpAnimation] = useState(0);
  const [recentMilestone, setRecentMilestone] = useState(null);
  const [achievedMilestones, setAchievedMilestones] = useState([]);

  // Level-up modal
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpFrom, setLevelUpFrom] = useState(null);
  const [levelUpTo, setLevelUpTo] = useState(null);

  /* ---------------------- INITIAL LOAD ---------------------- */

  useEffect(() => {
    if (!isValidId) return;

    async function loadLessonAndXp() {
      try {
        const [lessonData, xpData] = await Promise.all([
          api.get(`/lessons/${id}`),
          api.get("/xp/balance").catch(() => null),
        ]);

        setLesson(lessonData.lesson);

        const baseXp = xpData?.balance?.lifetime_xp ?? 0;
        setXpTotal(baseXp);
        setLevel(getLevelFromXp(baseXp));

        // mark already-achieved milestones
        const already = MILESTONES.filter((m) => baseXp >= m);
        setAchievedMilestones(already);
      } catch (err) {
        console.error("Failed to load lesson/xp:", err);
      }
    }
    loadLessonAndXp();
  }, [id, api]);

  if (!isValidId) {
    return (
      <div className="max-w-xl mx-auto mt-10 text-center">
        <p className="text-red-600 font-semibold">Lesson not found</p>
        <Link to="/lessons" className="text-purple-600 underline">
          Back to Lessons
        </Link>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="max-w-xl mx-auto mt-10 text-center">
        <p className="text-gray-600">Loading lesson…</p>
      </div>
    );
  }

  const questions = lesson.questions || [];
  const q = questions[currentIndex];

  /* ------------------- XP GAIN HANDLER ------------------- */

  function handleXpGain(amount) {
    if (!amount) return;

    const prevXp = xpTotal;
    const newXp = prevXp + amount;

    const oldLevel = getLevelFromXp(prevXp);
    const newLevel = getLevelFromXp(newXp);

    // Level-up detection
    if (newLevel > oldLevel) {
      setLevelUpFrom(oldLevel);
      setLevelUpTo(newLevel);
      setShowLevelUp(true);
      setLevel(newLevel);
      playSound("levelup");

      // extra celebratory confetti
      confetti({
        particleCount: 160,
        spread: 80,
        origin: { y: 0.6 },
        scalar: 1.1,
      });
    }

    // Milestone detection (crossing threshold between prevXp and newXp)
    let triggeredMilestone = null;
    setAchievedMilestones((prev) => {
      const updated = [...prev];
      for (const m of MILESTONES) {
        if (prev.includes(m)) continue;
        if (prevXp < m && newXp >= m) {
          updated.push(m);
          triggeredMilestone = m;
        }
      }
      return updated;
    });

    if (triggeredMilestone) {
      setRecentMilestone(triggeredMilestone);
      playSound("xp");
      // mini confetti for milestone
      confetti({
        particleCount: 90,
        spread: 60,
        origin: { y: 0.5 },
        scalar: 0.9,
      });
      // clear message after a few seconds
      setTimeout(() => setRecentMilestone(null), 4000);
    }

    setXpTotal(newXp);
  }

  /* ------------------- SUBMIT ANSWER ------------------- */

  async function handleSubmit(e) {
    e.preventDefault();
    if (!q || !answer || loading) return;

    const isCorrect = normalize(answer) === normalize(q.en);

    if (isCorrect) {
      setScore((s) => s + 1);
      setFeedback("correct");
      spawnXPBubble(QUESTION_XP);
      playSound("correct");

      try {
        await awardXP(QUESTION_XP, "QUESTION_CORRECT", {
          lessonId: lesson.id,
          questionId: q.id,
        });
        handleXpGain(QUESTION_XP);
      } catch (err) {
        console.error("XP update failed for question:", err);
      }
    } else {
      setFeedback("wrong");
      playSound("wrong");
    }

    setTimeout(() => {
      if (currentIndex + 1 < questions.length) {
        setCurrentIndex((i) => i + 1);
        setAnswer("");
        setFeedback("");
      } else {
        handleQuizComplete();
      }
    }, 850);
  }

  /* ------------------- QUIZ COMPLETE ------------------- */

  async function handleQuizComplete() {
    setFinished(true);

    // nicer double-burst confetti
    confetti({
      particleCount: 130,
      spread: 70,
      origin: { x: 0.3, y: 0.6 },
      scalar: 1.0,
    });
    confetti({
      particleCount: 130,
      spread: 70,
      origin: { x: 0.7, y: 0.6 },
      scalar: 1.0,
    });

    animateValue(0, COMPLETION_XP, 1100, setXpAnimation);
    playSound("xp");

    try {
      await awardXP(COMPLETION_XP, "QUIZ_COMPLETED", {
        lessonId: lesson.id,
      });
      handleXpGain(COMPLETION_XP);

      await api.post("/progress/update", {
        lessonId: lesson.id,
      });
    } catch (err) {
      console.error("Completion error:", err);
    }
  }

  function restart() {
    setCurrentIndex(0);
    setScore(0);
    setAnswer("");
    setFeedback("");
    setFinished(false);
    setXpAnimation(0);
  }

  /* ------------------- RENDER ------------------- */

  return (
    <div className="max-w-xl mx-auto mt-10 p-4 text-center space-y-6">
      <h2 className="text-2xl font-bold text-indigo-700">
        {lesson.title} – Quiz
      </h2>

      {/* Level + XP summary (small, top-right flavour) */}
      <div className="flex justify-center gap-4 text-sm text-gray-600">
        <span className="px-3 py-1 rounded-full bg-indigo-50">
          Level <b>{level}</b>
        </span>
        <span className="px-3 py-1 rounded-full bg-yellow-50">
          Total XP <b>{xpTotal}</b>
        </span>
      </div>

      {!finished ? (
        <>
          <p className="text-gray-700">Translate this sentence to English:</p>

          <div className="bg-indigo-50 p-3 rounded-xl text-xl font-semibold">
            {q?.ta}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              className={`w-full border rounded p-2 text-center text-lg transition 
                ${
                  feedback === "wrong"
                    ? "animate-shake border-red-500"
                    : feedback === "correct"
                      ? "border-green-500 scale-[1.03]"
                      : ""
                }`}
              placeholder="Type your English translation"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              autoFocus
              disabled={loading}
            />

            <button
              className="bg-indigo-600 text-white px-4 py-2 rounded-full hover:scale-105 transition disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "Updating…" : "Submit"}
            </button>
          </form>

          {feedback === "correct" && (
            <p className="text-green-600 text-lg font-semibold">Correct! 🎉</p>
          )}
          {feedback === "wrong" && (
            <p className="text-red-500 text-lg font-semibold">
              ❌ Correct answer: “{q?.en}”
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
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-xl font-bold text-green-600">
            Quiz Completed 🎉
          </h3>

          <p>
            You scored <b>{score}</b> / {questions.length}
          </p>

          <p className="text-yellow-600 text-2xl font-bold">
            +{xpAnimation} XP earned
          </p>

          {recentMilestone && (
            <p className="text-sm text-amber-700 bg-amber-50 inline-block px-3 py-1 rounded-full">
              🎯 Milestone reached: {recentMilestone} XP!
            </p>
          )}

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

      {/* LEVEL-UP MODAL */}
      {showLevelUp && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl px-6 py-5 max-w-sm w-full text-center animate-fade-in">
            <h4 className="text-lg font-bold text-indigo-700 mb-2">
              LEVEL UP! 🎉
            </h4>
            <p className="text-sm text-gray-700 mb-3">
              You advanced from <b>Level {levelUpFrom}</b> to{" "}
              <b>Level {levelUpTo}</b>.
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Keep answering correctly to climb faster.
            </p>
            <button
              onClick={() => setShowLevelUp(false)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-full text-sm hover:scale-105 transition"
            >
              Awesome, continue 🚀
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
