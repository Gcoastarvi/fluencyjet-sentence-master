// client/src/pages/student/Leaderboard.jsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/api/apiClient";

// Small helper – compact XP formatting like "1.2K"
function kFormat(xp) {
  if (!xp) return "0";
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(1)}M`;
  if (xp >= 1_000) return `${(xp / 1_000).toFixed(1)}K`;
  return String(xp);
}

const PERIOD_TABS = [
  { id: "today", label: "Today" },
  { id: "weekly", label: "This Week" },
  { id: "monthly", label: "This Month" },
  { id: "all", label: "All Time" },
];

export default function Leaderboard() {
  const [period, setPeriod] = useState("weekly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]); // full leaderboard rows
  const [top, setTop] = useState([]); // spotlight learners
  const [you, setYou] = useState(null); // current learner summary
  const [totalLearners, setTotalLearners] = useState(0);

  const loadLeaderboard = useCallback(async (activePeriod) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/leaderboard?period=${activePeriod}`);
      if (!res.ok) throw new Error(res.error || "Failed to load leaderboard");
      const data = res.data;

      setRows(Array.isArray(data.rows) ? data.rows : []);
      setTop(Array.isArray(data.top) ? data.top : []);
      setYou(data.you || null);
      setTotalLearners(
        typeof data.totalLearners === "number"
          ? data.totalLearners
          : Array.isArray(data.rows)
            ? data.rows.length
            : 0,
      );
    } catch (err) {
      console.error("Leaderboard fetch error:", err);
      setError(err.message || "Failed to load leaderboard");
      setRows([]);
      setTop([]);
      setYou(null);
      setTotalLearners(0);
    } finally {
      setLoading(false);
    }
  }, []);

  // 🎯 Cleaned logic block (No nested functions or duplicate exports)
  const [sortBy, setSortBy] = useState("xp");

  useEffect(() => {
    loadLeaderboard(period);
  }, [period]);

  const handleTabClick = (tabId) => {
    if (tabId === period) return;
    setPeriod(tabId);
  };

  const auth = { user: { name: "Learner", league: "BRONZE" } };

  const activePeriodLabel =
    PERIOD_TABS.find((t) => t.id === period)?.label || "This Week";

  const userName = auth?.user?.name || "Learner";
  const league = "BRONZE";

  return (
    <div className="max-w-5xl mx-auto px-4 pb-10">
      {/* Page title + subtitle */}
      <header className="mb-6 pt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {/* 🎖️ Division Header */}
          <div className="text-center mb-10 animate-fade-in">
            <div className="inline-block relative">
              <div className="text-6xl mb-2">
                {league === "BRONZE" && "🥉"}
                {league === "SILVER" && "🥈"}
                {league === "GOLD" && "🥇"}
                {league === "DIAMOND" && "💎"}
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-[0.2em] shadow-xl">
                {league} LEAGUE
              </div>
            </div>
            <p className="text-slate-400 text-[11px] font-bold mt-6 uppercase tracking-widest">
              Top 3 players promote to{" "}
              {league === "BRONZE" ? "SILVER" : "the next tier"} at end of week
            </p>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            FluencyJet Leaderboard
          </h1>
          <p className="mt-1 text-sm sm:text-base text-slate-600">
            See how you stack up against other learners{" "}
            {activePeriodLabel.toLowerCase()}.
          </p>
        </div>

        {/* Period tabs */}
        <div className="inline-flex items-center rounded-full bg-slate-100 p-1 text-sm font-medium">
          {PERIOD_TABS.map((tab) => {
            const isActive = tab.id === period;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                className={[
                  "relative px-4 py-2 rounded-full transition-colors",
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900",
                ].join(" ")}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* 🏆 Leaderboard Sort Toggle */}
      <div className="flex justify-center gap-2 mb-8 bg-slate-100 p-1 rounded-2xl w-fit mx-auto">
        <button
          onClick={() => setSortBy("xp")}
          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            sortBy === "xp"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500"
          }`}
        >
          By XP
        </button>
        <button
          onClick={() => setSortBy("streak")}
          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            sortBy === "streak"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500"
          }`}
        >
          By Streak 🔥
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Hero – Top performers full-width carousel */}
      <HeroTopPerformers
        top={top}
        periodLabel={activePeriodLabel}
        loading={loading}
      />

      {/* Main content grid */}
      <div className="mt-8 grid gap-6 md:grid-cols-2 md:items-start">
        <TopLearnersCard
          loading={loading}
          rows={rows}
          periodLabel={activePeriodLabel}
        />
        <YourPositionCard
          loading={loading}
          you={you}
          periodLabel={activePeriodLabel}
          totalLearners={totalLearners}
        />
      </div>

      {/* Static Top performers grid under the hero */}
      <div className="mt-8">
        <TopPerformersGrid top={top} periodLabel={activePeriodLabel} />
      </div>
    </div>
  );
}

/**
 * Hero section with swipe + drag carousel.
 * - Auto-advances every 5s
 * - Pauses on hover / drag
 * - Supports mouse drag (desktop) and swipe (mobile)
 */
function HeroTopPerformers({ top, periodLabel, loading }) {
  const entries = Array.isArray(top) ? top : [];
  const hasEntries = entries.length > 0;

  const [activeIndex, setActiveIndex] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);
  const dragStartX = useRef(null);

  // Reset index when data changes
  useEffect(() => {
    setActiveIndex(0);
  }, [entries.length]);

  // Auto-rotate when not interacting
  useEffect(() => {
    if (!hasEntries || isInteracting || entries.length <= 1) return;

    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % entries.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [entries.length, hasEntries, isInteracting]);

  const goToIndex = (idx) => {
    if (!hasEntries) return;
    const safe = ((idx % entries.length) + entries.length) % entries.length;
    setActiveIndex(safe);
  };

  const handleDotClick = (idx) => {
    setIsInteracting(false);
    goToIndex(idx);
  };

  const beginDrag = (clientX) => {
    dragStartX.current = clientX;
    setIsInteracting(true);
  };

  const endDrag = (clientX) => {
    if (dragStartX.current == null) {
      setIsInteracting(false);
      return;
    }
    const deltaX = clientX - dragStartX.current;
    const threshold = 40; // px

    if (Math.abs(deltaX) > threshold) {
      if (deltaX < 0) {
        // swipe left → next
        goToIndex(activeIndex + 1);
      } else {
        // swipe right → prev
        goToIndex(activeIndex - 1);
      }
    }

    dragStartX.current = null;
    setIsInteracting(false);
  };

  const handleMouseLeave = () => {
    dragStartX.current = null;
    setIsInteracting(false);
  };

  if (loading && !hasEntries) {
    return (
      <section className="mt-2 rounded-3xl bg-slate-100/80 px-6 py-10 animate-pulse" />
    );
  }

  if (!hasEntries) {
    return (
      <section className="mt-2 rounded-3xl bg-slate-900 text-slate-100 px-6 py-8 sm:px-10 sm:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
          Top performers · {periodLabel.toLowerCase()}
        </p>
        <h2 className="mt-2 text-2xl sm:text-3xl font-bold">
          Be the first to appear on the leaderboard!
        </h2>
        <p className="mt-2 text-sm sm:text-base text-indigo-100/80 max-w-xl">
          Once you start completing quizzes and earning XP, your name will shine
          here as a top performer.
        </p>
      </section>
    );
  }

  const active = entries[activeIndex];

  return (
    <section
      className="mt-2 rounded-3xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-fuchsia-500 text-white px-6 py-8 sm:px-10 sm:py-10 shadow-lg relative overflow-hidden"
      onMouseEnter={() => setIsInteracting(true)}
      onMouseLeave={handleMouseLeave}
      onMouseDown={(e) => beginDrag(e.clientX)}
      onMouseUp={(e) => endDrag(e.clientX)}
      onTouchStart={(e) => {
        if (e.touches && e.touches[0]) {
          beginDrag(e.touches[0].clientX);
        }
      }}
      onTouchEnd={(e) => {
        if (e.changedTouches && e.changedTouches[0]) {
          endDrag(e.changedTouches[0].clientX);
        } else {
          setIsInteracting(false);
        }
      }}
    >
      {/* Dots */}
      <div className="mt-5 flex justify-center gap-2">
        {entries.map((_, idx) => {
          const isActive = idx === activeIndex;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleDotClick(idx)}
              className={
                "h-2 rounded-full transition-all " +
                (isActive ? "w-4 bg-white" : "w-2 bg-white/60 hover:bg-white")
              }
              aria-label={`Show slide ${idx + 1}`}
            />
          );
        })}
      </div>
    </section>
  );
}

function TopLearnersCard({ rows, loading, periodLabel }) {
  return (
    <section className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-100 px-5 py-5 sm:px-6 sm:py-6">
      <h2 className="text-lg font-bold text-slate-900">Top Learners</h2>
      <p className="mt-1 text-sm text-slate-500">
        The most active learners {periodLabel.toLowerCase()}.
      </p>

      {loading && (
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-10 rounded-2xl bg-slate-100 animate-pulse"
            />
          ))}
        </div>
      )}

      {!loading && (!rows || rows.length === 0) && (
        <p className="mt-4 text-sm text-slate-500">
          No XP data yet. Complete your first quiz to appear on the leaderboard!
        </p>
      )}

      {!loading && rows && rows.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100">
          {rows.map((row) => (
            <li
              key={row.userId ?? row.id}
              className="flex items-center justify-between py-3"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">
                  #{row.rank}
                </span>
                <span className="text-sm font-medium text-slate-800">
                  {row.name}
                </span>
              </div>
              <div className="text-xs font-semibold text-slate-500">
                {kFormat(row.xp)} XP
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function YourPositionCard({ you, loading, periodLabel, totalLearners }) {
  return (
    <section className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-100 px-5 py-5 sm:px-6 sm:py-6">
      <h2 className="text-lg font-bold text-slate-900">Your Position</h2>
      <p className="mt-1 text-sm text-slate-500">
        Track how you're progressing on the leaderboard.
      </p>

      {loading && (
        <div className="mt-4 h-16 rounded-2xl bg-slate-100 animate-pulse" />
      )}

      {!loading && !you && (
        <p className="mt-4 text-sm text-slate-500">
          You're not ranked yet for this period. Complete a quiz to join the
          leaderboard!
        </p>
      )}

      {!loading && you && (
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-indigo-50 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-semibold text-indigo-700">
              #{you.rank ?? "?"}
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">{you.name}</p>
              <p className="text-xs text-slate-600">
                {totalLearners > 0
                  ? `Out of ${totalLearners} learners this period.`
                  : "Keep practising to climb higher!"}
              </p>
            </div>
          </div>
          <div className="text-xs font-semibold text-indigo-700">
            {kFormat(you.xp)} XP {periodLabel.toLowerCase()}
          </div>
        </div>
      )}
    </section>
  );
}

function TopPerformersGrid({ top, periodLabel }) {
  const entries = Array.isArray(top) ? top : [];

  return (
    <section className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-100 px-5 py-5 sm:px-6 sm:py-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Top Performers</h2>
          <p className="mt-1 text-sm text-slate-500">
            Spotlight on the strongest performers {periodLabel.toLowerCase()}.
          </p>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          Start earning XP to appear here as a top performer.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {entries.map((entry, idx) => (
            <article
              key={entry.userId ?? entry.id ?? idx}
              className="rounded-2xl border border-indigo-50 bg-indigo-50/40 px-4 py-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-semibold text-indigo-700">
                  #{entry.rank ?? idx + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {entry.name}
                  </p>
                  <p className="text-xs text-slate-600">
                    Level {entry.level ?? 1}
                  </p>
                </div>
              </div>
              <div className="text-xs font-semibold text-slate-700">
                {kFormat(entry.xp)} XP
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default Leaderboard;
