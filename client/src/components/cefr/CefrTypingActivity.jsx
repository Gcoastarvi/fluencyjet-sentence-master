import { useEffect, useRef, useState } from "react";

const GERMAN_CHARACTERS = ["ä", "ö", "ü", "ß", "Ä", "Ö", "Ü"];

export default function CefrTypingActivity({
  item,
  activityTitle = "Type It",
  result,
  submitting = false,
  onAnswerChange,
  onSubmit,
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    setValue("");
  }, [item?.id]);

  const isCorrect = result?.isCorrect === true;
  const isWrong = result?.isCorrect === false;

  const canSubmit =
    value.trim().length > 0 &&
    !submitting &&
    !isCorrect;

  function notifyChanged() {
    onAnswerChange?.();
  }

  function handleChange(event) {
    if (isCorrect || submitting) return;

    setValue(event.target.value);
    notifyChanged();
  }

  function insertGermanCharacter(character) {
    if (isCorrect || submitting) return;

    const input = inputRef.current;

    const start =
      typeof input?.selectionStart === "number"
        ? input.selectionStart
        : value.length;

    const end =
      typeof input?.selectionEnd === "number"
        ? input.selectionEnd
        : value.length;

    const nextValue =
      value.slice(0, start) +
      character +
      value.slice(end);

    const nextCursor = start + character.length;

    setValue(nextValue);
    notifyChanged();

    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(
        nextCursor,
        nextCursor,
      );
    });
  }

  function handleSubmit(event) {
    event?.preventDefault();

    if (!canSubmit) return;

    onSubmit?.(value);
  }

  return (
    <div className="rounded-[2rem] border border-indigo-100 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-600">
        {activityTitle}
      </p>

      <h2 className="mt-3 text-xl font-black text-slate-950 sm:text-2xl">
        Type this sentence in German
      </h2>

      <div className="mt-5 rounded-2xl bg-slate-50 px-5 py-4">
        <p className="text-lg font-bold text-slate-800">
          {item?.prompt?.text || ""}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-6"
      >
        <label
          htmlFor={`cefr-typing-${item?.id || "item"}`}
          className="text-sm font-black text-slate-700"
        >
          Your German sentence
        </label>

        <input
          ref={inputRef}
          id={`cefr-typing-${item?.id || "item"}`}
          type="text"
          lang="de"
          value={value}
          disabled={submitting || isCorrect}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          onChange={handleChange}
          placeholder="Type your answer in German"
          className={`mt-2 w-full rounded-2xl border px-4 py-4 text-lg font-bold outline-none transition ${
            isCorrect
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : isWrong
                ? "border-rose-300 bg-rose-50 text-slate-950 focus:border-rose-400"
                : "border-slate-200 bg-white text-slate-950 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
          } disabled:cursor-not-allowed`}
        />

        <div className="mt-4">
          <p className="text-xs font-bold text-slate-500">
            German characters — tap to insert
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            {GERMAN_CHARACTERS.map((character) => (
              <button
                key={character}
                type="button"
                disabled={submitting || isCorrect}
                onClick={() =>
                  insertGermanCharacter(character)
                }
                className="flex h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-lg font-black text-slate-800 transition hover:border-indigo-300 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {character}
              </button>
            ))}
          </div>
        </div>

        {isWrong && (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm font-black text-rose-700">
            Not quite — try again.
          </div>
        )}

        {isCorrect && (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-black text-emerald-700">
            Correct!
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-5 w-full rounded-2xl bg-indigo-600 px-5 py-4 font-black text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? "Checking..." : "Check Answer"}
        </button>
      </form>
    </div>
  );
}
