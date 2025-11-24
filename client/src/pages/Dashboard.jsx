// client/src/pages/Leaderboard.jsx
import React, { useEffect, useState, useMemo } from "react";
import { apiFetchWithAuth } from "@/utils/fetch";
import { getDisplayName } from "../utils/displayName";

// Format numbers: 1.2K, 2.4M
function kFormat(n) {
  if (!n) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function periodTextLabel(p) {
  if (p === "daily") return "today";
  if (p === "weekly") return "this week";
  if (p === "monthly") return "this month";
  return "overall";
}

export default function LeaderboardPage() {
  const [period, setPeriod] = useState("weekly");
  const [filter, setFilter] = useState("all");
  const [leaders, setLeaders] = useState([]);
  const [you, setYou] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);

  // -------------------------------------
  // 🔵 Fetch leaderboard (uses /api/leaderboard/:period)
  // -------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const data = await apiFetchWithAuth(`/api/leaderboard/${period}`, {
          method: "GET",
        });

        if (cancelled) return;

        if (!data || data.ok === false) {
          setError(data?.message || "Failed to load leaderboard");
          setLeaders([]);
          setYou(null);
          return;
        }

        setLeaders(Array.isArray(data.leaders) ? data.leaders : []);
        setYou(data.you || null);
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Failed to load leaderboard");
        setLeaders([]);
        setYou(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [period]);

  // -------------------------------------
  // 🔵 Auto-scroll highlight top performers
  // -------------------------------------
  useEffect(() => {
    if (!leaders.length) return;
    const id = setInterval(() => {
      setHighlightIndex((i) => (i + 1) % Math.min(leaders.length, 5));
    }, 4000);
    return () => clearInterval(id);
  }, [leaders]);

  // -------------------------------------
  // 🔵 Filters (all / same level / Tamil region)
  // -------------------------------------
  const filteredLeaders = useMemo(() => {
    if (!leaders.length) return [];
    let rows = leaders;

    if (filter === "sameLevel" && you) {
      const myLevel = you.level ?? you.levelName;
      if (myLevel != null) {
        rows = rows.filter((r) => (r.level ?? r.levelName) === myLevel);
      }
    }

    if (filter === "tamil") {
      rows = rows.filter((r) => {
        const region = (r.region || r.language || "").toLowerCase();
        return region.includes("tamil");
      });
    }

    return rows;
  }, [leaders, filter, you]);

  const topSlice = leaders.slice(0, 5);
  const currentHighlight =
    topSlice[highlightIndex % Math.max(1, topSlice.length)];

  const maxXp = leaders.length ? leaders[0].xp || 1 : 1;
  const pLabel = periodTextLabel(period);

  // ======================================================================
  // RENDER
  // ======================================================================
  return (
    <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* ------------------------------------------------------ */}
      {/* Header */}
      {/* ------------------------------------------------------ */}
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            FluencyJet Leaderboard
          </h1>
          <p className="text-slate-500 mt-1">
            See how you stack up against other learners {pLabel}.
          </p>
        </div>

        {/* Period Tabs */}
        <div className="inline-flex bg-slate-100 p-1 rounded-full text-sm">
          {[
            { id: "daily", label: "Today" },
            { id: "weekly", label: "This Week" },
            { id: "monthly", label: "This Month" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setPeriod(t.id)}
              className={`px-4 py-1 rounded-full font-medium transition ${
                period === t.id
                  ? "bg-white shadow text-indigo-600"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* ------------------------------------------------------ */}
      {/* Filter bar */}
      {/* ------------------------------------------------------ */}
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="text-slate-500 mr-1">Filters:</span>

        {[
          { id: "all", label: "All learners" },
          { id: "sameLevel", label: "Same level as you" },
          { id: "tamil", label: "Tamil region only" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1 rounded-full border transition ${
              filter === f.id
                ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                : "bg-white border-slate-200 text-slate-600 hover:border-indigo-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------ */}
      {/* Error banner */}
      {/* ------------------------------------------------------ */}
      {error && (
        <div className="border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* ------------------------------------------------------ */}
      {/* Profile Box + Highlight */}
      {/* ------------------------------------------------------ */}
      <section className="grid md:grid-cols-3 gap-4">
        {/* YOUR BOX */}
        <div className="md:col-span-2">
          {you ? (
            <div className="rounded-2xl border border-slate-100 bg-gradient-to-r from-indigo-50 to-sky-50 px-6 py-5 shadow-sm">
              <div className="flex justify-between">
                <div>
                  <div className="uppercase text-xs text-slate-500">
                    Your position
                  </div>
                  <div className="flex items-baseline gap-2">
                    <div className="text-3xl font-black text-indigo-600">
                      #{you.rank ?? "–"}
                    </div>
                    <div className="text-slate-500 text-sm">
                      {getDisplayName(you) || you.email}
                    </div>
                  </div>

                  <div className="mt-2 text-slate-600 flex gap-3 text-sm">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 bg-emerald-400 rounded-full" />
                      {kFormat(you.xp ?? 0)} XP {pLabel}
                    </span>

                    {you.level && (
                      <span className="px-2 py-0.5 text-xs bg-slate-900 text-white rounded-full">
                        Level {you.level}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="px-3 py-1 bg-white/80 rounded-full text-[11px] shadow flex items-center">
                    🔥 {kFormat(you.streak ?? 0)} days
                  </div>

                  <div className="px-3 py-1 bg-indigo-600 text-white rounded-full text-[11px] shadow">
                    🏅 {you.badgeName || "Bronze"}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-slate-500">
              Log in and complete a quiz to appear on the leaderboard.
            </div>
          )}
        </div>

        {/* TOP PERFORMERS auto-rotating */}
        <div className="rounded-2xl border border-slate-100 bg-white px-5 py-5 shadow-sm">
          <div className="flex justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-800">
              Top performers {pLabel}
            </h2>
            <span className="text-[11px] uppercase text-slate-400">
              Auto-rotating
            </span>
          </div>

          {currentHighlight ? (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gradient-to-tr from-amber-400 to-orange-500 rounded-full flex justify-center items-center text-xl text-white shadow">
                {currentHighlight.rank <= 3 ? "🏆" : "⭐"}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {getDisplayName(currentHighlight) ||
                    currentHighlight.name ||
                    currentHighlight.email}
                </div>
                <div className="text-xs text-slate-500">
                  #{currentHighlight.rank} • {kFormat(currentHighlight.xp || 0)}{" "}
                  XP
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">No XP earned yet.</p>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------ */}
      {/* Full Leaderboard Grid */}
      {/* ------------------------------------------------------ */}
      <section className="rounded-2xl border border-slate-100 bg-white px-6 py-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">
          Leaderboard grid
        </h2>

        <p className="text-slate-500 text-sm mb-3">
          Showing {filteredLeaders.length ? filteredLeaders.length : "no"}{" "}
          learners ({pLabel} ·{" "}
          {filter === "all"
            ? "all learners"
            : filter === "sameLevel"
              ? "same level"
              : "Tamil region"}
          )
        </p>

        {loading && <p className="text-slate-500">Loading leaderboard…</p>}

        {!loading && filteredLeaders.length === 0 && (
          <p className="text-slate-500">
            No entries found. Try switching filters or period.
          </p>
        )}

        {!loading && filteredLeaders.length > 0 && (
          <ul className="space-y-3 mt-4">
            {filteredLeaders.map((r, i) => {
              const rank = r.rank ?? i + 1;
              const isYou = you && r.user_id === you.user_id;
              const xp = r.xp ?? 0;

              const barWidth = Math.max(8, Math.round((xp / maxXp) * 100));

              let medal = null;
              if (rank === 1) medal = "🥇";
              else if (rank === 2) medal = "🥈";
              else if (rank === 3) medal = "🥉";

              return (
                <li
                  key={r.user_id}
                  className={`rounded-xl border px-4 py-3 shadow-sm transition ${
                    isYou
                      ? "bg-indigo-50 border-indigo-200"
                      : "bg-slate-50 border-slate-100 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-full shadow flex items-center justify-center text-lg">
                      {medal || `#${rank}`}
                    </div>

                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold">
                            {getDisplayName(r) || r.name || r.email}
                          </p>
                          <p className="text-xs text-slate-500">{r.email}</p>
                        </div>

                        <div className="text-right">
                          <p className="text-xs uppercase text-slate-400">XP</p>
                          <p className="font-bold">{kFormat(xp)}</p>
                        </div>
                      </div>

                      <div className="h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                        <div
                          className="h-1.5 bg-gradient-to-r from-indigo-400 to-emerald-400 transition-all duration-700"
                          style={{ width: `${barWidth}%` }}
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
}
