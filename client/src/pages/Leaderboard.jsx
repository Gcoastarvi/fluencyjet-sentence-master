// client/src/pages/Leaderboard.jsx
import React, { useEffect, useState, useMemo } from "react";
import { apiFetch } from "../utils/fetch";

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "weekly", label: "This Week" },
  { key: "monthly", label: "This Month" },
  { key: "all", label: "All Time" },
];

// Format XP like 1.2K, 2.3M, etc.
function formatXP(xp) {
  if (!xp || xp <= 0) return "0";
  if (xp >= 1_000_000) {
    return (xp / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (xp >= 1_000) {
    return (xp / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return xp.toString();
}

export default function Leaderboard() {
  const [period, setPeriod] = useState("today");
  const [data, setData] = useState(null); // full API response
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Derived values
  const rows = useMemo(() => (data?.rows ? data.rows : []), [data]);
  const you = useMemo(() => data?.you || null, [data]);
  const top = useMemo(() => data?.top || [], [data]);

  // Load leaderboard whenever period changes
  useEffect(() => {
    let cancelled = false;

    async function loadLeaderboard() {
      setLoading(true);
      setError("");

      try {
        const res = await apiFetch(`/api/leaderboard?period=${period}`);

        // apiFetch will redirect on 401 and return undefined
        if (!res) {
          if (!cancelled) setLoading(false);
          return;
        }

        if (!res.ok) {
          throw new Error(res.message || "Failed to load leaderboard");
        }

        if (!cancelled) {
          setData(res);
        }
      } catch (err) {
        console.error("Leaderboard fetch error:", err);
        if (!cancelled) {
          setError(err.message || "Failed to load leaderboard");
        }
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

  return (
    <div className="fj-page">
      <header className="fj-header">
        <div>
          <h1 className="fj-page-title">Leaderboard</h1>
          <p className="fj-page-subtitle">
            See how you compare with other FluencyJet learners.
          </p>
        </div>

        {/* Period Filter Pills */}
        <div className="fj-pill-group">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={
                "fj-pill" + (period === p.key ? " fj-pill-active" : "")
              }
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {/* Error state */}
      {error && <div className="fj-error-banner">{error}</div>}

      {/* Loading skeleton */}
      {loading && (
        <div className="fj-card fj-card-loading">
          <p>Loading leaderboard…</p>
        </div>
      )}

      {/* Main layout */}
      {!loading && (
        <div className="fj-grid fj-grid-2col fj-grid-gap">
          {/* LEFT: Premium grid */}
          <section className="fj-card fj-leaderboard-card">
            <div className="fj-card-header">
              <h2 className="fj-section-title">Top Learners</h2>
              {data?.totalLearners != null && (
                <span className="fj-chip">{data.totalLearners} learners</span>
              )}
            </div>

            {rows.length === 0 ? (
              <p className="fj-empty-state">
                No XP data yet. Complete your first quiz to appear on the
                leaderboard!
              </p>
            ) : (
              <div className="fj-table-wrapper">
                <table className="fj-table fj-table-leaderboard">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Learner</th>
                      <th>Level</th>
                      <th>Badge</th>
                      <th className="fj-text-right">XP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const isYou = you && row.userId === you.id;
                      return (
                        <tr
                          key={row.userId}
                          className={isYou ? "fj-row-you" : ""}
                        >
                          <td>{row.rank}</td>
                          <td>
                            <div className="fj-user-cell">
                              <div className="fj-avatar">
                                {row.avatarUrl ? (
                                  <img src={row.avatarUrl} alt={row.name} />
                                ) : (
                                  <span>
                                    {row.name
                                      .split(" ")
                                      .map((part) => part[0])
                                      .join("")
                                      .toUpperCase()
                                      .slice(0, 2)}
                                  </span>
                                )}
                              </div>
                              <div className="fj-user-meta">
                                <div className="fj-user-name">
                                  {row.name}
                                  {isYou && (
                                    <span className="fj-badge-you">You</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>Lv. {row.level ?? 1}</td>
                          <td>{row.badge || "—"}</td>
                          <td className="fj-text-right">{formatXP(row.xp)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* RIGHT: Profile box + Top performers strip */}
          <section className="fj-column-stack">
            {/* Profile Box */}
            <div className="fj-card fj-profile-card">
              <h2 className="fj-section-title">Your Position</h2>
              {!you || you.xp === 0 || you.rank == null ? (
                <p className="fj-empty-state">
                  You&apos;re not ranked yet for this period.
                  <br />
                  Complete a quiz to join the leaderboard!
                </p>
              ) : (
                <div className="fj-profile-grid">
                  <div className="fj-profile-main">
                    <div className="fj-profile-rank">#{you.rank}</div>
                    <div className="fj-profile-meta">
                      <div className="fj-profile-name">{you.name || "You"}</div>
                      <div className="fj-profile-sub">
                        Level {you.level ?? 1} • {formatXP(you.xp)} XP
                      </div>
                    </div>
                  </div>
                  <div className="fj-profile-badge">
                    <span className="fj-badge-label">Badge</span>
                    <span className="fj-badge-pill">
                      {you.badge || "No badge yet"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Top performers strip (for future smooth auto-scroll styling) */}
            <div className="fj-card fj-top-strip-card">
              <h2 className="fj-section-title">Top Performers</h2>
              {top.length === 0 ? (
                <p className="fj-empty-state">
                  Top performers will appear here once learners earn XP.
                </p>
              ) : (
                <div className="fj-top-strip">
                  {top.map((row) => (
                    <div key={row.userId} className="fj-top-chip">
                      <span className="fj-top-rank">#{row.rank}</span>
                      <span className="fj-top-name">{row.name}</span>
                      <span className="fj-top-xp">{formatXP(row.xp)} XP</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
