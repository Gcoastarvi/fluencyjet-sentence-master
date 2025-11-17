// client/src/components/quiz/AudioPlayer.jsx
function AudioPlayer({ src }) {
  if (!src) return null;

  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 flex items-center gap-2">
      <span className="text-xs text-slate-300">Audio</span>
      <audio controls className="w-full">
        <source src={src} type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
    </div>
  );
}

export default AudioPlayer;
