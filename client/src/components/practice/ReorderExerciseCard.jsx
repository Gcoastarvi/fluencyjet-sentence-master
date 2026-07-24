const DEFAULT_ACCENT = {
  bar: "bg-indigo-500",
  border: "border-indigo-200",
  soft: "bg-indigo-50",
  text: "text-indigo-700",
};

function getItemText(item) {
  if (typeof item === "string") return item;

  return String(item?.text ?? item?.word ?? item?.label ?? item?.value ?? "");
}

function getItemKey(item, index, prefix) {
  if (item && typeof item === "object" && item.id !== undefined) {
    return String(item.id);
  }

  return `${prefix}-${getItemText(item)}-${index}`;
}

export default function ReorderExerciseCard({
  title = "Quick English",
  subtitle = "Build the English sentence",
  answer = [],
  tiles = [],
  wrongIndexes = [],
  status = "idle",
  accent = DEFAULT_ACCENT,
  answerPlaceholder = "Tap words in the correct order",
  onTileClick,
  onAnswerClick,
  disabled = false,
  footer = null,
  className = "",
}) {
  const A = accent || DEFAULT_ACCENT;

  const safeAnswer = Array.isArray(answer) ? answer : [];
  const safeTiles = Array.isArray(tiles) ? tiles : [];
  const safeWrongIndexes = Array.isArray(wrongIndexes) ? wrongIndexes : [];

  const interactionLocked =
    disabled || status === "correct" || status === "reveal";

  return (
    <div
      className={`rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-6 ${className}`}
    >
      <div className={`h-1.5 w-full rounded-full ${A.bar}`} />

      <div className="mb-5 mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[22px] font-black tracking-tight text-slate-950 sm:text-2xl">
            {title}
          </h2>

          <p className="mt-1 text-sm font-bold text-slate-500">{subtitle}</p>

          {(status === "wrong" || safeWrongIndexes.length > 0) && (
            <div className="mt-3 inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
              Not quite — try again
            </div>
          )}

          {status === "reveal" && (
            <div
              className={`mt-3 inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${A.border} ${A.soft} ${A.text}`}
            >
              Answer shown
            </div>
          )}

          {status === "correct" && (
            <div className="mt-3 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              Correct ✅
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex min-h-[96px] flex-wrap content-start gap-3 rounded-[1.5rem] border border-dashed border-indigo-200 bg-gradient-to-br from-indigo-50/80 via-white to-white p-5 shadow-inner">
        {safeAnswer.length === 0 && (
          <div className="flex w-full items-center text-[15px] font-black text-slate-400 sm:text-base">
            {answerPlaceholder}
          </div>
        )}

        {safeAnswer.map((item, index) => {
          const text = getItemText(item);
          const isWrong = safeWrongIndexes.includes(index);

          const answerClassName = `rounded-2xl px-5 py-3 text-[20px] font-black shadow-md transition-transform active:scale-[0.98] sm:text-[22px] ${
            isWrong
              ? "border border-rose-200 bg-rose-100 text-rose-800"
              : "border border-indigo-100 bg-white text-indigo-950"
          }`;

          if (onAnswerClick) {
            return (
              <button
                key={getItemKey(item, index, "answer")}
                type="button"
                className={answerClassName}
                onClick={() => onAnswerClick(item, index)}
                disabled={interactionLocked}
              >
                {text}
              </button>
            );
          }

          return (
            <span
              key={getItemKey(item, index, "answer")}
              className={answerClassName}
            >
              {text}
            </span>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        {safeTiles.map((item, index) => (
          <button
            key={getItemKey(item, index, "tile")}
            type="button"
            onClick={() => onTileClick?.(item, index)}
            disabled={interactionLocked}
            className={`rounded-2xl border px-5 py-3 text-[19px] font-extrabold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 sm:text-[20px] ${A.border} ${A.soft} ${A.text}`}
          >
            {getItemText(item)}
          </button>
        ))}
      </div>

      {footer}
    </div>
  );
}
