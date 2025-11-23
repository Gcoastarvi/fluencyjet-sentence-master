import React, { useEffect, useState } from "react";
import { apiFetchWithAuth } from "../utils/fetch";

export default function Leaderboard() {
  const [period, setPeriod] = useState("weekly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [you, setYou] = useState(null);
  const [top, setTop] = useState([]);

  // Hero carousel state
  const [heroIndex, setHeroIndex] = useState(0);

  // Map UI buttons → backend query values
  const PERIOD_MAP = {
    today: "today",
    weekly: "weekly",
    monthly: "monthly",
    all: "all",
  };

  const PERIOD_LABEL = {
    today: "today",
    weekly: "this week",
    monthly: "this month",
    all: "all time",
  };

  async function loadLeaderboard() {
    setLoading(true);
    setError("");

    try {
      const p = PERIOD_MAP[period] ?? "weekly";

      const data = await apiFetchWithAuth(`/api/leaderboard?period=${p}`, {
        method: "GET",
      });

      if (!data || !data.ok) {
        setError(data?.message || "Failed to load leaderboard");
        setLoading(false);
        return;
      }

      setRows(data.rows || []);
      setYou(data.you || null);
      setTop(data.top || []);
      setHeroIndex(0); // reset hero to first slide when data changes
      setError("");
    } catch (e) {
      console.error("Leaderboard fetch error:", e);
      setError(e?.message || "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }

  // Load whenever period changes
  useEffect(() => {
    loadLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  // Auto-rotate hero carousel
  useEffect(() => {
    if (!top || top.length <= 1) return;

    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % top.length);
    }, 4500); // 4.5s per slide

    return () => clearInterval(interval);
  }, [top]);

  const currentHero = top[heroIndex] || null;
  const nicePeriodLabel = PERIOD_LABEL[period] || "this period";

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">
            FluencyJet Leaderboard
          </h1>
          <p className="text-gray-600 mt-1">
            See how you stack up against other learners {nicePeriodLabel}.
          </p>
        </div>

        {/* Period Switcher */}
        <div className="inline-flex bg-gray-100 p-1 rounded-full">
          {["today", "weekly", "monthly", "all"].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                period === p
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-700 hover:bg-white"
              }`}
            >
              {p === "all"
                ? "All Time"
                : p === "weekly"
                  ? "This Week"
                  : p === "today"
                    ? "Today"
                    : "This Month"}
            </button>
          ))}
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="mt-6 bg-red-100 text-red-700 p-4 rounded-lg font-medium">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="mt-8 text-gray-600 text-lg font-medium">
          Loading leaderboard…
        </div>
      )}

      {/* CONTENT */}
      {!loading && !error && (
        <>
          {/* 🔥 Animated Top Performers Hero */}
          <section className="mt-10">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-500 text-white shadow-lg">
              <div className="px-6 py-7 md:px-10 md:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="max-w-xl">
                  <p className="text-xs uppercase tracking-[0.18em] opacity-80 mb-1">
                    Top performers · {nicePeriodLabel}
                  </p>
                  <h2 className="text-2xl md:text-3xl font-extrabold mb-2">
                    {currentHero
                      ? `${currentHero.name} is leading the board!`
                      : "Top performers will appear here soon."}
                  </h2>
                  <p className="text-sm md:text-base text-indigo-100">
                    {currentHero
                      ? `Rank #${currentHero.rank} · ${currentHero.xp} XP ${
                          period === "weekly"
                            ? "earned this week."
                            : period === "today"
                              ? "earned today."
                              : period === "monthly"
                                ? "earned this month."
                                : "earned in total."
                        }`
                      : "Once learners start earning XP, we’ll spotlight the strongest performers here."}
                  </p>
                </div>

                {/* Hero Stat Card */}
                <div className="w-full md:w-64">
                  <div className="relative bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-5 py-4">
                    {currentHero ? (
                      <>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
                            #{currentHero.rank}
                          </div>
                          <div>
                            <div className="text-sm uppercase tracking-wide opacity-80">
                              Spotlight
                            </div>
                            <div className="text-lg font-semibold">
                              {currentHero.name}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="opacity-80">XP this period</span>
                            <span className="font-semibold">
                              {currentHero.xp} XP
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="opacity-80">Level</span>
                            <span className="font-semibold">
                              {currentHero.level ?? 1}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-indigo-50">
                        No top performer yet for {nicePeriodLabel}. Be the first
                        to climb the leaderboard!
                      </div>
                    )}
                  </div>

                  {/* Carousel dots */}
                  {top.length > 1 && (
                    <div className="flex items-center justify-center gap-1.5 mt-3">
                      {top.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setHeroIndex(idx)}
                          className={`h-1.5 rounded-full transition-all ${
                            heroIndex === idx
                              ? "w-5 bg-white"
                              : "w-2 bg-white/50 hover:bg-white/70"
                          }`}
                          aria-label={`Show top performer ${idx + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Top Learners list */}
          <section className="mt-10 bg-white p-6 rounded-2xl shadow-sm border">
            <h2 className="text-xl font-bold text-gray-900">Top Learners</h2>
            <p className="text-gray-500 mt-1">
              The most active learners {nicePeriodLabel}.
            </p>

            {rows.length === 0 ? (
              <p className="mt-4 text-gray-600">
                No XP data yet. Complete your first quiz to appear on the
                leaderboard!
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {rows.map((r) => (
                  <li
                    key={r.userId}
                    className="flex justify-between items-center bg-gray-50 p-3 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-indigo-600">
                        #{r.rank}
                      </span>
                      <span className="font-medium text-gray-900">
                        {r.name}
                      </span>
                    </div>
                    <span className="text-gray-700 font-semibold">
                      {r.xp} XP
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Your Position */}
          <section className="mt-10 bg-white p-6 rounded-2xl shadow-sm border">
            <h2 className="text-xl font-bold text-gray-900">Your Position</h2>
            <p className="text-gray-500 mt-1">
              Track how you're progressing on the leaderboard.
            </p>

            {!you ? (
              <p className="mt-4 text-gray-600">
                You're not ranked yet for this period. Complete a quiz to join
                the leaderboard!
              </p>
            ) : (
              <div className="mt-4 bg-indigo-50 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-indigo-600 font-bold">
                    #{you.rank ?? "?"}
                  </span>
                  <span className="font-medium">{you.name}</span>
                </div>
                <span className="text-indigo-700 font-semibold">
                  {you.xp} XP{" "}
                  {period === "weekly"
                    ? "this week"
                    : period === "today"
                      ? "today"
                      : period === "monthly"
                        ? "this month"
                        : "total"}
                </span>
              </div>
            )}
          </section>

          {/* Compact Top Performers grid (supports hero) */}
          <section className="mt-10 mb-12 bg-white p-6 rounded-2xl shadow-sm border">
            <h2 className="text-xl font-bold text-gray-900">Top Performers</h2>
            <p className="text-gray-500 mt-1">
              Spotlight on the strongest performers {nicePeriodLabel}.
            </p>

            {top.length === 0 ? (
              <p className="mt-4 text-gray-600">
                Top performers will appear here once learners earn XP.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                {top.map((t) => (
                  <div
                    key={t.userId}
                    className={`p-4 rounded-xl shadow-sm border ${
                      currentHero && currentHero.userId === t.userId
                        ? "bg-indigo-50 border-indigo-200"
                        : "bg-gray-50 border-gray-100"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-700">
                        #{t.rank}
                      </span>
                      <span className="font-semibold text-gray-800">
                        {t.xp} XP
                      </span>
                    </div>
                    <p className="mt-2 text-gray-800 font-medium">{t.name}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
