import { useState, useEffect } from "react";

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
    tamil: "அவன் தினமும் காலைல exercise பண்ணுறான்",
    correctOrder: ["He", "does", "exercise", "every", "morning"],
  },
];

export default function SentencePractice() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentQuestion = QUESTIONS[currentIndex];

  const [tiles, setTiles] = useState([]);
  const [answer, setAnswer] = useState([]);
  const [attempts, setAttempts] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | wrong | correct | reveal
  const [showHint, setShowHint] = useState(false);
  const [wrongIndexes, setWrongIndexes] = useState([]);
  const [earnedXP, setEarnedXP] = useState(0);

  // Initialize question
  useEffect(() => {
    initQuiz();
  }, [currentIndex]);

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
    const incorrect = [];

    answer.forEach((word, index) => {
      if (word !== currentQuestion.correctOrder[index]) {
        incorrect.push(index);
      }
    });

    // CORRECT
    if (incorrect.length === 0) {
      const attemptNumber = attempts + 1;
      const xp = XP_BY_ATTEMPT[attemptNumber] || 0;

      setEarnedXP(xp);
      setWrongIndexes([]);
      setStatus("correct");
      return;
    }

    // WRONG
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

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-center mb-6">
        Build the sentence
      </h1>

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
