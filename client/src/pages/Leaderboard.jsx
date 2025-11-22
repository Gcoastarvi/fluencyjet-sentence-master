// client/src/pages/Leaderboard.jsx
import { useEffect, useState, useRef } from "react";
import { apiFetchWithAuth } from "../utils/fetch";

// Format XP nicely => 1.2K, 2.4M
function kFormat(n) {
  if (!n) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function periodLabel(p) {
  if (p === "weekly") return "this week";
  if (p === "monthly") return "this month";
  if (p === "all") return "all time";
  return p;
}

const PERIODS = [
  { id: "weekly", label: "This Week" },
  { id: "monthly", label: "This Month" },
  { id: "all", label: "All Time" },
];

export default function Leaderboard() {
  const [period, setPeriod] = useState("weekly");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({
    top: [],
    you: null,
    period: "weekly",
  });
  const [lastUpdated, setLastUpdated] = useState(null);

  // For rank bump animation
  const prevRankRef = useRef(null);
  const [rankBump, setRankBump] = useState(false);

  // Animate top students highlight index (0..4)
  const [highlightIndex, setHighlightIndex] = useState(0);

  // Load leaderboard from API
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      try {
        const res = await apiFetchWithAuth(`/api/leaderboard/${period}`, {
          method: "GET",
        });

        // If 401, apiFetchWithAuth will already handle logout + redirect
        if (!res) {
          setLoading(false);
          return;
        }

        setData({
          top: res.top || [],
          you: res.you || null,
          period: res.period || period,
        });
        setLastUpdated(new Date());
      } catch (err) {
        console.error("Failed to load leaderboard", err);
        setError(err.message || "Failed to load leaderboard.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [period]);

  // Rank bump detection (if your rank improves)
  useEffect(() => {
    if (!data.you || typeof data.you.rank !== "number") {
      prevRankRef.current = null;
      return;
    }

    if (prevRankRef.current && data.you.rank < prevRankRef.current) {
      // Rank improved (smaller number = better)
      setRankBump(true);
      setTimeout(() => setRankBump(false), 1000);
    }
    prevRankRef.current = data.you.rank;
  }, [data.you]);

  // Top students highlight animation
  useEffect(() => {
    if (!data.top || data.top.length === 0) return;
    const max = Math.min(5, data.top.length);

    setHighlightIndex(0);
    const id = setInterval(() => {
      setHighlightIndex((prev) => (prev + 1) % max);
    }, 3200);

    return () => clearInterval(id);
  }, [data.top]);

  const you = data.you;
  const top = data.top || [];
  const topHighlight = top.slice(0, 5);

  const lastUpdatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leaderboard</h1>
          <p className="text-sm text-gray-500">
            Compete with other learners and climb the ranks{" "}
            {periodLabel(period)}.
          </p>
        </div>

        {/* Period tabs */}
        <div className="inline-flex items-center gap-1 rounded-full bg-gray-100 p-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 text-xs sm:text-sm rounded-full transition ${
                period === p.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-white"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Main layout: left profile + right top students */}
      <section className="grid gap-4 md:grid-cols-2">
        {/* Profile box */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 font-semibold text-lg">
              {you?.name ? you.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-900">
                  {you?.name || "You"}
                </h2>
                {rankBump && (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 animate-bounce">
                    Rank up!
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Your position {periodLabel(period)}.
              </p>
            </div>
            {lastUpdatedLabel && (
              <div className="text-right text-[11px] text-gray-400">
                Updated
                <br />
                {lastUpdatedLabel}
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-gray-50 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">
                Rank
              </p>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                {you?.rank ? `#${you.rank}` : "—"}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">
                XP {period === "all" ? "(Total)" : "(Period)"}
              </p>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                {kFormat(you?.xp || 0)}
              </p>
            </div>
          </div>

          {/* Simple XP bar */}
          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">
              Progress vs Top
            </p>
            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
              {top.length > 0 ? (
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      (100 * (you?.xp || 0)) / (top[0]?.xp || 1),
                    )}%`,
                  }}
                />
              ) : (
                <div className="h-full w-1/4 rounded-full bg-indigo-200" />
              )}
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              Compare your XP with the current #1 player.
            </p>
          </div>
        </div>

        {/* Top students highlight / carousel-ish */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-900">
              Top Students
            </h2>
            <span className="text-[11px] text-gray-400">
              {topHighlight.length} featured
            </span>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : topHighlight.length === 0 ? (
            <p className="text-sm text-gray-500">
              No leaderboard data yet — be the first to play! 🚀
            </p>
          ) : (
            <div className="space-y-3">
              {topHighlight.map((player, idx) => {
                const isActive = idx === highlightIndex;
                const medal =
                  player.rank === 1
                    ? "🥇"
                    : player.rank === 2
                      ? "🥈"
                      : player.rank === 3
                        ? "🥉"
                        : "⭐";

                return (
                  <div
                    key={player.rank}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition-all ${
                      isActive
                        ? "border-indigo-300 bg-indigo-50 shadow-sm"
                        : "border-gray-100 bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{medal}</span>
                      <div>
                        <p className="font-medium text-gray-900">
                          {player.name}
                          {player.isYou && (
                            <span className="ml-1 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                              YOU
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          Rank #{player.rank}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">XP</p>
                      <p className="text-base font-semibold text-gray-900">
                        {kFormat(player.xp)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Full leaderboard table/list */}
      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">
            Full Ranking {periodLabel(period)}
          </h2>
          {lastUpdatedLabel && (
            <span className="text-[11px] text-gray-400">
              Updated at {lastUpdatedLabel}
            </span>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Loading leaderboard…</p>
        ) : top.length === 0 ? (
          <p className="text-sm text-gray-500">
            No entries yet — play a quiz to appear on the leaderboard!
          </p>
        ) : (
          <ol className="divide-y divide-gray-100">
            {top.map((player) => {
              const isYou = player.isYou || (you && you.rank === player.rank);

              return (
                <li
                  key={player.rank}
                  className={`flex items-center justify-between px-2 py-2 text-sm ${
                    isYou
                      ? "bg-indigo-50/70 font-medium text-indigo-900"
                      : "text-gray-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                        player.rank === 1
                          ? "bg-yellow-100 text-yellow-800"
                          : player.rank === 2
                            ? "bg-gray-200 text-gray-800"
                            : player.rank === 3
                              ? "bg-amber-200 text-amber-800"
                              : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {player.rank}
                    </div>
                    <div>
                      <p>
                        {player.name}
                        {isYou && (
                          <span className="ml-1 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                            YOU
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {player.rank === 1
                          ? "Top of the board"
                          : `Chasing rank #${player.rank - 1}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">
                      XP
                    </p>
                    <p className="text-base font-semibold">
                      {kFormat(player.xp)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
