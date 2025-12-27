// client/src/pages/student/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { api } from "@/api/apiClient";
import { getDisplayName } from "@/utils/displayName";
import { useAuth } from "@/context/AuthContext";

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
  const { xpCapReached, plan } = useAuth();

  const streakLS = Number(localStorage.getItem("fj_streak")) || 0;
  const xpLS = Number(localStorage.getItem("fj_xp")) || 0;

  const weeklyBadges = JSON.parse(localStorage.getItem("fj_badges")) || [];

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
  const [prevLevel, setPrevLevel] = useState(null);
  const [showLevelUp, setShowLevelUp] = useState(false);

  const showSessionComplete =
    summary.todayXP > 0 && summary.recentActivity?.length > 0;
  const lastSession = JSON.parse(localStorage.getItem("fj_last_session"));
  const resumeQuestionNumber =
    lastSession?.questionIndex != null ? lastSession.questionIndex + 1 : null;

  // -----------------------
  // 🔄 Load Summary on mount
  // -----------------------
  useEffect(() => {
    async function loadSummary() {
      try {
        setLoading(true);
        setError("");

        const data = await api.get("/dashboard/summary");

        const newLevel = data.level ?? 1;

        setSummary({
          todayXP: data.todayXP ?? 0,
          yesterdayXP: data.yesterdayXP ?? 0,
          weeklyXP: data.weeklyXP ?? 0,
          lastWeekXP: data.lastWeekXP ?? 0,
          monthlyXP: data.monthlyXP ?? 0,
          totalXP: data.totalXP ?? 0,
          level: newLevel,
          xpToNextLevel: data.xpToNextLevel ?? 0,
          streak: data.streak ?? 0,
          nextBadge: data.nextBadge ?? null,
          pendingLessons: data.pendingLessons ?? [],
          recentActivity: data.recentActivity ?? [],
        });

        localStorage.setItem("fj_xp", String(data.totalXP ?? 0));
        localStorage.setItem("fj_streak", String(data.streak ?? 0));

        /* 🎉 Level-up detection */
        if (prevLevel !== null && newLevel > prevLevel) {
          setShowLevelUp(true);
          setTimeout(() => setShowLevelUp(false), 2000);
        }

        setPrevLevel(newLevel);
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
      {/* 🔥 Streak + XP */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow mb-4">
        <div className="text-orange-600 font-semibold">
          🔥 {summary?.streak ?? streakLS}-day streak
        </div>
        <div className="text-purple-600 font-semibold">
          ⭐ {(summary?.totalXP ?? xpLS).toLocaleString("en-IN")} XP
        </div>
      </div>
      {/* 🎉 Level Up Celebration */}
      {showLevelUp && (
        <div className="mb-4 p-4 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-center font-semibold animate-pulse">
          🎉 Level Up! You reached Level {summary.level}
        </div>
      )}
      {/* ✅ Session Completion Card */}
      {showSessionComplete && (
        <div className="mb-6 p-5 rounded-xl bg-green-50 border border-green-300 text-center">
          <h3 className="text-lg font-semibold text-green-700 mb-1">
            ✅ Session Complete!
          </h3>
          <p className="text-sm text-green-600">
            You earned <strong>{summary.todayXP} XP</strong> today. Keep the
            streak alive! 🔥
          </p>
          {resumeQuestionNumber && (
            <div className="mt-2 text-sm text-purple-700 font-medium">
              🔁 You left off at{" "}
              <span className="font-semibold">
                Question {resumeQuestionNumber}
              </span>
            </div>
          )}

          <div className="mt-4">
            <button
              onClick={() => {
                const last = JSON.parse(
                  localStorage.getItem("fj_last_session"),
                );

                if (last?.practiceType === "reorder") {
                  window.location.href = "/practice/reorder?resume=1";
                } else {
                  window.location.href = "/practice/reorder";
                }
              }}
              className="px-6 py-2 rounded-full bg-purple-600 text-white font-semibold hover:bg-purple-700 transition"
            >
              ▶ Continue Practising
            </button>
          </div>
        </div>
      )}

      {/* 📊 XP Progress Bar */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex justify-between mb-2 text-sm font-medium">
          <span className="text-gray-700">Level {summary.level}</span>
          <span className="text-gray-500">{levelPercent}%</span>
        </div>

        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              showLevelUp
                ? "bg-pink-500 shadow-lg animate-pulse"
                : "bg-purple-600"
            }`}
            style={{ width: `${levelPercent}%` }}
          />
        </div>

        <p className="text-xs text-gray-500 mt-2">
          {currentLevelXP.toLocaleString("en-IN")} XP /
          {levelSpan.toLocaleString("en-IN")} XP to next level
        </p>
      </div>

      {plan === "FREE" && (
        <div className="bg-yellow-50 border border-yellow-300 p-3 rounded mb-4 text-sm">
          ⚠️ You’re on the FREE plan. Daily XP is limited.
          <button
            className="ml-2 text-purple-600 underline"
            onClick={() => navigate("/paywall")}
          >
            Upgrade
          </button>
        </div>
      )}

      {xpCapReached && (
        <div className="mb-4 p-4 rounded-lg bg-yellow-100 border border-yellow-400 text-yellow-900">
          You’ve hit today’s FREE XP limit.
          <a href="/paywall" className="underline font-semibold ml-1">
            Upgrade to PRO
          </a>{" "}
          for unlimited XP.
        </div>
      )}

      {error && <div className="fj-dashboard-error">{error}</div>}

      {loading ? (
        <div className="fj-dashboard-loading">Loading your progress…</div>
      ) : (
        <>
          {/* 🏅 Weekly Streak Badges */}
          <div className="bg-white p-4 rounded-lg shadow mb-6">
            <h3 className="text-lg font-semibold mb-3">
              🏅 Weekly Streak Badges
            </h3>

            {weeklyBadges.length === 0 ? (
              <p className="text-gray-500 text-sm">
                Complete a 7-day streak to earn your first badge!
              </p>
            ) : (
              <div className="flex gap-3 flex-wrap">
                {weeklyBadges.map((badge) => (
                  <div
                    key={badge}
                    className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium"
                  >
                    ⭐ Week {badge.replace("week-", "")}
                  </div>
                ))}
              </div>
            )}
          </div>

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
