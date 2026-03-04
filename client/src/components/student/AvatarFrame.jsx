import React from "react";

export default function AvatarFrame({ src, league = "BRONZE", size = "md" }) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-16 h-16",
    lg: "w-24 h-24",
  };

  return (
    <div className="relative inline-block">
      <img
        src={src || "https://api.dicebear.com/7.x/avataaars/svg?seed=Learner"}
        alt="User Avatar"
        className={`${sizeClasses[size]} rounded-full object-cover frame-${league} bg-white transition-all duration-500`}
      />
      {/* 🏅 Small League Badge overlay */}
      <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-md text-[10px]">
        {league === "BRONZE" && "🥉"}
        {league === "SILVER" && "🥈"}
        {league === "GOLD" && "🥇"}
        {league === "DIAMOND" && "💎"}
      </div>
    </div>
  );
}
