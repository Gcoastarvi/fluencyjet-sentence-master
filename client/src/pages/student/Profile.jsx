import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/apiClient";

export default function Profile() {
  const { auth } = useAuth();
  const [stats, setStats] = useState({ mastered: 0 });

  useEffect(() => {
    // 🎯 Use the existing auth data or fetch specific profile stats
    if (auth?.user) {
      const masteredCount = auth.user.masteredCount || 0;
      setStats((prev) => ({ ...prev, mastered: masteredCount }));
    }

    // Optional: If you want to refresh the specific history from the server
    // api.get("/api/me").then((res) => {
    //   if (res.data.league_history) {
    //      setHistory(res.data.league_history);
    //   }
    // });
  }, [auth?.user]);

  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* 👤 Header Section */}
      <div className="bg-white rounded-[3rem] p-10 shadow-xl border border-slate-100 flex items-center gap-8 mb-12">
        <div className="h-24 w-24 bg-indigo-600 rounded-full flex items-center justify-center text-4xl text-white font-black">
          {auth?.user?.username?.[0] || "M"}
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-900">
            {auth?.user?.username || "Sentence Master"}
          </h2>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-1">
            🔥 {auth?.user?.daily_streak || 0} Day Streak
          </p>
        </div>
      </div>

      {/* 🏆 Unlocked Achievements */}
      <div className="mb-12">
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
            condition={(stats?.mastered || 0) >= 10}
            icon="🎯"
          />
          <BadgeCard
            label="Titan"
            condition={(stats?.mastered || 0) >= 50}
            icon="👑"
          />
        </div>
      </div>

      <hr className="border-slate-100 mb-12" />

      {/* 📜 League History Tab */}
      <div className="mt-12">
        <div className="flex items-center gap-3 mb-6">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">
            League History
          </h3>
          <span className="px-2 py-0.5 bg-slate-100 rounded-md text-[10px] font-bold text-slate-400">
            HALL OF FAME
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {auth?.user?.league_history?.length > 0 ? (
            auth.user.league_history.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-[2rem] bg-white border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-100 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                    {item.leagueName === "BRONZE" ? "🥉" : "🥈"}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900 leading-none">
                      {item.leagueName} LEAGUE
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                      Finished #{item.rank} •{" "}
                      {new Date(item.seasonEnded).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-indigo-600">
                    +{item.xpEarned} XP
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-10 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
              <p className="text-xs font-bold text-slate-400 italic">
                Your journey has just begun. Complete your first week to earn a
                spot here!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 🎯 Sub-component for Badge Cards
function BadgeCard({ label, condition, icon }) {
  return (
    <div
      className={`p-6 rounded-3xl border-2 text-center transition-all ${
        condition
          ? "border-amber-200 bg-amber-50"
          : "border-slate-100 opacity-40 grayscale"
      }`}
    >
      <div className="text-4xl mb-3">{icon}</div>
      <p className="text-[10px] font-black uppercase text-slate-600">{label}</p>
    </div>
  );
}
