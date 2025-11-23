// client/src/pages/Leaderboard.jsx
import React, { useEffect, useState } from "react";

/**
 * Helper: get a pretty label for the active period
 */
const PERIOD_LABELS = {
  today: "Today",
  weekly: "This Week",
  monthly: "This Month",
  all: "All Time",
};

/**
 * Helper: format XP as "1.2K"
 */
function formatXP(xp) {
  if (xp == null) return "0";
  if (xp >= 1_000_000)
    return (xp / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (xp >= 1_000) return (xp / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return xp.toString();
}

/**
 * Helper: safe parsing of API response (tolerant to minor shape changes)
 */
function normalizeLeaderboardResponse(json) {
  if (!json || json.ok === false) {
    return {
      entries: [],
      me: null,
      period: json?.period || "weekly",
      message: json?.message || "Failed to load leaderboard",
    };
  }

  // Main entries array – support a few possible keys
  const entries = json.entries || json.data || json.rows || json.leaders || [];

  // "me" entry – support a few possible keys
  const me = json.me || json.you || json.self || null;

  return {
    entries: Array.isArray(entries) ? entries : [],
    me: me || null,
    period: json.period || "weekly",
    message: json.message || "",
  };
}

/**
 * Main Leaderboard page
 */
export default function Leaderboard() {
  const [period, setPeriod] = useState("weekly"); // "today" | "weekly" | "monthly" | "all"
  const [entries, setEntries] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load leaderboard whenever the period changes
  useEffect(() => {
    loadLeaderboard(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  async function loadLeaderboard(activePeriod) {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");

      if (!token) {
        setError("Please log in again to view the leaderboard.");
        setEntries([]);
        setMe(null);
        return;
      }

      const res = await fetch(`/api/leaderboard?period=${activePeriod}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        // Auth middleware returns 401 + { ok: false, message: "Missing token" | "Token expired" }
        let body = null;
        try {
          body = await res.json();
        } catch (_) {
          // ignore JSON parse error here
        }

        const serverMsg = body?.message;
        if (serverMsg && serverMsg.toLowerCase().includes("expired")) {
          setError("Session expired. Please log in again.");
        } else {
          setError("Missing or invalid token. Please log in again.");
        }
        setEntries([]);
        setMe(null);
        return;
      }

      if (!res.ok) {
        setError(`Failed to load leaderboard (HTTP ${res.status})`);
        setEntries([]);
        setMe(null);
        return;
      }

      const json = await res.json();
      const normalized = normalizeLeaderboardResponse(json);

      if (normalized.message && !normalized.entries.length && !normalized.me) {
        // e.g. ok:false from server
        setError(normalized.message);
      } else {
        setError("");
      }

      setEntries(normalized.entries);
      setMe(normalized.me);
    } catch (err) {
      console.error("Leaderboard fetch error:", err);
      setError("Failed to load leaderboard");
      setEntries([]);
      setMe(null);
    } finally {
      setLoading(false);
    }
  }

  const topThree = entries.slice(0, 3);
  const hasAnyData = entries.length > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Page heading */}
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold text-slate-900">
          FluencyJet Leaderboard
        </h1>
        <p className="mt-2 text-slate-600">
          See how you stack up against other learners{" "}
          {PERIOD_LABELS[period].toLowerCase()}.
        </p>
      </header>

      {/* Period tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="inline-flex rounded-full bg-slate-100 p-1">
          {["today", "weekly", "monthly", "all"].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition ${
                period === p
                  ? "bg-white shadow-sm text-indigo-600"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Period · {PERIOD_LABELS[period]}
        </span>
      </div>

      {/* Error + Loading */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {loading && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
          Loading leaderboard…
        </div>
      )}

      {/* Main cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Learners */}
        <section className="rounded-2xl bg-white shadow-sm border border-slate-100 p-5">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">
            Top Learners
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            The most active learners {PERIOD_LABELS[period].toLowerCase()}.
          </p>

          {!hasAnyData && (
            <p className="text-sm text-slate-500">
              No XP data yet. Complete your first quiz to appear on the
              leaderboard!
            </p>
          )}

          {hasAnyData && (
            <ul className="divide-y divide-slate-100">
              {entries.slice(0, 10).map((entry, index) => (
                <li
                  key={entry.userId || entry.id || index}
                  className="flex items-center justify-between py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
                      #{entry.rank || index + 1}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {entry.displayName || entry.name || "Learner"}
                      </div>
                      {entry.badge && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Badge: {entry.badge}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-900">
                      {formatXP(entry.xp || entry.totalXp)}
                    </div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                      XP
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Your Position */}
        <section className="rounded-2xl bg-white shadow-sm border border-slate-100 p-5">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">
            Your Position
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Track how you&apos;re progressing on the leaderboard.
          </p>

          {!me && (
            <p className="text-sm text-slate-500">
              You&apos;re not ranked yet for this period. Complete a quiz to
              join the leaderboard!
            </p>
          )}

          {me && (
            <div className="flex items-center justify-between mt-2 rounded-xl border border-indigo-50 bg-indigo-50/60 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-semibold">
                  #{me.rank || "? "}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {me.displayName || me.name || "You"}
                  </div>
                  <div className="text-xs text-slate-600">
                    {formatXP(me.xp || me.totalXp)} XP{" "}
                    {PERIOD_LABELS[period].toLowerCase()}
                  </div>
                </div>
              </div>
              <div className="text-right text-xs text-slate-500">
                Keep practising to climb higher!
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Top performers highlight */}
      <section className="mt-6 rounded-2xl bg-white shadow-sm border border-slate-100 p-5">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">
          Top Performers
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Spotlight on the strongest performers{" "}
          {PERIOD_LABELS[period].toLowerCase()}.
        </p>

        {!hasAnyData && (
          <p className="text-sm text-slate-500">
            Top performers will appear here once learners start earning XP.
          </p>
        )}

        {hasAnyData && (
          <div className="grid gap-3 sm:grid-cols-3">
            {topThree.map((entry, index) => (
              <div
                key={entry.userId || entry.id || index}
                className="rounded-xl bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-100 px-4 py-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
                    #{entry.rank || index + 1}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatXP(entry.xp || entry.totalXp)} XP
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {entry.displayName || entry.name || "Learner"}
                </div>
                {entry.badge && (
                  <div className="mt-1 text-xs text-slate-600">
                    Badge: {entry.badge}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
