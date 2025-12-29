// client/src/pages/student/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { api } from "@/api/apiClient";
import { useAuth } from "@/context/AuthContext";

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [summary, setSummary] = useState(null);

  const DEV_ONLY = import.meta.env.DEV;

  function getToken() {
    try {
      return localStorage.getItem("token") || "";
    } catch {
      return "";
    }
  }

  async function copyJwtToClipboard() {
    const token = getToken();
    if (!token) {
      alert("No token found. Log in first.");
      return;
    }

    try {
      await navigator.clipboard.writeText(token);
      alert("JWT copied ✅");
    } catch {
      // Fallback for browsers/permissions that block clipboard API
      window.prompt("Copy JWT:", token);
    }
  }

  function humanizeEventType(type = "") {
    // keep your existing humanizeEventType implementation here...
    if (!type.startsWith("PX_")) return type;

    const parts = type.split("_"); // ["PX", "RC", "a1b2..."]
    const code = parts[1] || "";
    const suffix = parts[2] || "";

    const modeChar = code[0]; // R/T/D/C
    const resultChar = code[1]; // C/W

    const mode =
      modeChar === "R"
        ? "Reorder"
        : modeChar === "T"
          ? "Typing"
          : modeChar === "D"
            ? "Drag & Drop"
            : modeChar === "C"
              ? "Cloze"
              : "Practice";

    const result = resultChar === "C" ? "Correct" : "Wrong";
    const short = suffix ? suffix.slice(0, 6) : "";

    return `${mode} • ${result}${short ? ` • ${short}` : ""}`;
  }

  const levels = useMemo(
    () => [
      { level: 1, xp: 1000 },
      { level: 2, xp: 5000 },
      { level: 3, xp: 10000 },
      { level: 4, xp: 50000 },
      { level: 5, xp: 100000 },
    ],
    [],
  );

  function computeLevel(totalXP = 0) {
    let current = 1;
    for (const item of levels) {
      if (totalXP >= item.xp) current = item.level;
    }
    return current;
  }

  function xpToNextLevel(totalXP = 0) {
    const current = computeLevel(totalXP);
    const next = levels.find((x) => x.level === current + 1);
    if (!next) return 0;
    return Math.max(next.xp - totalXP, 0);
  }

  function levelProgressPct(totalXP = 0) {
    const current = computeLevel(totalXP);
    const currThreshold = levels.find((x) => x.level === current)?.xp ?? 0;
    const nextThreshold =
      levels.find((x) => x.level === current + 1)?.xp ?? null;
    if (!nextThreshold) return 100;
    const span = nextThreshold - currThreshold;
    const into = totalXP - currThreshold;
    return span <= 0
      ? 0
      : Math.max(0, Math.min(100, Math.round((into / span) * 100)));
  }

  // Reload when route changes (dashboard remounts / SPA nav)
  useEffect(() => {
    const onXp = () => {
      // reload summary when XP changes anywhere in the app
      (async () => {
        try {
          const res = await api.get("/dashboard/summary");
          if (res.ok) setSummary(res.data);
        } catch {}
      })();
    };

    window.addEventListener("fj:xp_updated", onXp);
    return () => window.removeEventListener("fj:xp_updated", onXp);
  }, []);

  const userName = user?.name || "Learner";

  if (loading) {
    return (
      <div className="fj-page">
        <div className="fj-card">
          <p>Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="fj-page">
        <div className="fj-card">
          <p className="fj-error">{err}</p>
          <button className="fj-btn" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="fj-page">
        <div className="fj-card">
          <p>No data yet.</p>
        </div>
      </div>
    );
  }

  const totalXP = summary.totalXP ?? 0;
  const lvl = summary.level ?? computeLevel(totalXP);
  const toNext = summary.xpToNextLevel ?? xpToNextLevel(totalXP);
  const pct = levelProgressPct(totalXP);

  return (
    <div className="fj-page">
      {/* Header */}
      <header className="fj-header">
        <div>
          <h1 className="fj-title">Your Dashboard</h1>
          <p className="fj-subtitle">
            Welcome back, <strong>{userName}</strong>
          </p>
        </div>

        {DEV_ONLY && (
          <button
            type="button"
            onClick={copyJwtToClipboard}
            className="ml-auto px-3 py-1 text-xs rounded bg-slate-900 text-white"
            title="Dev-only: copy JWT"
          >
            Copy JWT
          </button>
        )}
      </header>

      {/* 🔥 Streak + XP */}
      <div className="fj-card fj-stats-bar">
        <div className="fj-stats-left">
          <span className="fj-streak">🔥 {summary.streak}-day streak</span>
        </div>
        <div className="fj-stats-right">
          <span className="fj-xp">⭐ {totalXP.toLocaleString()} XP</span>
        </div>
      </div>

      {/* 📊 XP Progress Bar */}
      <section className="fj-dashboard-section">
        <div className="fj-card">
          <div className="fj-progress-header">
            <h2 className="fj-section-title">Level {lvl}</h2>
            <span className="fj-progress-pct">{pct}%</span>
          </div>
          <div className="fj-progress-bar">
            <div className="fj-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="fj-progress-subtitle">
            {toNext.toLocaleString()} XP to next level
          </p>
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
                  <li
                    key={`${event.event_type}-${event.created_at}`}
                    className="fj-activity-item"
                  >
                    <div>
                      <p className="fj-list-title">{lesson.title}</p>
                      {lesson.description && (
                        <p className="fj-list-subtitle">{lesson.description}</p>
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
              <span className="fj-snapshot-value">{summary.yesterdayXP}</span>
            </div>
            <div className="fj-snapshot-row">
              <span className="fj-snapshot-label">This Week</span>
              <span className="fj-snapshot-value">{summary.weeklyXP}</span>
            </div>
            <div className="fj-snapshot-row">
              <span className="fj-snapshot-label">Last Week</span>
              <span className="fj-snapshot-value">{summary.lastWeekXP}</span>
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
                <li
                  key={`${event.event_type}-${event.created_at}`}
                  className="fj-activity-item"
                >
                  <div>
                    <p className="fj-activity-title">
                      {humanizeEventType(event.event_type)}{" "}
                      <span className="fj-activity-xp">
                        {event.xp_delta} XP
                      </span>
                    </p>

                    <div className="text-xs text-slate-400">
                      {event.event_type}
                    </div>

                    <p className="fj-activity-time">
                      {new Date(event.created_at).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="fj-empty-state">No activity yet. Start practicing!</p>
          )}
        </div>
      </section>

      <div className="fj-actions">
        <Link className="fj-btn fj-btn-primary" to="/practice">
          Continue Practising
        </Link>
        <button className="fj-btn" onClick={() => logout()}>
          Logout
        </button>
      </div>
    </div>
  );
}
