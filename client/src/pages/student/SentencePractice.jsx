import { useState, useEffect } from "react";
import { useRef } from "react";

const MAX_ATTEMPTS = 3;

const XP_BY_ATTEMPT = {
  1: 150,
  2: 100,
  3: 50,
};

/**
 * Mock question bank (frontend-only for now)
 * Later this will come from API
 */
const QUESTIONS = [
  {
    tamil: "அவள் annual exams ல pass ஆக hard ஆக study பண்ணிட்டு இருக்கா",
    correctOrder: [
      "She",
      "is",
      "studying",
      "hard",
      "to",
      "pass",
      "her",
      "annual",
      "exams",
    ],
  },
  {
    tamil: "அவன் job கிடைக்க hard ஆக prepare பண்ணிட்டு இருக்கான்",
    correctOrder: ["He", "is", "preparing", "hard", "to", "get", "a", "job"],
  },
  {
    tamil: "நான் English improve பண்ண daily practice பண்ணுறேன்",
    correctOrder: ["I", "practice", "daily", "to", "improve", "my", "English"],
  },
  {
    tamil: "அவர்கள் exam clear பண்ண confidence build பண்ணுறாங்க",
    correctOrder: [
      "They",
      "are",
      "building",
      "confidence",
      "to",
      "clear",
      "the",
      "exam",
    ],
  },
  {
    tamil: "நீ fluency improve பண்ண slow ஆக start பண்ணலாம்",
    correctOrder: ["You", "can", "start", "slowly", "to", "improve", "fluency"],
  },
];

export default function SentencePractice() {
  // 🔊 Sound effects (safe refs)
  const correctSoundRef = useRef(null);
  const wrongSoundRef = useRef(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentQuestion = QUESTIONS[currentIndex];

  const [tiles, setTiles] = useState([]);
  const [answer, setAnswer] = useState([]);
  const [attempts, setAttempts] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | wrong | correct | reveal
  const [showHint, setShowHint] = useState(false);
  const [wrongIndexes, setWrongIndexes] = useState([]);
  const [earnedXP, setEarnedXP] = useState(0);
  const [showXPToast, setShowXPToast] = useState(false);

  const [selectedOption, setSelectedOption] = useState(null);
  const [typedAnswer, setTypedAnswer] = useState("");

  const [streak, setStreak] = useState(
    Number(localStorage.getItem("fj_streak")) || 0,
  );

  const [totalXP, setTotalXP] = useState(
    Number(localStorage.getItem("fj_xp")) || 0,
  );

  function getToday() {
    return new Date().toISOString().slice(0, 10);
  }

  function getYesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  function updateDailyStreak() {
    const today = getToday();
    const lastDate = localStorage.getItem("fj_last_practice_date");

    let newStreak = 1;

    if (lastDate === today) {
      return;
    }

    if (lastDate === getYesterday()) {
      newStreak = streak + 1;
    }

    localStorage.setItem("fj_streak", newStreak);
    localStorage.setItem("fj_last_practice_date", today);
    setStreak(newStreak);

    // 🏅 Weekly badge logic (MOVED INSIDE)
    if (newStreak % 7 === 0) {
      const badges = JSON.parse(localStorage.getItem("fj_badges")) || [];
      const badgeId = `week-${newStreak / 7}`;

      if (!badges.includes(badgeId)) {
        badges.push(badgeId);
        localStorage.setItem("fj_badges", JSON.stringify(badges));
      }
    }
  }
  // 🔁 Smart Resume on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("resume") === "1") {
      const last = JSON.parse(localStorage.getItem("fj_last_session"));
      if (last?.questionIndex != null) {
        setCurrentIndex(last.questionIndex);
      }
    }
  }, []);

  // Initialize question
  useEffect(() => {
    initQuiz();
  }, [currentIndex]);

  // 🔊 Initialize sound effects once
  useEffect(() => {
    correctSoundRef.current = new Audio("/sounds/correct.mp3");
    wrongSoundRef.current = new Audio("/sounds/wrong.mp3");
  }, []);

  // AUTO NEXT QUESTION
  useEffect(() => {
    if (status === "correct" || status === "reveal") {
      const timer = setTimeout(() => {
        loadNextQuestion();
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [status]);

  function initQuiz() {
    const shuffled = [...currentQuestion.correctOrder].sort(
      () => Math.random() - 0.5,
    );
    setTiles(shuffled);
    setAnswer([]);
    setAttempts(0);
    setStatus("idle");
    setShowHint(false);
    setWrongIndexes([]);
    setEarnedXP(0);

    // reset FILL state (MOVED INSIDE)
    setSelectedOption(null);
    setTypedAnswer("");
  }

  function loadNextQuestion() {
    setCurrentIndex((prev) => (prev + 1 < QUESTIONS.length ? prev + 1 : 0));
  }

  function addToAnswer(word) {
    if (status === "correct" || status === "reveal") return;

    setAnswer((prev) => [...prev, word]);
    setTiles((prev) => prev.filter((w) => w !== word));
  }
  function checkAnswer() {
    // 🧩 FILL-IN-THE-BLANK validation
    if (currentQuestion.type === "FILL") {
      const userAnswer = selectedOption || typedAnswer;

      if (userAnswer === currentQuestion.answer) {
        const attemptNumber = attempts + 1;
        const xp = XP_BY_ATTEMPT[attemptNumber] || 0;

        const newTotalXP = totalXP + xp;
        localStorage.setItem("fj_xp", newTotalXP);
        setTotalXP(newTotalXP);

        setEarnedXP(xp);
        setStatus("correct");
        updateDailyStreak();
        return;
      } else {
        const nextAttempts = attempts + 1;
        setAttempts(nextAttempts);
        setStatus("wrong");
        setShowHint(true);

        if (nextAttempts >= MAX_ATTEMPTS) {
          setStatus("reveal");
        }
        return;
      }
    }

    // ✅ REORDER validation (existing logic)
    const incorrect = [];

    answer.forEach((word, index) => {
      if (word !== currentQuestion.correctOrder[index]) {
        incorrect.push(index);
      }
    });

    // CORRECT
    if (incorrect.length === 0) {
      correctSoundRef.current?.play();

      const attemptNumber = attempts + 1;
      const xp = XP_BY_ATTEMPT[attemptNumber] || 0;

      const newTotalXP = totalXP + xp;
      localStorage.setItem("fj_xp", newTotalXP);
      setTotalXP(newTotalXP);

      setEarnedXP(xp);
      setShowXPToast(true);
      setWrongIndexes([]);
      setStatus("correct");

      updateDailyStreak();

      // 💾 SMART RESUME SAVE (ADD HERE)
      localStorage.setItem(
        "fj_last_session",
        JSON.stringify({
          practiceType: "reorder",
          questionIndex: currentIndex + 1,
          timestamp: Date.now(),
        }),
      );

      setTimeout(() => setShowXPToast(false), 1200);
      return;
    }

    // WRONG
    wrongSoundRef.current?.play();

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    setStatus("wrong");
    setShowHint(true);
    setWrongIndexes(incorrect);

    if (nextAttempts >= MAX_ATTEMPTS) {
      setStatus("reveal");
      setEarnedXP(0);
    }
  }

  function retryAttempt() {
    setAnswer([]);
    setWrongIndexes([]);
    setStatus("idle");
  }
  if (currentIndex >= QUESTIONS.length) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">🎉 Session Complete!</h1>
        <p className="mb-4">Great job! You finished today’s practice.</p>

        <button
          className="bg-purple-600 text-white px-6 py-3 rounded-lg"
          onClick={() => {
            setCurrentIndex(0);
            initQuiz();
          }}
        >
          Practice Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-center mb-6">
        Build the sentence
      </h1>
      <div className="text-center text-sm text-gray-500 mb-3">
        Question {currentIndex + 1} / {totalQuestions}
      </div>

      <div className="flex justify-center items-center gap-2 mb-4 text-orange-600 font-semibold">
        🔥 {streak}-day streak
      </div>

      {/* Tamil Prompt */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6 text-lg">
        {currentQuestion.tamil}
      </div>

      {/* Hint */}
      {showHint && status !== "correct" && (
        <div className="bg-purple-100 text-purple-800 p-3 rounded mb-4">
          💡 Hint: Subject → Verb → Action
        </div>
      )}
      {/* 🧩 Fill in the Blank UI */}
      {currentQuestion.type === "FILL" && (
        <>
          <div className="border-2 border-dashed rounded-lg p-4 mb-4 text-lg">
            {currentQuestion.sentence.split("____")[0]}
            <span className="inline-block min-w-[70px] mx-2 px-3 py-1 border-b-2 border-purple-600 text-center font-semibold">
              {selectedOption || "____"}
            </span>
            {currentQuestion.sentence.split("____")[1]}
          </div>

          <div className="flex flex-wrap gap-3 mb-6">
            {currentQuestion.options.map((opt) => (
              <button
                key={opt}
                onClick={() => setSelectedOption(opt)}
                className={`px-4 py-2 rounded-full border transition ${
                  selectedOption === opt
                    ? "bg-purple-600 text-white"
                    : "bg-white"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Answer Area */}
      <div className="border-2 border-dashed rounded-lg p-4 min-h-[70px] mb-4 flex flex-wrap gap-2">
        {answer.map((word, index) => {
          const isWrong = wrongIndexes.includes(index);
          return (
            <span
              key={index}
              className={`px-4 py-2 rounded-full text-white transition
                ${isWrong ? "bg-red-500 animate-shake" : "bg-blue-600"}
              `}
            >
              {word}
            </span>
          );
        })}
      </div>

      {/* Tile Bank */}
      <div className="border-2 border-dashed rounded-lg p-4 mb-6 flex flex-wrap gap-2">
        {tiles.map((word, index) => (
          <button
            key={index}
            onClick={() => addToAnswer(word)}
            className="px-4 py-2 rounded-full bg-blue-600 text-white hover:opacity-90"
          >
            {word}
          </button>
        ))}
      </div>

      {/* Check */}
      {status === "idle" && (
        <button
          onClick={checkAnswer}
          className="w-full bg-purple-600 text-white py-3 rounded-lg text-lg"
        >
          Check Answer
        </button>
      )}

      {/* Wrong */}
      {status === "wrong" && (
        <div className="mt-6">
          <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
            ❌ Not correct. Try again. ({attempts}/{MAX_ATTEMPTS})
          </div>
          <button
            onClick={retryAttempt}
            className="w-full bg-purple-600 text-white py-3 rounded-lg text-lg"
          >
            Try again
          </button>
        </div>
      )}
      {showXPToast && (
        <div className="fixed top-24 right-6 bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg animate-bounce z-50">
          +{earnedXP} XP ✨
        </div>
      )}

      {/* Correct */}
      {status === "correct" && (
        <div className="bg-green-100 text-green-700 p-4 rounded mt-6 text-center">
          ✅ Correct! Well done. <br />
          <span className="font-semibold">+{earnedXP} XP earned</span>
        </div>
      )}

      {/* Reveal */}
      {status === "reveal" && (
        <div className="bg-yellow-100 p-4 rounded mt-6">
          📘 <strong>Good attempt! Here is the correct order:</strong>
          <div className="flex flex-wrap gap-2 mt-3">
            {currentQuestion.correctOrder.map((word, index) => (
              <span key={index} className="px-3 py-1 bg-green-200 rounded">
                {word}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Shake animation */}
      <style>
        {`
          @keyframes shake {
            0% { transform: translateX(0); }
            25% { transform: translateX(-4px); }
            50% { transform: translateX(4px); }
            75% { transform: translateX(-4px); }
            100% { transform: translateX(0); }
          }
          .animate-shake {
            animation: shake 0.3s ease-in-out;
          }
        `}
      </style>
    </div>
  );
}
