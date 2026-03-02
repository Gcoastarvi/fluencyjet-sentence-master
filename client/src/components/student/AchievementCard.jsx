import React from "react";

export default function AchievementCard({
  lessonTitle,
  streak,
  overallAvg,
  difficulty,
}) {
  return (
    <div
      id="achievement-canvas"
      className="w-[400px] h-[600px] bg-gradient-to-br from-violet-600 to-indigo-700 p-8 flex flex-col justify-between text-white shadow-2xl rounded-[3rem]"
    >
      <div className="flex justify-between items-start">
        <div className="text-2xl font-black italic tracking-tighter">
          FluencyJet
        </div>
        <div className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-bold uppercase tracking-widest">
          Mastery Card
        </div>
      </div>

      <div className="flex flex-col items-center">
        <div className="text-6xl mb-4 animate-bounce">🔥</div>
        <div className="text-5xl font-black mb-2">{streak} Day Streak</div>
        <div className="text-white/80 text-sm font-medium uppercase tracking-[0.2em]">
          Consistency is Key
        </div>
      </div>

      <div className="bg-white/10 backdrop-blur-xl rounded-[2rem] p-6 border border-white/20">
        <div className="text-xs font-bold text-white/60 uppercase mb-1">
          Current Progress
        </div>
        <div className="text-2xl font-bold">{lessonTitle}</div>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400"
              style={{ width: `${overallAvg}%` }}
            />
          </div>
          <div className="font-black text-emerald-400">{overallAvg}%</div>
        </div>
      </div>

      <div className="text-center text-[10px] font-medium text-white/40 uppercase tracking-widest">
        Verified {difficulty} Level • Sentence Master AI
      </div>
    </div>
  );
}
