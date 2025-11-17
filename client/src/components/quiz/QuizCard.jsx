// client/src/components/quiz/QuizCard.jsx
import { useEffect, useRef } from "react";
import AudioPlayer from "./AudioPlayer";

function QuizCard({
  question,
  userAnswer,
  onChangeAnswer,
  onSubmit,
  feedback,
  disabled,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [question?.id]);

  const borderColor =
    feedback === "correct"
      ? "border-emerald-400"
      : feedback === "wrong"
        ? "border-rose-500"
        : "border-slate-800";

  const glow =
    feedback === "correct"
      ? "shadow-[0_0_30px_rgba(16,185,129,0.6)]"
      : feedback === "wrong"
        ? "shadow-[0_0_30px_rgba(244,63,94,0.6)]"
        : "shadow-[0_0_40px_rgba(15,23,42,0.9)]";

  return (
    <div
      className={`bg-slate-900/80 border ${borderColor} rounded-2xl p-5 md:p-6 ${glow} transition-all duration-200`}
    >
      <p className="text-xs font-semibold text-emerald-400 mb-2">
        Translate this sentence to English
      </p>

      <div className="text-2xl font-semibold mb-4 text-slate-50">
        {question.ta}
      </div>

      {question.audio_url && (
        <div className="mb-4">
          <AudioPlayer src={question.audio_url} />
        </div>
      )}

      <label className="block text-xs text-slate-400 mb-1">
        Type your answer in English
      </label>
      <input
        ref={inputRef}
        type="text"
        value={userAnswer}
        onChange={(e) => onChangeAnswer(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
        }}
        className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-3 py-2 text-base text-slate-50 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        placeholder="I am going to school"
        disabled={disabled}
      />

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="min-h-[1.25rem] text-sm">
          {feedback === "correct" && (
            <span className="text-emerald-400 font-medium">Correct! 🎉</span>
          )}
          {feedback === "wrong" && (
            <span className="text-rose-400 font-medium">
              Not quite, try the next one 💪
            </span>
          )}
        </div>

        <button
          onClick={onSubmit}
          disabled={disabled || !userAnswer.trim()}
          className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(16,185,129,0.5)] disabled:shadow-none transition-transform active:scale-95"
        >
          Check
        </button>
      </div>
    </div>
  );
}

export default QuizCard;
