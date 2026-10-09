import MemoryConversionDialog from "./MemoryConversionDialog";

export default function MemoryVslModal({ vimeoId, isAdvanced, onClose }) {
  const description = isAdvanced
    ? "Watch this 4-minute video: See why you forget — and how to remember more."
    : "Watch this 4-minute video: See why students forget — and how to remember more.";

  return (
    <MemoryConversionDialog
      title="Your score is saved ✓"
      description={description}
      onClose={onClose}
      contentClassName="max-w-3xl"
    >
      <div className="mt-6 overflow-hidden rounded-2xl bg-slate-950 shadow-lg">
        {vimeoId ? (
          <div className="relative w-full pb-[56.25%]">
            <iframe
              className="absolute inset-0 h-full w-full"
              src={`https://player.vimeo.com/video/${encodeURIComponent(vimeoId)}?title=0&byline=0&portrait=0`}
              title={isAdvanced ? "Study memory video for older learners" : "Study memory video for parents"}
              loading="lazy"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center px-6 text-center text-white">
            <p className="font-bold text-white/80">The video is unavailable right now.</p>
          </div>
        )}
      </div>
    </MemoryConversionDialog>
  );
}
