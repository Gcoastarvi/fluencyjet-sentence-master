import React, { useState, useEffect } from "react";
import { api } from "@/api/apiClient";
import { useNavigate } from "react-router-dom";

export default function Upgrade() {
  const navigate = useNavigate();
  const [userXp, setUserXp] = useState(0);
  const [freezes, setFreezes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);

  // Update your existing useEffect to fetch history
  useEffect(() => {
    async function loadStoreData() {
      try {
        const res = await api.get("/dashboard/summary");
        if (res.ok) {
          setUserXp(res.totalXP || 0);
          setFreezes(res.streakFreezes || 0);

          // Filter recentActivity for purchases (negative XP)
          const purchases = (res.recentActivity || []).filter(
            (item) => item.xp_delta < 0,
          );
          setHistory(purchases);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadStoreData();
  }, []);

  const handleBuyFreeze = async () => {
    if (userXp < 200)
      return alert("Not enough XP! Keep practicing to earn more.");
    if (!window.confirm("🧊 Spend 200 XP to protect your streak?")) return;

    try {
      const res = await api.post("/quizzes/purchase-streak-freeze");
      if (res.ok) {
        setUserXp((prev) => prev - 200);
        setFreezes((prev) => prev + 1);
        alert("Streak Freeze Activated! 🧊 Your streak is now protected.");
      }
    } catch (err) {
      alert("Purchase failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="mx-auto max-w-2xl p-6">
        <header className="mb-12 text-center pt-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-[0.2em] mb-4 shadow-sm">
            ✨ Premium Store
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Level Up Your Learning
          </h1>
          <p className="text-slate-500 mt-2 font-medium">
            Use your XP to unlock powerful boosters.
          </p>
        </header>

        {/* XP Balance Card */}
        <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white mb-8 shadow-xl shadow-indigo-100 flex items-center justify-between overflow-hidden relative">
          <div className="relative z-10">
            <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest">
              Available Balance
            </p>
            <h2 className="text-4xl font-black mt-1">
              {userXp.toLocaleString()} XP
            </h2>
          </div>
          <div className="text-6xl opacity-20 absolute -right-4 -bottom-4 rotate-12">
            ⭐
          </div>
          <div className="bg-white/20 backdrop-blur-md rounded-2xl px-4 py-2 border border-white/20">
            <span className="font-bold text-sm">
              Level {Math.floor(userXp / 1000) + 1}
            </span>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Streak Freeze Item */}
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-3xl bg-sky-50 flex items-center justify-center text-4xl shadow-inner group-hover:scale-110 transition-transform">
                🧊
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 leading-tight">
                  Streak Freeze
                </h3>
                <p className="text-slate-500 text-sm mt-1 max-w-[200px]">
                  Protect your progress even if you miss a day.
                </p>
                <div className="mt-2 text-[10px] font-bold text-sky-600 uppercase tracking-widest flex items-center gap-2">
                  Owned: {freezes}
                </div>
              </div>
            </div>
            <button
              onClick={handleBuyFreeze}
              className="bg-slate-900 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg active:scale-95"
            >
              200 XP
            </button>
          </div>

          {/* Locked Premium Item Placeholder */}
          <div className="bg-slate-100/50 rounded-[2.5rem] p-8 border border-dashed border-slate-200 flex items-center justify-between grayscale opacity-60">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-3xl bg-slate-200 flex items-center justify-center text-4xl">
                💎
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-400 leading-tight">
                  Double XP Boost
                </h3>
                <p className="text-slate-400 text-sm mt-1">
                  Coming soon to the store!
                </p>
              </div>
            </div>
            <div className="bg-slate-200 text-slate-400 px-6 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest">
              Locked
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200">
          <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">
            Purchase History
          </h2>
          <div className="space-y-3">
            {history.length > 0 ? (
              history.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 bg-slate-100 rounded-2xl"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">📦</span>
                    <span className="text-xs font-bold text-slate-700">
                      {item.event_type}
                    </span>
                  </div>
                  <span className="text-xs font-black text-red-500">
                    {item.xp_delta} XP
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs italic text-slate-400">
                No transactions yet.
              </p>
            )}
          </div>
        </div>

        <button
          onClick={() => navigate(-1)}
          className="w-full mt-10 text-slate-400 text-xs font-bold uppercase tracking-widest hover:text-slate-600 transition-colors"
        >
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
}
