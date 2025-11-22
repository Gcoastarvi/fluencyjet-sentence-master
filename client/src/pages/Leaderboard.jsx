// client/src/pages/Leaderboard.jsx
import React, { useEffect, useState, useMemo } from "react";
import { API_BASE } from "@/lib/api";
import { getDisplayName } from "../utils/displayName";

function kFormat(n) {
  if (n == null) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function periodLabel(p) {
  if (p === "daily") return "today";
  if (p === "weekly") return "this week";
  if (p === "monthly") return "this month";
  return "overall";
}

const LeaderboardPage = () => {
  const [period, setPeriod] = useState("weekly");
  const [filter, setFilter] = useState("all");
  const [leaders, setLeaders] = useState([]);
  const [you, setYou] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);

  // Fetch leaderboard from API
  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("You are not logged in. Please log in again.");
        setLeaders([]);
        setYou(null);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API_BASE}/leaderboard?period=${period}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (res.status === 401) {
          // Session expired – clear token and show message
          localStorage.removeItem("token");
          setLeaders([]);
          setYou(null);
          setError("Session expired, please log in again.");
          return;
        }

        if (!res.ok) {
          let msg = "Failed to load leaderboard";
          try {
            const data = await res.json();
            if (data && data.message) msg = data.message;
          } catch (_) {
            // ignore JSON parse errors
          }
          throw new Error(msg);
        }

        const data = await res.json();
        setLeaders(Array.isArray(data.leaders) ? data.leaders : []);
        setYou(data.you || null);
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("/api/leaderboard error:", err);
        setError(err.message || "Failed to load leaderboard");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();
  }, [period]);

  // Auto-rotate top performers (simple “TikTok style” highlight)
  useEffect(() => {
    if (!leaders.length) return;

    const intervalId = setInterval(() => {
      setHighlightIndex((prev) => {
        const limit = Math.min(leaders.length, 5);
        if (!limit) return 0;
        return (prev + 1) % limit;
      });
    }, 4000);

    return () => clearInterval(intervalId);
  }, [leaders]);

  // Filtered rows for grid
  const filteredLeaders = useMemo(() => {
    if (!leaders.length) return [];

    let rows = leaders;

    if (filter === "sameLevel" && you && (you.level || you.levelName)) {
      const yourLevel = you.level ?? you.levelName;
      rows = leaders.filter((r) => (r.level ?? r.levelName) === yourLevel);
    } else if (filter === "tamil") {
      rows = leaders.filter((r) => {
        const region = (r.region || r.track || r.language || "").toLowerCase();
        return region.includes("tamil");
      });
    }

    return rows;
  }, [leaders, filter, you]);

  const maxXp = leaders.length
    ? leaders[0].total_xp || leaders[0].totalXP || 1
    : 1;

  const topSlice = leaders.slice(0, 5);
  const currentHighlight =
    topSlice.length > 0 ? topSlice[highlightIndex % topSlice.length] : null;

  const periodText = periodLabel(period);

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 md:py-8 space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            FluencyJet Leaderboard
          </h1>
          <p className="text-sm md:text-base text-slate-500 mt-1">
            See how you stack up against other learners {periodText}.
          </p>
        </div>

        {/* Period tabs */}
        <div className="inline-flex items-center bg-slate-100 rounded-full p-1 text-xs md:text-sm">
          {[
            { id: "daily", label: "Today" },
            { id: "weekly", label: "This Week" },
            { id: "monthly", label: "This Month" },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 md:px-4 py-1 rounded-full font-medium transition ${
                period === p.id
                  ? "bg-white shadow-sm text-indigo-600"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {/* Filter bar */}
      <section className="flex flex-wrap gap-2 text-xs md:text-sm">
        <span className="inline-flex items-center text-slate-500 mr-1">
          Filters:
        </span>
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1 rounded-full border text-xs md:text-sm transition ${
            filter === "all"
              ? "bg-indigo-50 border-indigo-300 text-indigo-700"
              : "bg-white border-slate-200 text-slate-600 hover:border-indigo-200"
          }`}
        >
          All learners
        </button>
        <button
          onClick={() => setFilter("sameLevel")}
          className={`px-3 py-1 rounded-full border text-xs md:text-sm transition ${
            filter === "sameLevel"
              ? "bg-indigo-50 border-indigo-300 text-indigo-700"
              : "bg-white border-slate-200 text-slate-600 hover:border-indigo-200"
          }`}
        >
          Same level as you
        </button>
        <button
          onClick={() => setFilter("tamil")}
          className={`px-3 py-1 rounded-full border text-xs md:text-sm transition ${
            filter === "tamil"
              ? "bg-indigo-50 border-indigo-300 text-indigo-700"
              : "bg-white border-slate-200 text-slate-600 hover:border-indigo-200"
          }`}
        >
          Tamil region only
        </button>
      </section>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Profile box + Top performer highlight */}
      <section className="grid md:grid-cols-3 gap-4 md:gap-6">
        {/* Your profile box */}
        <div className="md:col-span-2">
          {you ? (
            <div className="rounded-2xl border border-slate-100 bg-gradient-to-r from-indigo-50 via-sky-50 to-slate-50 px-4 py-4 md:px-6 md:py-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                    Your position
                  </div>
                  <div className="flex items-baseline gap-2">
                    <div className="text-2xl md:text-3xl font-black text-indigo-600">
                      #{you.rank ?? "–"}
                    </div>
                    <div className="text-xs md:text-sm text-slate-500">
                      {getDisplayName(you) || you.email || "You"}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs md:text-sm text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                      <span>
                        {kFormat(you.total_xp ?? you.totalXP ?? you.xp ?? 0)} XP{" "}
                        {periodText}
                      </span>
                    </span>
                    {you.level && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-0.5 text-[11px] font-medium text-white">
                        Level {you.level}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-2">
                  <div className="inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm">
                    <span className="mr-1 text-lg">🔥</span>
                    <span>
                      {kFormat(you.streak ?? you.currentStreak ?? 0)} day streak
                    </span>
                  </div>
                  <div className="inline-flex items-center rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-semibold text-white shadow-md">
                    <span className="mr-1 text-sm">🏅</span>
                    <span>{you.badgeName || "Next badge loading…"}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
              Log in and complete a quiz to appear on the leaderboard.
            </div>
          )}
        </div>

        {/* Animated top performer highlight */}
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4 md:px-5 md:py-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-800">
              Top performers {periodText}
            </h2>
            <span className="text-[11px] uppercase tracking-wide text-slate-400">
              Auto-rotating
            </span>
          </div>

          {currentHighlight ? (
            <div className="mt-1 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 text-white text-xl shadow-md">
                {currentHighlight.rank <= 3 ? "🏆" : "⭐"}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-900">
                  {getDisplayName(currentHighlight) ||
                    currentHighlight.username ||
                    currentHighlight.email ||
                    "Top learner"}
                </div>
                <div className="text-xs text-slate-500">
                  #{currentHighlight.rank} •{" "}
                  {kFormat(
                    currentHighlight.total_xp ?? currentHighlight.totalXP ?? 0,
                  )}{" "}
                  XP
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              When learners start earning XP, your top performers will appear
              here.
            </p>
          )}

          {topSlice.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {topSlice.map((r) => (
                <span
                  key={r.user_id}
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] border ${
                    currentHighlight && currentHighlight.user_id === r.user_id
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                      : "bg-slate-50 border-slate-200 text-slate-500"
                  }`}
                >
                  #{r.rank} {getDisplayName(r) || r.username || "Learner"}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Full leaderboard grid */}
      <section className="rounded-2xl border border-slate-100 bg-white px-4 py-4 md:px-6 md:py-6 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-base md:text-lg font-semibold text-slate-900">
              Leaderboard grid
            </h2>
            <p className="text-xs md:text-sm text-slate-500">
              Showing{" "}
              {filteredLeaders.length
                ? `${filteredLeaders.length} learners`
                : "no learners yet"}{" "}
              ({periodText} ·{" "}
              {filter === "all"
                ? "all learners"
                : filter === "sameLevel"
                  ? "same level"
                  : "Tamil region"}
              )
            </p>
          </div>
        </div>

        {loading && (
          <p className="text-sm text-slate-500">Loading leaderboard…</p>
        )}

        {!loading && !filteredLeaders.length && (
          <p className="text-sm text-slate-500">
            No entries found for this filter yet. Try switching period or
            filters.
          </p>
        )}

        {!loading && filteredLeaders.length > 0 && (
          <ul className="mt-4 space-y-3">
            {filteredLeaders.map((row, index) => {
              const rank = row.rank ?? index + 1;
              const isYou = you && row.user_id && you.user_id === row.user_id;
              const xp = row.total_xp ?? row.totalXP ?? row.period_xp ?? 0;
              const widthPercent = maxXp
                ? Math.max(8, Math.round((xp / maxXp) * 100))
                : 0;

              let medal = null;
              if (rank === 1) medal = "🥇";
              else if (rank === 2) medal = "🥈";
              else if (rank === 3) medal = "🥉";

              return (
                <li
                  key={row.user_id ?? index}
                  className={`relative overflow-hidden rounded-xl border px-3 py-3 md:px-4 md:py-3.5 transition shadow-sm ${
                    isYou
                      ? "border-indigo-200 bg-indigo-50/60"
                      : "border-slate-100 bg-slate-50/60 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm text-sm font-bold text-slate-800">
                      {medal ? (
                        <span className="text-xl">{medal}</span>
                      ) : (
                        <span>#{rank}</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm md:text-base font-semibold text-slate-900">
                              {getDisplayName(row) ||
                                row.username ||
                                row.email ||
                                "Learner"}
                            </p>
                            {isYou && (
                              <span className="inline-flex items-center rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                                YOU
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[11px] md:text-xs text-slate-500">
                            {row.email || "Email hidden"}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-xs uppercase tracking-wide text-slate-400">
                            XP
                          </p>
                          <p className="text-sm md:text-base font-bold text-slate-900">
                            {kFormat(xp)}
                          </p>
                        </div>
                      </div>

                      {/* Animated XP bar */}
                      <div className="mt-2 w-full rounded-full bg-slate-100 h-1.5 overflow-hidden">
                        <div
                          className="h-1.5 rounded-full bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 transition-all duration-700"
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
};

export default LeaderboardPage;
