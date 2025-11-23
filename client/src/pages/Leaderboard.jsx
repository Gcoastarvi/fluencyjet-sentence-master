// client/src/pages/Leaderboard.jsx
import { useEffect, useState, useRef } from "react";
import { apiFetch } from "../utils/fetch";

const PERIODS = [
  { id: "today", label: "Today" },
  { id: "weekly", label: "This Week" },
  { id: "monthly", label: "This Month" },
  { id: "all", label: "All Time" },
];

function formatXp(xp) {
  if (xp == null) return "0";
  const n = Number(xp);
  if (Number.isNaN(n)) return "0";
  if (n >= 1_000_000)
    return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

function periodPretty(period) {
  switch (period) {
    case "today":
      return "Today";
    case "weekly":
      return "This Week";
    case "monthly":
      return "This Month";
    case "all":
      return "All Time";
    default:
      return "This Week";
  }
}

function AvatarBubble({ name }) {
  const initials = (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-lg font-semibold text-white shadow-md">
      {initials || "?"}
    </div>
  );
}

/**
 * Full-width hero carousel for top performers
 */
function TopPerformersHero({ top = [], period }) {
  const [index, setIndex] = useState(0);
  const intervalRef = useRef(null);

  // Reset slide when period changes
  useEffect(() => {
    setIndex(0);
  }, [period]);

  // Auto-rotate slides
  useEffect(() => {
    if (!top || top.length === 0) return;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % top.length;
        return next;
      });
    }, 4500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [top]);

  if (!top || top.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center text-slate-500">
        Top performers will appear here once learners start earning XP.
      </div>
    );
  }

  const item = top[Math.min(index, top.length - 1)] || top[0];
  const xpDisplay = formatXp(item.xp);
  const badgeLabel = item.badge || "No badge yet";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-violet-100 bg-gradient-to-r from-violet-50 via-white to-indigo-50 p-6 shadow-sm sm:p-8">
      {/* Soft glow */}
      <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-violet-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-indigo-300/30 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        {/* Left: medal + avatar + name */}
        <div className="flex flex-1 items-center gap-4 sm:gap-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-violet-100">
            <span className="text-2xl">🏅</span>
          </div>

          <div>
            <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-violet-700 shadow-sm ring-1 ring-violet-100">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-semibold text-white">
                #{item.rank ?? "?"}
              </span>
              <span>Top Performer · {periodPretty(period)}</span>
            </div>
            <div className="mt-1 flex items-center gap-3">
              <AvatarBubble name={item.name} />
              <div>
                <div className="text-lg font-semibold text-slate-900 sm:text-xl">
                  {item.name || "Unknown learner"}
                </div>
                <div className="text-sm text-slate-600">
                  <span className="font-semibold text-violet-700">
                    {xpDisplay} XP
                  </span>{" "}
                  this {periodPretty(period).toLowerCase()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: stats */}
        <div className="flex flex-col items-start gap-4 rounded-2xl bg-white/70 px-4 py-4 text-sm text-slate-700 shadow-sm ring-1 ring-slate-100 sm:px-6">
          <div className="flex w-full items-center justify-between gap-4">
            <span className="text-xs uppercase tracking-wide text-slate-500">
              Badge
            </span>
            <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 ring-1 ring-violet-100">
              {badgeLabel}
            </span>
          </div>

          <div className="flex w-full items-center justify-between gap-4">
            <span className="text-xs uppercase tracking-wide text-slate-500">
              Level
            </span>
            <span className="text-sm font-semibold text-slate-800">
              {item.level ? `Level ${item.level}` : "—"}
            </span>
          </div>

          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500"
              style={{
                width: `${Math.min(100, (item.xp || 0) > 0 ? 40 + Math.min(60, item.xp / 10) : 30)}%`,
              }}
            />
          </div>

          <p className="text-xs text-slate-500">
            Keep practising sentences to chase the{" "}
            <span className="font-semibold text-violet-700">#1 spot</span>!
          </p>
        </div>
      </div>

      {/* Dots indicator */}
      {top.length > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {top.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-6 bg-violet-600" : "w-2 bg-violet-300"
              }`}
              aria-label={`Show performer ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Leaderboard() {
  const [period, setPeriod] = useState("weekly");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadLeaderboard() {
      setLoading(true);
      setError("");

      try {
        const res = await apiFetch(`/api/leaderboard?period=${period}`);

        if (cancelled) return;

        if (!res || res.ok === false) {
          setError(res?.message || "Failed to load leaderboard");
          setData(null);
        } else {
          setData(res);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Leaderboard fetch error:", err);
        setError("Failed to load leaderboard");
        setData(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadLeaderboard();

    return () => {
      cancelled = true;
    };
  }, [period]);

  const rows = data?.rows || [];
  const you = data?.you || null;
  const top = data?.top || [];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      {/* Heading row */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            FluencyJet Leaderboard
          </h1>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            See how you stack up against other learners this{" "}
            {periodPretty(period).toLowerCase()}.
          </p>
        </div>

        {/* Period tabs */}
        <div className="inline-flex rounded-full bg-slate-100 p-1 text-sm">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`rounded-full px-4 py-1.5 font-medium transition ${
                period === p.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error + loading */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="mb-6 text-sm text-slate-500">Loading leaderboard…</div>
      )}

      {/* Main grid: Top learners + Your position */}
      <div className="mb-8 grid gap-6 md:grid-cols-2">
        {/* Top learners list */}
        <section className="rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Top Learners
              </h2>
              <p className="text-xs text-slate-500">
                The most active learners this{" "}
                {periodPretty(period).toLowerCase()}.
              </p>
            </div>
            {data?.totalLearners != null && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {data.totalLearners} learners
              </span>
            )}
          </div>

          {rows.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              No XP data yet. Complete your first quiz to appear on the
              leaderboard!
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {rows.map((row) => (
                <li
                  key={row.userId}
                  className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2.5 text-sm text-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-700 shadow-sm">
                      #{row.rank}
                    </span>
                    <span className="font-medium">{row.name || "Unknown"}</span>
                  </div>
                  <span className="text-xs font-semibold text-violet-700">
                    {formatXp(row.xp)} XP
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Your position */}
        <section className="rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold text-slate-900">
            Your Position
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            Track how you&apos;re progressing on the leaderboard.
          </p>

          {!you ? (
            <p className="text-sm text-slate-500">
              You&apos;re not ranked yet for this period. Complete a quiz to
              join the leaderboard!
            </p>
          ) : (
            <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-violet-50 via-white to-indigo-50 px-4 py-4 shadow-sm ring-1 ring-violet-100/60">
              <AvatarBubble name={you.name} />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {you.name || "You"}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-600">
                      {you.rank
                        ? `Rank #${you.rank} · ${formatXp(you.xp)} XP`
                        : `${formatXp(you.xp)} XP · Not ranked yet this period`}
                    </div>
                  </div>
                  <span className="rounded-full bg-violet-600 px-3 py-1 text-xs font-medium text-white shadow-sm">
                    Level {you.level ?? 1}
                  </span>
                </div>

                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
                    style={{
                      width: `${Math.min(100, (you.xp || 0) / 10 + 20)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Full-width animated Top Performers hero */}
      <section className="mt-4">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">
          Top Performers
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Spotlight on the strongest performers this{" "}
          {periodPretty(period).toLowerCase()}.
        </p>
        <TopPerformersHero top={top} period={period} />
      </section>
    </div>
  );
}
