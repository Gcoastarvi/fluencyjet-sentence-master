import { useEffect, useMemo, useState } from "react";

import ReorderExerciseCard from "@/components/practice/ReorderExerciseCard";

function makeTokenTiles(item) {
  const tokens = Array.isArray(item?.payload?.tokens)
    ? item.payload.tokens
    : [];

  return tokens.map((text, index) => ({
    id: `${item?.id || "item"}:token:${index}`,
    text: String(text),
  }));
}

export default function CefrReorderActivity({
  item,
  activityTitle = "Build It",
  result,
  submitting = false,
  onAnswerChange,
  onSubmit,
}) {
  const initialTiles = useMemo(
    () => makeTokenTiles(item),
    [item],
  );

  const [tiles, setTiles] = useState(initialTiles);
  const [answer, setAnswer] = useState([]);

  useEffect(() => {
    setTiles(initialTiles);
    setAnswer([]);
  }, [item?.id, initialTiles]);

  const isCorrect = result?.isCorrect === true;
  const isWrong = result?.isCorrect === false;

  const status = isCorrect
    ? "correct"
    : isWrong
      ? "wrong"
      : "idle";

  const canSubmit =
    answer.length > 0 &&
    answer.length === initialTiles.length &&
    !submitting &&
    !isCorrect;

  function notifyChanged() {
    onAnswerChange?.();
  }

  function handleTileClick(tile, index) {
    if (isCorrect || submitting) return;

    setTiles((previous) =>
      previous.filter((_, tileIndex) => tileIndex !== index),
    );

    setAnswer((previous) => [...previous, tile]);

    notifyChanged();
  }

  function handleAnswerClick(tile, index) {
    if (isCorrect || submitting) return;

    setAnswer((previous) =>
      previous.filter((_, answerIndex) => answerIndex !== index),
    );

    setTiles((previous) => [...previous, tile]);

    notifyChanged();
  }

  function handleReset() {
    if (isCorrect || submitting) return;

    setTiles(initialTiles);
    setAnswer([]);

    notifyChanged();
  }

  function handleSubmit() {
    if (!canSubmit) return;

    onSubmit?.(
      answer.map((tile) => tile.text),
    );
  }

  const footer = (
    <div className="mt-5 space-y-3">
      <button
        type="button"
        disabled={!canSubmit}
        onClick={handleSubmit}
        className="w-full rounded-2xl bg-indigo-600 px-5 py-4 font-black text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {submitting ? "Checking..." : "Check Answer"}
      </button>

      {!isCorrect && answer.length > 0 && (
        <button
          type="button"
          disabled={submitting}
          onClick={handleReset}
          className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          Reset
        </button>
      )}
    </div>
  );

  return (
    <ReorderExerciseCard
      title={activityTitle}
      subtitle={
        item?.prompt?.text ||
        "Build the sentence in the correct order."
      }
      answer={answer}
      tiles={tiles}
      status={status}
      answerPlaceholder="Tap the words in the correct order"
      onTileClick={handleTileClick}
      onAnswerClick={handleAnswerClick}
      disabled={submitting || isCorrect}
      footer={footer}
    />
  );
}
