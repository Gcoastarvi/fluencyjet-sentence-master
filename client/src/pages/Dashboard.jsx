// client/src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { apiFetch } from "@/utils/fetch";
import { getDisplayName } from "@/utils/displayName";

const LEVELS = [
  { level: 1, xp: 0 },
  { level: 2, xp: 1000 },
  { level: 3, xp: 5000 },
  { level: 4, xp: 10000 },
  { level: 5, xp: 50000 },
  { level: 6, xp: 100000 },
];

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [summary, setSummary] = useState({
    todayXP: 0,
    yesterdayXP: 0,
    weeklyXP: 0,
    lastWeekXP: 0,
    monthlyXP: 0,
    totalXP: 0,
    level: 1,
    xpToNextLevel: 0,
    streak: 0,
    nextBadge: null,
    pendingLessons: [],
    recentActivity: [],
  });

  // -----------------------
  // 🔄 Load Summary on mount
  // -----------------------
  useEffect(() => {
    async function loadSummary() {
      try {
        setLoading(true);
        setError("");

        const data = await apiFetch("/api/dashboard/summary", {
          method: "GET",
        });

        setSummary({
          todayXP: data.todayXP ?? 0,
          yesterdayXP: data.yesterdayXP ?? 0,
          weeklyXP: data.weeklyXP ?? 0,
          lastWeekXP: data.lastWeekXP ?? 0,
          monthlyXP: data.monthlyXP ?? 0,
          totalXP: data.totalXP ?? 0,
          level: data.level ?? 1,
          xpToNextLevel: data.xpToNextLevel ?? 0,
          streak: data.streak ?? 0,
          nextBadge: data.nextBadge ?? null,
          pendingLessons: data.pendingLessons ?? [],
          recentActivity: data.recentActivity ?? [],
        });
      } catch (err) {
        console.error("Dashboard Load Error:", err);
        setError("Failed to load dashboard. Showing default values.");
      } finally {
        setLoading(false);
      }
    }

    loadSummary();
  }, []);

  // -----------------------
  // 📊 Level progress helper
  // -----------------------
  const currentLevelDef =
    LEVELS.find((l) => l.level === summary.level) || LEVELS[0];
  const currentIndex = LEVELS.indexOf(currentLevelDef);
  const nextLevelDef = LEVELS[currentIndex + 1] || currentLevelDef; // last level fallback

  const currentLevelXP = Math.max(summary.totalXP - currentLevelDef.xp, 0);
  const levelSpan = Math.max(nextLevelDef.xp - currentLevelDef.xp, 1);
  const levelPercent = Math.min(
    100,
    Math.round((currentLevelXP / levelSpan) * 100),
  );

  // -----------------------
  // 🧩 Render
  // -----------------------
  return (
    <div className="fj-dashboard-page">
      <header className="fj-dashboard-header">
        <div>
          <h1 className="fj-dashboard-title">Your Dashboard</h1>
          <p className="fj-dashboard-subtitle">
            Welcome back,{" "}
            <span className="fj-dashboard-name">{getDisplayName()}</span>
          </p>
        </div>
      </header>

      {error && <div className="fj-dashboard-error">{error}</div>}

      {loading ? (
        <div className="fj-dashboard-loading">Loading your progress…</div>
      ) : (
        <>
          {/* Profile Box */}
          <section className="fj-dashboard-section">
            <div className="fj-card fj-profile-card">
              <div className="fj-profile-main">
                <div className="fj-profile-avatar">
                  {String(getDisplayName?.() || "L")
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div className="fj-profile-text">
                  <p className="fj-profile-label">Welcome back</p>
                  <p className="fj-profile-name">
                    {getDisplayName?.() || "Learner"}
                  </p>
                  <p className="fj-profile-sub">
                    Level {summary.level ?? 1} ·{" "}
                    {summary.totalXP?.toLocaleString?.("en-IN") ??
                      summary.totalXP ??
                      0}{" "}
                    XP earned
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* XP Overview */}
          <section className="fj-dashboard-section">
            <h2 className="fj-section-title">XP Overview</h2>
            <div className="fj-grid fj-grid-4">
              <div className="fj-card fj-card-soft">
                <p className="fj-card-label">Total XP</p>
                <p className="fj-card-value">{summary.totalXP}</p>
              </div>
              <div className="fj-card fj-card-soft">
                <p className="fj-card-label">Weekly XP</p>
                <p className="fj-card-value">{summary.weeklyXP}</p>
              </div>
              <div className="fj-card fj-card-soft">
                <p className="fj-card-label">Monthly XP</p>
                <p className="fj-card-value">{summary.monthlyXP}</p>
              </div>
              <div className="fj-card fj-card-soft">
                <p className="fj-card-label">Streak</p>
                <p className="fj-card-value">
                  {summary.streak}
                  <span className="fj-streak-flame">🔥</span>
                </p>
              </div>
            </div>
          </section>

          {/* Level & Next Badge */}
          <section className="fj-dashboard-section">
            <div className="fj-grid fj-grid-2">
              <div className="fj-card">
                <h2 className="fj-section-title">Level Progress</h2>
                <p className="fj-level-line">
                  Level <span className="fj-level-number">{summary.level}</span>{" "}
                  <span className="fj-level-separator">•</span> XP to next
                  level:{" "}
                  <span className="fj-level-number">
                    {summary.xpToNextLevel}
                  </span>
                </p>
                <div className="fj-progress-bar">
                  <div
                    className="fj-progress-fill"
                    style={{ width: `${levelPercent}%` }}
                  />
                </div>
                <p className="fj-progress-caption">
                  {levelPercent}% of Level {summary.level}
                </p>
              </div>

              <div className="fj-card">
                <h2 className="fj-section-title">Next Badge</h2>
                {summary.nextBadge ? (
                  <>
                    <p className="fj-badge-name">
                      {summary.nextBadge.label || summary.nextBadge.name}
                    </p>
                    {summary.nextBadge.min_xp != null && (
                      <p className="fj-badge-meta">
                        Unlocks at {summary.nextBadge.min_xp} XP
                      </p>
                    )}
                    <p className="fj-badge-hint">
                      Keep practising sentences to unlock this badge!
                    </p>
                  </>
                ) : (
                  <p className="fj-badge-hint">
                    No next badge available yet. You are at the top tier! 🎉
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Pending Lessons + Quick Stats */}
          <section className="fj-dashboard-section">
            <div className="fj-grid fj-grid-2">
              <div className="fj-card">
                <h2 className="fj-section-title">Pending Lessons</h2>
                {summary.pendingLessons && summary.pendingLessons.length > 0 ? (
                  <ul className="fj-list">
                    {summary.pendingLessons.map((lesson) => (
                      <li key={lesson.id} className="fj-list-item">
                        <div>
                          <p className="fj-list-title">{lesson.title}</p>
                          {lesson.description && (
                            <p className="fj-list-subtitle">
                              {lesson.description}
                            </p>
                          )}
                        </div>
                        {lesson.xpReward != null && (
                          <span className="fj-chip">+{lesson.xpReward} XP</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="fj-empty-state">All caught up! 🎉</p>
                )}
              </div>

              <div className="fj-card">
                <h2 className="fj-section-title">Daily Snapshot</h2>
                <div className="fj-snapshot-row">
                  <span className="fj-snapshot-label">Today&apos;s XP</span>
                  <span className="fj-snapshot-value">{summary.todayXP}</span>
                </div>
                <div className="fj-snapshot-row">
                  <span className="fj-snapshot-label">Yesterday</span>
                  <span className="fj-snapshot-value">
                    {summary.yesterdayXP}
                  </span>
                </div>
                <div className="fj-snapshot-row">
                  <span className="fj-snapshot-label">This Week</span>
                  <span className="fj-snapshot-value">{summary.weeklyXP}</span>
                </div>
                <div className="fj-snapshot-row">
                  <span className="fj-snapshot-label">Last Week</span>
                  <span className="fj-snapshot-value">
                    {summary.lastWeekXP}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Recent Activity */}
          <section className="fj-dashboard-section">
            <div className="fj-card">
              <h2 className="fj-section-title">Recent Activity</h2>
              {summary.recentActivity && summary.recentActivity.length > 0 ? (
                <ul className="fj-activity-list">
                  {summary.recentActivity.map((event) => (
                    <li key={event.id} className="fj-activity-item">
                      <div>
                        <p className="fj-activity-title">
                          {event.event_type} —{" "}
                          <span className="fj-activity-xp">
                            {event.xp_delta} XP
                          </span>
                        </p>
                        <p className="fj-activity-time">
                          {new Date(event.created_at).toLocaleString()}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="fj-empty-state">
                  No XP events yet. Start a quiz and earn your first XP!
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
