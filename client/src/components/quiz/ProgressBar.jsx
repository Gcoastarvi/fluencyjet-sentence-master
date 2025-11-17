// client/src/components/quiz/ProgressBar.jsx
function ProgressBar({ current, total }) {
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;

  return (
    <div className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-3">
      <div className="flex items-center justify-between mb-1 text-xs text-slate-300">
        <span>
          Question {current} of {total}
        </span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-300 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
