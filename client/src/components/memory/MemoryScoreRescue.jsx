import MemoryConversionDialog from "./MemoryConversionDialog";

export default function MemoryScoreRescue({ isAdvanced, onClose, onSave }) {
  const description = isAdvanced
    ? "Save your score on WhatsApp and watch the 4-minute video to see why you forget — and how to remember more."
    : "Save your child’s score on WhatsApp and watch the 4-minute video to see why students forget — and how to remember more.";

  return (
    <MemoryConversionDialog
      title="WAIT — DON’T LOSE YOUR SCORE"
      description={description}
      onClose={onClose}
      contentClassName="max-w-lg"
    >
      <div className="mt-7 space-y-3">
        <button
          type="button"
          onClick={onSave}
          className="w-full rounded-xl bg-indigo-600 px-5 py-4 text-base font-black text-white shadow-lg transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 sm:text-lg"
        >
          SAVE MY SCORE &amp; WATCH THE VIDEO →
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl px-5 py-3 font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          No thanks
        </button>
      </div>
    </MemoryConversionDialog>
  );
}
