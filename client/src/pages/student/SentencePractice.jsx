import { useEffect, useState } from "react";

/**
 * TEMP: Local dummy quiz
 * Later this will come from API / DB
 */
const DUMMY_QUIZ = {
  id: 1,
  quizType: "REORDER",
  level: "BEGINNER",
  languageMode: "TA_EN",
  promptTamil: "அவள் annual exams ல pass ஆக hard ஆ study பண்ணிட்டு இருக்கா",
  correctSentence: "She is studying hard to pass her annual exams",
  wordBank: [
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
};

export default function SentencePractice() {
  const [tiles, setTiles] = useState([]);
  const [answer, setAnswer] = useState([]);
  const [result, setResult] = useState(null); // "correct" | "wrong"

  // shuffle word bank on load
  useEffect(() => {
    const shuffled = [...DUMMY_QUIZ.wordBank].sort(() => Math.random() - 0.5);
    setTiles(shuffled);
  }, []);

  function selectTile(word) {
    setAnswer([...answer, word]);
    setTiles(tiles.filter((w) => w !== word));
  }

  function removeFromAnswer(word, index) {
    const updated = [...answer];
    updated.splice(index, 1);
    setAnswer(updated);
    setTiles([...tiles, word]);
  }

  function checkAnswer() {
    const userSentence = answer.join(" ").trim();
    const correct = DUMMY_QUIZ.correctSentence.trim();

    if (userSentence === correct) {
      setResult("correct");
      // TODO: XP API hook
    } else {
      setResult("wrong");
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <h2 className="text-xl font-semibold text-center mb-2">
        Build the sentence
      </h2>

      {/* Tamil Prompt */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
        <p className="text-gray-800">{DUMMY_QUIZ.promptTamil}</p>
      </div>

      {/* Answer Area */}
      <div className="min-h-[60px] border-2 border-dashed border-gray-300 rounded-lg p-3 mb-4 flex flex-wrap gap-2">
        {answer.length === 0 && (
          <span className="text-gray-400">Tap words to form sentence</span>
        )}
        {answer.map((word, idx) => (
          <button
            key={idx}
            onClick={() => removeFromAnswer(word, idx)}
            className="px-3 py-1 bg-blue-600 text-white rounded-full"
          >
            {word}
          </button>
        ))}
      </div>

      {/* Word Bank */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tiles.map((word, idx) => (
          <button
            key={idx}
            onClick={() => selectTile(word)}
            className="px-3 py-2 bg-gray-100 border rounded-lg hover:bg-gray-200"
          >
            {word}
          </button>
        ))}
      </div>

      {/* Check Button */}
      <button
        onClick={checkAnswer}
        disabled={answer.length === 0}
        className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
      >
        Check Answer
      </button>

      {/* Result */}
      {result && (
        <div
          className={`mt-4 p-4 rounded-lg text-center font-medium ${
            result === "correct"
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {result === "correct"
            ? "✅ Correct! Well done."
            : "❌ Not quite. Try again."}
        </div>
      )}
    </div>
  );
}
