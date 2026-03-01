import { useState, useEffect } from "react";

export default function SentenceBuilder({
  correctSentence,
  onCorrect,
  onWrong,
  accentColor = "indigo",
}) {
  const [tiles, setTiles] = useState([]);
  const [answer, setAnswer] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | correct | wrong

  // Initialize and shuffle
  useEffect(() => {
    const words = correctSentence.split(/\s+/).filter(Boolean);
    setTiles([...words].sort(() => Math.random() - 0.5));
    setAnswer([]);
    setStatus("idle");
  }, [correctSentence]);

  const handleTileClick = (word, index) => {
    if (status === "correct") return;
    setAnswer([...answer, word]);
    setTiles(tiles.filter((_, i) => i !== index));
  };

  const handleReset = () => {
    const words = correctSentence.split(/\s+/).filter(Boolean);
    setTiles([...words].sort(() => Math.random() - 0.5));
    setAnswer([]);
    setStatus("idle");
  };

  const checkResult = () => {
    const userSentence = answer.join(" ");
    if (userSentence === correctSentence) {
      setStatus("correct");
      onCorrect?.();
    } else {
      setStatus("wrong");
      onWrong?.();
    }
  };

  const colors = {
    indigo: {
      bar: "bg-indigo-500",
      text: "text-indigo-700",
      bg: "bg-indigo-50",
      border: "border-indigo-200",
    },
    violet: {
      bar: "bg-violet-500",
      text: "text-violet-700",
      bg: "bg-violet-50",
      border: "border-violet-200",
    },
  };
  const C = colors[accentColor] || colors.indigo;

  return (
    <div className="w-full max-w-md mx-auto p-4 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className={`h-1.5 w-full -mt-4 -mx-4 mb-4 ${C.bar}`} />

      {/* Build Area */}
      <div className="min-h-[80px] p-4 rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/50 flex flex-wrap gap-2 mb-4">
        {answer.length === 0 && (
          <span className="text-slate-400 text-sm font-medium">
            Tap words to build...
          </span>
        )}
        {answer.map((word, i) => (
          <span
            key={i}
            className={`px-4 py-2 rounded-full font-bold shadow-sm ${C.bg} ${C.text} ${C.border} border`}
          >
            {word}
          </span>
        ))}
      </div>

      {/* Word Bank */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tiles.map((word, i) => (
          <button
            key={i}
            onClick={() => handleTileClick(word, i)}
            className="px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 font-bold hover:border-slate-300 active:scale-95 transition-all"
          >
            {word}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleReset}
          className="px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50"
        >
          Reset
        </button>
        <button
          onClick={checkResult}
          disabled={tiles.length > 0}
          className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg transition-all ${C.bar} hover:brightness-110 disabled:opacity-50`}
        >
          Check Answer
        </button>
      </div>
    </div>
  );
}
