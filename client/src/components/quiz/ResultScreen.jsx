// client/src/components/quiz/ResultScreen.jsx
function ResultScreen({
  total,
  correct,
  xp,
  onRetry,
  onBackToLesson,
  onGoDashboard,
}) {
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6 flex items-center justify-center">
      <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-[0_15px_60px_rgba(15,23,42,0.9)] text-center space-y-5">
        <div className="text-4xl mb-2">🎉</div>
        <h1 className="text-2xl font-bold mb-1">Quiz Complete!</h1>
        <p className="text-sm text-slate-300 mb-4">
          Great job practicing your English sentences.
        </p>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="bg-slate-900 rounded-xl p-3 border border-slate-800">
            <p className="text-xs text-slate-400 mb-1">Total</p>
            <p className="text-lg font-bold">{total}</p>
            <p className="text-[11px] text-slate-400 mt-1">Questions</p>
          </div>
          <div className="bg-slate-900 rounded-xl p-3 border border-slate-800">
            <p className="text-xs text-slate-400 mb-1">Correct</p>
            <p className="text-lg font-bold text-emerald-400">{correct}</p>
            <p className="text-[11px] text-slate-400 mt-1">Good memory!</p>
          </div>
          <div className="bg-slate-900 rounded-xl p-3 border border-slate-800">
            <p className="text-xs text-slate-400 mb-1">Accuracy</p>
            <p className="text-lg font-bold">{accuracy}%</p>
            <p className="text-[11px] text-slate-400 mt-1">Keep going</p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-400/10 border border-emerald-500/40 rounded-2xl p-4">
          <p className="text-sm text-emerald-300 font-semibold">
            +{xp} XP earned
          </p>
          <p className="text-xs text-slate-300 mt-1">
            XP has been added to your account. Your fluency jet is getting
            faster ✈️
          </p>
        </div>

        <div className="flex flex-col gap-2 mt-4">
          <button
            onClick={onRetry}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-sm font-semibold text-white py-2.5 rounded-xl shadow-[0_8px_25px_rgba(16,185,129,0.8)] active:scale-95 transition-transform"
          >
            🔁 Retry this quiz
          </button>
          <button
            onClick={onBackToLesson}
            className="w-full bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-50 py-2.5 rounded-xl"
          >
            ← Back to lesson
          </button>
          <button
            onClick={onGoDashboard}
            className="w-full bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-300 py-2 rounded-xl"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResultScreen;
