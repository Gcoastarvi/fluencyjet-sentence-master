// client/src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { apiRequest } from "@/hooks/useApi.js";
import { Link } from "react-router-dom";
import "./dashboard-animations.css";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [prevXP, setPrevXP] = useState(0); // for pulse animation
  const [rankUp, setRankUp] = useState(false);

  async function loadSummary() {
    setLoading(true);
    try {
      const data = await apiRequest("/api/dashboard/summary");
      if (!data?.ok) throw new Error(data.message);

      // detect XP increase
      if (summary && data.stats.totalXP > summary.stats.totalXP) {
        setPrevXP(summary.stats.totalXP);
        triggerXPPulse();
      }

      // detect rank up
      if (
        summary &&
        data.rank.weeklyRank &&
        summary.rank.weeklyRank &&
        data.rank.weeklyRank < summary.rank.weeklyRank
      ) {
        triggerRankUpFlash();
      }

      setSummary(data);
    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  }

  function triggerXPPulse() {
    const el = document.querySelector("#xp-card");
    if (!el) return;
    el.classList.add("xp-pulse");
    setTimeout(() => el.classList.remove("xp-pulse"), 900);
  }

  function triggerRankUpFlash() {
    setRankUp(true);
    setTimeout(() => setRankUp(false), 1500);
  }

  useEffect(() => {
    loadSummary();
  }, []);

  if (loading) {
    return (
      <div className="text-center mt-10 text-indigo-500 text-lg">
        Loading dashboard…
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-red-500 text-center mt-10">
        Failed to load dashboard.
      </div>
    );
  }

  const { stats, rank, badges } = summary;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* ✨ Rank Up Animation Overlay */}
      {rankUp && (
        <div className="rank-up-overlay">
          <div className="rank-up-flash">⬆ Rank Up!</div>
        </div>
      )}

      <h1 className="text-3xl font-bold text-indigo-700">Dashboard</h1>

      {/* XP Card */}
      <div
        id="xp-card"
        className="p-5 bg-white rounded-xl shadow flex justify-between items-center"
      >
        <div>
          <h2 className="text-lg font-semibold text-gray-700">Total XP</h2>
          <p className="text-3xl font-bold text-indigo-600">
            {stats.totalXP.toLocaleString()} XP
          </p>
        </div>
        <div className="text-indigo-500 text-5xl">⚡</div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <DashboardCard title="Today" value={stats.todayXP + " XP"} emoji="🔥" />
        <DashboardCard
          title="Yesterday"
          value={stats.yesterdayXP + " XP"}
          emoji="🕒"
        />
        <DashboardCard
          title="This Week"
          value={stats.weekXP + " XP"}
          emoji="📅"
        />
        <DashboardCard
          title="Last Week"
          value={stats.prevWeekXP + " XP"}
          emoji="↩️"
        />
        <DashboardCard
          title="This Month"
          value={stats.monthXP + " XP"}
          emoji="📆"
        />
        <DashboardCard
          title="Streak"
          value={stats.streak + " days"}
          emoji="🔥"
        />
      </div>

      {/* Rank Card */}
      <div className="p-5 bg-white rounded-xl shadow">
        <h2 className="text-lg font-semibold text-gray-700">Weekly Rank</h2>
        {rank.weeklyRank ? (
          <p className="text-2xl font-bold text-indigo-600">
            #{rank.weeklyRank}
          </p>
        ) : (
          <p className="text-gray-500 text-sm">No rank yet</p>
        )}
      </div>

      {/* Next Badge */}
      {badges?.nextBadge && (
        <div className="p-5 bg-yellow-50 rounded-xl border border-yellow-200 shadow">
          <h3 className="text-lg font-semibold text-yellow-800">Next Badge</h3>
          <p className="text-yellow-700 font-bold mt-1">
            {badges.nextBadge.label}
          </p>
          <p className="text-yellow-600 text-sm">
            Earn {badges.nextBadge.min_xp - stats.totalXP} more XP to unlock.
          </p>
        </div>
      )}

      {/* CTA */}
      <div className="flex justify-center mt-6">
        <Link
          to="/lessons"
          className="bg-indigo-600 text-white px-5 py-3 rounded-xl shadow hover:bg-indigo-700 hover:scale-105 transition"
        >
          Continue Learning →
        </Link>
      </div>
    </div>
  );
}

function DashboardCard({ title, value, emoji }) {
  return (
    <div className="p-4 bg-white shadow rounded-xl text-center">
      <div className="text-2xl">{emoji}</div>
      <h3 className="font-semibold text-gray-700">{title}</h3>
      <p className="text-indigo-600 font-bold">{value}</p>
    </div>
  );
}
