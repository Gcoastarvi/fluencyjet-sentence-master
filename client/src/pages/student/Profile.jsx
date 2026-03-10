import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/apiClient";

export default function Profile() {
  const { auth } = useAuth();
  const [stats, setStats] = useState({ mastered: 0 });

  useEffect(() => {
    // Fetch how many lessons this user has mastered
    api.get("/api/lessons").then((res) => {
      const mastered = res.data.filter(
        (l) => l.progress?.typing === 100,
      ).length;
      setStats({ mastered });
    });
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="bg-white rounded-[3rem] p-10 shadow-xl border border-slate-100 flex items-center gap-8 mb-12">
        <div className="h-24 w-24 bg-indigo-600 rounded-full flex items-center justify-center text-4xl text-white font-black">
          {auth?.user?.name?.[0] || "M"}
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-900">
            {auth?.user?.name || "Sentence Master"}
          </h2>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-1">
            🔥 {auth?.user?.daily_streak || 0} Day Streak
          </p>
        </div>
      </div>

      <h3 className="text-xl font-black text-slate-900 mb-6">
        Unlocked Achievements
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <BadgeCard label="Rookie" condition={true} icon="🌱" />
        <BadgeCard
          label="10-Day Legend"
          condition={auth?.user?.daily_streak >= 10}
          icon="🔥"
        />
        <BadgeCard
          label="Master of 10"
          condition={stats.mastered >= 10}
          icon="🎯"
        />
        <BadgeCard label="Titan" condition={stats.mastered >= 50} icon="👑" />
      </div>
    </div>
  );
}

function BadgeCard({ label, condition, icon }) {
  return (
    <div
      className={`p-6 rounded-3xl border-2 text-center transition-all ${condition ? "border-amber-200 bg-amber-50" : "border-slate-100 opacity-40 grayscale"}`}
    >
      <div className="text-4xl mb-3">{icon}</div>
      <p className="text-[10px] font-black uppercase text-slate-600">{label}</p>
    </div>
  );
}
