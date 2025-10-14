import { useState } from "react";

export default function Quiz({ lesson }) {
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState(null);

  const checkAnswer = () => {
    if (answer.trim().toLowerCase() === lesson.correctAnswer.toLowerCase()) {
      setResult("✅ Correct!");
    } else {
      setResult(`❌ Correct answer: ${lesson.correctAnswer}`);
    }
  };

  return (
    <div className="p-5 border rounded-2xl bg-white shadow-sm space-y-3">
      <p className="text-lg font-medium">{lesson.prompt}</p>
      <input
        type="text"
        className="w-full border rounded p-2"
        placeholder="Type your answer…"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
      />
      <button
        onClick={checkAnswer}
        className="bg-violet-600 text-white px-4 py-2 rounded-full"
      >
        Check
      </button>
      {result && <p className="text-center mt-2">{result}</p>}
    </div>
  );
}
