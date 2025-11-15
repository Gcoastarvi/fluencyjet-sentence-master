// client/src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

function kFormat(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n ?? 0);
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadDashboard() {
    setLoading(true);
    setErr("");

    const token = localStorage.getItem("fj_token");
    if (!token) {
      setErr("Please log in to view your dashboard.");
      setData(null);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/dashboard/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let json = {};
      try {
        json = await res.json();
      } catch {
        throw new Error("Invalid response from server (not JSON).");
      }

      if (res.status === 401) {
        localStorage.removeItem("fj_token");
        throw new Error("Session expired. Please log in again.");
      }
      if (!res.ok) {
        throw new Error(json?.message || "Failed to load dashboard");
      }

      setData(json);
    } catch (e) {
      console.error("Dashboard load error:", e);
      setErr(e.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const stats = data?.stats;
  const rank = data?.rank;
  const badges = data?.badges;

  let levelPercent = 0;
  if (stats) {
    const denom = stats.levelSize || stats.xpIntoLevel + stats.xpToNextLevel;
    levelPercent = denom ? Math.round((stats.xpIntoLevel / denom) * 100) : 0;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold text-center text-indigo-700 mb-2">
        Your Dashboard
      </h1>

      <div className="flex justify-center">
        <button
          onClick={loadDashboard}
          disabled={loading}
          className="px-4 py-1 rounded-full bg-violet-600 text-white text-sm font-semibold disabled:opacity-60"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {err && (
        <p className="text-center text-red-500 font-medium text-sm">{err}</p>
      )}

      {!err && stats && (
        <>
          {/* XP Overview */}
          <section className="bg-white rounded-3xl shadow-md p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-2 text-gray-800">
              XP Overview
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <CardStat label="Total XP" value={kFormat(stats.totalXP)} />
              <CardStat
                label="Weekly XP"
                value={kFormat(stats.weekXP)}
                sub={
                  stats.weekVsLastWeek > 0
                    ? `▲ +${kFormat(stats.weekVsLastWeek)} vs last week`
                    : stats.weekVsLastWeek < 0
                      ? `▼ ${kFormat(stats.weekVsLastWeek)} vs last week`
                      : "Same as last week"
                }
              />
              <CardStat
                label="Monthly XP"
                value={kFormat(stats.monthXP)}
                sub={
                  stats.prevMonthXP
                    ? `Last month: ${kFormat(stats.prevMonthXP)}`
                    : ""
                }
              />
              <CardStat
                label="Streak"
                value={`${stats.streak || 0} 🔥`}
                sub="consecutive active days"
              />
            </div>

            {/* Level bar */}
            <div className="mt-4 space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Level {stats.level}</span>
                <span>
                  {kFormat(stats.xpIntoLevel)} /{" "}
                  {kFormat(
                    stats.levelSize || stats.xpIntoLevel + stats.xpToNextLevel,
                  )}{" "}
                  XP this level
                </span>
              </div>
              <div className="w-full bg-indigo-100 rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 transition-all duration-500"
                  style={{ width: `${Math.min(100, levelPercent)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {kFormat(stats.xpToNextLevel)} XP to reach level{" "}
                {stats.level + 1}.
              </p>
            </div>
          </section>

          {/* Today vs Yesterday + Rank */}
          <section className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-3xl shadow-md p-5 space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">
                Today vs Yesterday
              </h3>
              <div className="flex items-baseline gap-4">
                <div>
                  <div className="text-xs text-gray-500">Today</div>
                  <div className="text-2xl font-bold text-indigo-700">
                    {kFormat(stats.todayXP)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Yesterday</div>
                  <div className="text-xl font-semibold text-gray-700">
                    {kFormat(stats.yesterdayXP)}
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {stats.todayVsYesterday > 0
                  ? `Great! You earned ${kFormat(stats.todayVsYesterday)} more XP than yesterday.`
                  : stats.todayVsYesterday < 0
                    ? `You earned ${kFormat(
                        -stats.todayVsYesterday,
                      )} less XP than yesterday.`
                    : "Same XP as yesterday—keep the streak going!"}
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-md p-5 space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">
                Weekly Rank
              </h3>
              <div className="flex items-baseline gap-4">
                <div>
                  <div className="text-xs text-gray-500">Rank this week</div>
                  <div className="text-2xl font-bold text-indigo-700">
                    {rank?.weeklyRank != null ? `#${rank.weeklyRank}` : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Weekly XP</div>
                  <div className="text-xl font-semibold text-gray-700">
                    {kFormat(rank?.weeklyXP || 0)}
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Play more quizzes to climb the leaderboard faster.
              </p>
            </div>
          </section>

          {/* Badges + Next Badge */}
          <section className="bg-white rounded-3xl shadow-md p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">
              Your Badges
            </h3>

            {badges?.owned?.length ? (
              <div className="flex flex-wrap gap-2 text-xs">
                {badges.owned.map((b) => (
                  <span
                    key={b.code}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100"
                  >
                    🏅 <span className="font-semibold">{b.label}</span>
                    <span className="text-[10px] text-amber-500">
                      {kFormat(b.min_xp)} XP
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                No badges yet — your first one is coming soon!
              </p>
            )}

            {badges?.nextBadge && (
              <div className="mt-3 text-xs bg-indigo-50 border border-indigo-100 rounded-2xl px-3 py-2 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-indigo-700">
                    Next badge: {badges.nextBadge.label}
                  </div>
                  <div className="text-[11px] text-indigo-500">
                    Unlock at {kFormat(badges.nextBadge.min_xp)} XP
                  </div>
                </div>
                <div className="text-[11px] text-indigo-500">
                  You need{" "}
                  <span className="font-semibold">
                    {kFormat(
                      Math.max(0, badges.nextBadge.min_xp - stats.totalXP),
                    )}
                  </span>{" "}
                  more XP
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function CardStat({ label, value, sub }) {
  return (
    <div className="bg-indigo-50 rounded-2xl px-4 py-3 flex flex-col justify-center">
      <div className="text-xs font-medium text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-indigo-700">{value}</div>
      {sub && <div className="text-[11px] text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}
