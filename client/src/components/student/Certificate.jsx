import React from "react";

export default function Certificate({ userName, trackName, date }) {
  return (
    <div
      id="certificate-canvas"
      className="w-[1000px] h-[700px] bg-white p-12 flex flex-col items-center justify-between border-[16px] border-double border-violet-600 relative overflow-hidden text-slate-900"
    >
      {/* Background Watermark Decoration */}
      <div className="absolute -bottom-20 -right-20 text-[200px] opacity-5 font-black italic rotate-[-15deg] pointer-events-none">
        FluencyJet
      </div>

      <div className="w-full flex justify-between items-start">
        <div className="text-3xl font-black italic tracking-tighter text-violet-600">
          FluencyJet
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
            Credential ID
          </div>
          <div className="text-xs font-mono text-slate-500">
            FJ-{Math.random().toString(36).substr(2, 9).toUpperCase()}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.5em] text-violet-500 mb-4">
          Certificate of Completion
        </div>
        <h1 className="text-5xl font-serif italic text-slate-800 mb-2">
          This is to certify that
        </h1>
        <div className="text-6xl font-black text-slate-900 underline underline-offset-8 decoration-violet-200 mb-8 px-12 text-center">
          {userName || "Valued Student"}
        </div>
        <p className="text-xl text-slate-600 max-w-2xl text-center leading-relaxed">
          has successfully mastered the{" "}
          <span className="font-bold text-violet-700">
            {trackName} English Track
          </span>
          , demonstrating proficiency in sentence construction, grammar
          accuracy, and pronunciation through the FluencyJet Sentence Master AI
          curriculum.
        </p>
      </div>

      <div className="w-full flex justify-between items-end border-t border-slate-100 pt-8">
        <div className="text-left">
          <div className="text-lg font-serif italic text-slate-800">
            Aravind
          </div>
          <div className="h-0.5 w-32 bg-slate-200 my-1" />
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Founder, FluencyJet
          </div>
        </div>
        <div className="text-center">
          <div className="w-20 h-20 bg-violet-600 rounded-full flex items-center justify-center text-white text-3xl shadow-xl shadow-violet-100">
            🏆
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-slate-800">{date}</div>
          <div className="h-0.5 w-32 bg-slate-200 my-1 ml-auto" />
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Date of Achievement
          </div>
        </div>
      </div>
    </div>
  );
}
