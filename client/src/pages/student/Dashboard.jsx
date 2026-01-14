// client/src/pages/student/Dashboard.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "@/api/apiClient";
import { useAuth } from "@/context/AuthContext";
import { getDisplayName } from "@/utils/displayName";
import { getToken } from "@/utils/tokenStore";

const LEVELS = [
  { level: 1, xp: 0 },
  { level: 2, xp: 1000 },
  { level: 3, xp: 5000 },
  { level: 4, xp: 10000 },
  { level: 5, xp: 50000 },
  { level: 6, xp: 100000 },
];

function fmt(n) {
  const num = Number(n || 0);
  return Number.isFinite(num) ? num.toLocaleString("en-IN") : "0";
}

function computeLevel(totalXP = 0) {
  let current = 1;
  for (const item of LEVELS) {
    if (totalXP >= item.xp) current = item.level;
  }
  return current;
}

function xpToNextLevel(totalXP = 0) {
  const current = computeLevel(totalXP);
  const next = LEVELS.find((x) => x.level === current + 1);
  if (!next) return 0;
  return Math.max(next.xp - totalXP, 0);
}

function levelProgressPct(totalXP = 0) {
  const current = computeLevel(totalXP);
  const curThreshold = LEVELS.find((x) => x.level === current)?.xp ?? 0;
  const nextThreshold = LEVELS.find((x) => x.level === current + 1)?.xp ?? null;
  if (!nextThreshold) return 100;
  const span = nextThreshold - curThreshold;
  const into = totalXP - curThreshold;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((into / span) * 100)));
}

function humanizeEventType(type = "") {
  if (!type) return "XP Event";
  if (!String(type).startsWith("PX_")) return type;

  // expected PX_RC_xxxxx where R=mode, C=correctness
  const parts = String(type).split("_");
  const modeRes = parts[1] || ""; // e.g. "RC"
  const mode = modeRes[0];
  const res = modeRes[1];

  const modeMap = { R: "Reorder", T: "Typing", D: "Drag & Drop", C: "Cloze" };
  const resMap = { C: "Correct", W: "Wrong" };

  const m = modeMap[mode] || "Practice";
  const r = resMap[res] || "";
  return r ? `${m} • ${r}` : m;
}

const DEV_ONLY = import.meta.env.DEV;

function getJwt() {
  return getToken() || "";
}

export default function Dashboard() {
  const auth = useAuth();
  const xpCapReached = auth?.xpCapReached;
  const plan = auth?.plan;

  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [userName, setUserName] = useState(
    () => getDisplayName?.() || "Learner",
  );

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

  const percent = useMemo(
    () => levelProgressPct(summary.totalXP),
    [summary.totalXP],
  );

  const copyJwtToClipboard = useCallback(async () => {
    const token = getJwt();
    if (!token) return alert("No token found. Please login first.");

    try {
      await navigator.clipboard.writeText(token);
      alert("JWT copied ✅");
    } catch (e) {
      console.error(e);
      alert("Copy failed (browser blocked clipboard).");
    }
  }, []);

  const loadMe = useCallback(async () => {
    // NOTE: apiClient may return JSON directly OR {ok, data}. Handle both.
    const res = await api.get("/auth/me");
    const data = res?.data ?? res;

    if (!data?.ok) {
      throw new Error(data?.error || "Failed to load user");
    }

    const name =
      data?.user?.name ||
      data?.user?.displayName ||
      data?.user?.email ||
      data?.email ||
      "Learner";

    setUserName(name);
    return data;
  }, []);

  const loadSummary = useCallback(async () => {
    // IMPORTANT: always control the spinner here
    setLoading(true);

    try {
      const res = await api.get("/dashboard/summary");
      const data = res?.data ?? res;

      // Your backend returns: { ok: true, todayXP, ... }
      // So ok MUST be true. If not, don't crash the dashboard.
      if (!data || data.ok !== true) {
        console.error("Failed to load dashboard summary:", data);
        return;
      }

      const totalXP = Number(data.totalXP || 0);
      const level = Number(data.level || computeLevel(totalXP));

      const next =
        data.xpToNextLevel != null
          ? Number(data.xpToNextLevel)
          : xpToNextLevel(totalXP);

      // ✅ This is your 2nd setSummary instance (keep this mapping style)
      setSummary({
        todayXP: Number(data.todayXP || 0),
        yesterdayXP: Number(data.yesterdayXP || 0),
        weeklyXP: Number(data.weeklyXP || 0),
        lastWeekXP: Number(data.lastWeekXP || 0),
        monthlyXP: Number(data.monthlyXP || 0),
        totalXP,
        level,
        xpToNextLevel: next,
        streak: Number(data.streak || 0),
        nextBadge: data.nextBadge ?? null,
        pendingLessons: Array.isArray(data.pendingLessons)
          ? data.pendingLessons
          : [],
        recentActivity: Array.isArray(data.recentActivity)
          ? data.recentActivity
          : [],
      });

      // ✅ keep fallback in LS (best-effort, must be INSIDE loadSummary)
      try {
        localStorage.setItem("fj_xp", String(totalXP));
        localStorage.setItem("fj_streak", String(Number(data.streak || 0)));
      } catch {}
    } catch (e) {
      console.error("loadSummary failed:", e);
    } finally {
      // ✅ dashboard must never stay stuck loading
      setLoading(false);
    }
  }, [computeLevel, xpToNextLevel]);

  // Main loader (use for retry button etc.)
  const bootstrap = useCallback(async () => {
    setError("");
    try {
      // loadMe + loadSummary handle their own errors/logs
      await Promise.allSettled([loadMe(), loadSummary()]);
    } catch (e) {
      // Promise.allSettled normally won't throw, but keep this as a safety net
      console.error("Dashboard bootstrap error:", e);
      setError(e?.message || "Failed to load dashboard");
    }
    // IMPORTANT: do NOT setLoading(false) here (loadSummary controls loading)
  }, [loadMe, loadSummary]);

  // Load on mount + refresh instantly when XP changes / user returns to tab
  useEffect(() => {
    let inFlight = false;

    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        await bootstrap();
      } catch (e) {
        console.error("Dashboard refresh failed:", e);
      } finally {
        inFlight = false;
      }
    };

    const onXp = () => refresh();
    const onFocus = () => refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };

    // 1) initial load
    refresh();

    // 2) listeners
    window.addEventListener("fj:xp_updated", onXp);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    // 3) cleanup
    return () => {
      window.removeEventListener("fj:xp_updated", onXp);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [bootstrap]);

  return (
    <div className="fj-dashboard">
      <header className="fj-dashboard-header">
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

      {loading ? (
        <div className="fj-dashboard-loading">Loading dashboard...</div>
      ) : error ? (
        <div className="fj-dashboard-error">
          {error}
          <div className="mt-2">
            <button
              className="px-3 py-1 text-xs rounded bg-slate-900 text-white"
              onClick={bootstrap}
            >
              Retry
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Streak + XP */}
          <div className="fj-card fj-stats-bar">
            <div className="fj-stats-left">
              <span className="fj-streak">🔥 {summary.streak}-day streak</span>
              <span className="fj-xp">⭐ {fmt(summary.totalXP)} XP</span>
            </div>
          </div>

          {/* Level progress */}
          <div className="fj-card">
            <h2 className="fj-section-title">Level {summary.level}</h2>
            <div className="fj-progress-bar">
              <div
                className="fj-progress-fill"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="fj-progress-caption">
              {percent}% • {fmt(summary.xpToNextLevel)} XP to next level
            </p>
          </div>

          {/* Pending + Snapshot */}
          <div className="fj-grid fj-grid-2">
            <div className="fj-card">
              <h2 className="fj-section-title">Pending Lessons</h2>
              {summary.pendingLessons?.length ? (
                <ul className="fj-list">
                  {summary.pendingLessons.map((l) => (
                    <li key={l.id || l.title} className="fj-list-item">
                      <span>{l.title}</span>
                      {l.xpReward != null && (
                        <span className="fj-chip">+{l.xpReward} XP</span>
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
                <span className="fj-snapshot-value">
                  {fmt(summary.todayXP)}
                </span>
              </div>
              <div className="fj-snapshot-row">
                <span className="fj-snapshot-label">Yesterday</span>
                <span className="fj-snapshot-value">
                  {fmt(summary.yesterdayXP)}
                </span>
              </div>
              <div className="fj-snapshot-row">
                <span className="fj-snapshot-label">This Week</span>
                <span className="fj-snapshot-value">
                  {fmt(summary.weeklyXP)}
                </span>
              </div>
              <div className="fj-snapshot-row">
                <span className="fj-snapshot-label">Last Week</span>
                <span className="fj-snapshot-value">
                  {fmt(summary.lastWeekXP)}
                </span>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <section className="fj-dashboard-section">
            <div className="fj-card">
              <h2 className="fj-section-title">Recent Activity</h2>
              {summary.recentActivity?.length ? (
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
                <p className="fj-empty-state">
                  No activity yet. Start practicing!
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
