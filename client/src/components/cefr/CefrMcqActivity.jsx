export default function CefrMcqActivity({
  item,
  selectedOptionId = "",
  result = null,
  submitting = false,
  onSelect,
  onSubmit,
}) {
  const options = Array.isArray(item?.payload?.options)
    ? item.payload.options
    : [];

  const isCorrect = result?.isCorrect === true;
  const isWrong = result?.isCorrect === false;
  const locked = submitting || isCorrect;

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-600">
          Quick Win
        </p>

        <h2 className="mt-3 text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-3xl">
          {item?.prompt?.text || "Choose the correct answer."}
        </h2>
      </div>

      <div className="mt-6 space-y-3">
        {options.map((option) => {
          const selected = selectedOptionId === option.id;

          let classes =
            "border-slate-200 bg-white text-slate-800 hover:border-indigo-300 hover:bg-indigo-50";

          if (selected && !result) {
            classes =
              "border-indigo-500 bg-indigo-50 text-indigo-950 ring-2 ring-indigo-100";
          }

          if (selected && isCorrect) {
            classes =
              "border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-100";
          }

          if (selected && isWrong) {
            classes =
              "border-rose-500 bg-rose-50 text-rose-900 ring-2 ring-rose-100";
          }

          return (
            <button
              key={option.id}
              type="button"
              disabled={locked}
              onClick={() => onSelect?.(option.id)}
              className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition disabled:cursor-not-allowed sm:px-5 ${classes}`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-black ${
                  selected
                    ? "border-current bg-white/70"
                    : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                {String.fromCharCode(
                  65 + Math.max(0, options.indexOf(option)),
                )}
              </span>

              <span className="text-base font-extrabold sm:text-lg">
                {option.text}
              </span>
            </button>
          );
        })}
      </div>

      {isCorrect && (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="font-extrabold text-emerald-800">
            Correct! 🎉
          </p>
        </div>
      )}

      {isWrong && (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="font-extrabold text-rose-800">
            Not quite — try again.
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={
          submitting ||
          !selectedOptionId ||
          isCorrect
        }
        onClick={onSubmit}
        className="mt-6 w-full rounded-2xl bg-indigo-600 px-5 py-4 text-base font-black text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {submitting ? "Checking..." : "Check answer"}
      </button>
    </div>
  );
}
