import React from "react";

export default function BadgeShareCard({ badgeName, userName, date }) {
  return (
    <div
      id="badge-share-card"
      className="w-[400px] h-[400px] bg-gradient-to-br from-indigo-600 to-violet-700 p-8 flex flex-col items-center justify-center text-center text-white font-sans"
    >
      <div className="text-8xl mb-6">🛡️</div>
      <h2 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mb-2">
        FluencyJet Achievement
      </h2>
      <h1 className="text-3xl font-black tracking-tighter mb-4">{badgeName}</h1>
      <div className="h-px w-20 bg-white/30 mb-4" />
      <p className="text-sm font-medium text-indigo-100">Awarded to</p>
      <p className="text-xl font-bold">{userName}</p>
      <p className="text-[10px] mt-6 opacity-60 font-mono uppercase">{date}</p>
    </div>
  );
}
