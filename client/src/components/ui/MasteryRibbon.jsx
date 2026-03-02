import React from "react";

export default function MasteryRibbon() {
  return (
    <div className="absolute -top-2 -right-2 z-10 w-16 h-16 overflow-hidden">
      <div className="absolute top-0 right-0 w-full h-full bg-emerald-500 text-white flex items-center justify-center font-black text-[10px] uppercase tracking-tighter rotate-45 translate-x-[30%] translate-y-[-30%] shadow-lg border-b-2 border-emerald-600">
        Mastered
      </div>
      {/* Decorative Gold Fold Effect */}
      <div className="absolute top-0 left-0 w-1 h-1 bg-emerald-800" />
      <div className="absolute bottom-0 right-0 w-1 h-1 bg-emerald-800" />
    </div>
  );
}
