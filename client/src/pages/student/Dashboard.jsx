// client/src/pages/student/Dashboard.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "@/api/apiClient";
import { useAuth } from "@/context/AuthContext";
import { getDisplayName } from "@/utils/displayName";
import { getToken } from "@/utils/tokenStore";
import { toPng } from "html-to-image";

import AvatarFrame from "../../components/student/AvatarFrame";

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

  const [globalFeed, setGlobalFeed] = useState([]);

  const [showMilestoneModal, setShowMilestoneModal] = useState(false);

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
    earnedBadges: [],
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

  // 129: Corrected loadMe with async wrapper
  const loadMe = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      const data = res?.data ?? res;

      if (!data?.ok && !data?.user) {
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
    } catch (err) {
      console.error("loadMe error:", err);
      return null;
    }
  }, [api]);

  const handleClaimBonusXP = async () => {
    try {
      const res = await api.post("/quizzes/claim-weekly-bonus");
      if (res.ok) {
        // Refresh the summary to show the new totalXP and weekly total
        const update = await api.get("/dashboard/summary");
        if (update.ok) setSummary((prev) => ({ ...prev, ...update }));

        setShowMilestoneModal(false);
        alert("500 Bonus XP Added! 🚀");
      }
    } catch (err) {
      console.error("Failed to claim bonus", err);
      setShowMilestoneModal(false);
    }
  };

  // Use Framer Motion for that "Prestige" feel
  const PromotionModal = ({ league, onComplete }) => {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center p-8 bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-yellow-400 rounded-3xl shadow-[0_0_50px_rgba(250,204,21,0.3)]"
        >
          <h2 className="text-4xl font-black text-white mb-4">
            LEAGUE PROMOTED!
          </h2>
          <div
            className={`avatar-frame-${league.toLowerCase()} mx-auto w-32 h-32 mb-6`}
          />
          <p className="text-xl text-slate-300">
            You've ascended to the{" "}
            <span className="text-yellow-400 font-bold">{league}</span>{" "}
            Division.
          </p>
          <button
            onClick={onComplete}
            className="mt-8 px-8 py-3 bg-yellow-400 text-black font-bold rounded-full hover:scale-105 transition-transform"
          >
            COLLECT REWARDS
          </button>
        </motion.div>
      </div>
    );
  };

  const shareBadge = async (badgeName) => {
    const node = document.getElementById("badge-share-card");
    if (!node) return;

    const dataUrl = await toPng(node, { pixelRatio: 2 });
    const link = document.createElement("a");
    link.download = `FluencyJet-${badgeName}-Badge.png`;
    link.href = dataUrl;
    link.click();
  };

  // Unified & Safe Async Effect for Dashboard Data
  useEffect(() => {
    let isMounted = true;

    // 🔄 Reset Mission Celebration for the New Day
    const lastCelebratedDate = localStorage.getItem(
      "fj_mission_celebrated_date",
    );
    const todayString = new Date().toDateString();

    if (lastCelebratedDate !== todayString) {
      localStorage.removeItem("fj_mission_celebrated");
      localStorage.setItem("fj_mission_celebrated_date", todayString);
    }

    // Existing call
    loadSummary();

    async function loadAllDashboardData() {
      try {
        // Fetch everything in parallel for speed
        const [summaryRes, feedRes] = await Promise.all([
          api.get("/dashboard/summary"),
        ]);

        if (!isMounted) return;

        // Handle Summary Data
        const sData = summaryRes?.data ?? summaryRes;
        if (sData) {
          setSummary((prev) => ({
            ...prev,
            ...sData,
            uniqueDays: sData.uniqueDays || 0,
          }));
        }

        // Handle Global Feed Data
        const fData = feedRes?.data ?? feedRes;
        if (fData?.feed) {
          setGlobalFeed(fData.feed);
        }
      } catch (err) {
        console.error("Dashboard Sync Error:", err);
        if (isMounted) setError("Failed to sync your latest progress.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadAllDashboardData();

    return () => {
      isMounted = false;
    };
  }, [api]);

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

      // Inside loadSummary try/catch block
      if (
        data.missionProgress === 3 &&
        !localStorage.getItem("fj_mission_celebrated")
      ) {
        triggerConfetti(); // Ensure you have a confetti helper function
        localStorage.setItem("fj_mission_celebrated", "true");
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

  useEffect(() => {
    // 🏆 Trigger 7/7 Mastery Milestone
    if (
      summary.uniqueDays === 7 &&
      !localStorage.getItem("fj_week_celebrated")
    ) {
      // 1. Grand Confetti
      const duration = 5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const interval = setInterval(function () {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);

        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults,
          particleCount,
          origin: { x: Math.random(), y: Math.random() - 0.2 },
        });
      }, 250);

      // 2. Set a flag so it only happens once per week
      localStorage.setItem("fj_week_celebrated", "true");

      // 3. Optional: Open a "Milestone" Modal
      setShowMilestoneModal(true);
    }
  }, [summary.uniqueDays]);

  return (
    <div className="fj-dashboard">
      {/* 396: Refined Header with Avatar Frame */}
      <header className="flex items-center gap-6 mb-8 pt-10">
        <AvatarFrame
          src={auth?.user?.avatar_url}
          league={summary.league || "BRONZE"}
          size="lg"
        />
        <div className="flex-1">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] leading-none mb-1">
            Your Dashboard
          </p>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
            Welcome back, <span className="text-indigo-600">{userName}</span>
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] font-black bg-slate-100 px-2 py-0.5 rounded text-slate-500 uppercase tracking-tighter">
              {summary.league || "BRONZE"} Division
            </span>
          </div>
        </div>

        {DEV_ONLY && (
          <button
            type="button"
            onClick={copyJwtToClipboard}
            className="px-3 py-1 text-xs rounded bg-slate-900 text-white self-start transition-opacity hover:opacity-80"
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
          {/* 332: Premium Dashboard Grid */}
          <div className="fj-grid fj-grid-2">
            {/* 🏆 Column 1: Weekly Goal Progress */}
            <div className="rounded-[2.5rem] bg-white p-8 border border-slate-100 shadow-sm mb-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  Weekly Goal
                </h3>
                <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-600 text-[10px] font-black uppercase tracking-widest">
                  10 min daily
                </span>
              </div>

              <div className="flex gap-2 mb-4">
                {[...Array(7)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                      i < (summary.uniqueDays || 0)
                        ? "bg-orange-500"
                        : "bg-slate-100"
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <div className="text-3xl font-black text-slate-900">
                    {summary.uniqueDays || 0}/7
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                    Days Mastered
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Mission Card inserted between Weekly Goal and Activity Feed */}
            <section className="fj-dashboard-section mb-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400">
                      Daily Mission
                    </h3>
                    {/* 🔥 Mission Streak Sidebar/Badge */}
                    <span className="flex items-center gap-1 bg-orange-500/20 text-orange-400 text-[8px] font-black px-2 py-0.5 rounded-full border border-orange-500/30">
                      {summary.missionStreak || 0} DAY STREAK
                    </span>
                  </div>
                  {summary.missionCompleted ? (
                    <span className="bg-emerald-500 text-[8px] font-black px-2 py-0.5 rounded-full uppercase">
                      Claimed
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400">
                      +{summary.missionXpReward || 50} XP
                    </span>
                  )}
                </div>

                <p className="text-sm font-bold mb-4">
                  Complete 3 Instant Accuracy sessions
                </p>

                <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-1000"
                    style={{
                      width: `${((summary.missionProgress || 0) / (summary.missionGoal || 3)) * 100}%`,
                    }}
                  />
                </div>

                <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase">
                  <span>
                    {summary.missionProgress || 0} / {summary.missionGoal || 3}{" "}
                    Sessions
                  </span>
                  <span>
                    {Math.round(
                      ((summary.missionProgress || 0) /
                        (summary.missionGoal || 3)) *
                        100,
                    )}
                    %
                  </span>
                </div>
              </div>
              <div className="absolute -right-2 -bottom-2 text-6xl opacity-10 rotate-12">
                🎯
              </div>
            </section>

            {/* ⚡ Column 2: Global Activity Feed */}
            <div className="rounded-[2.5rem] bg-slate-900 p-8 text-white shadow-xl mb-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-5 text-6xl italic font-black pointer-events-none">
                LIVE
              </div>

              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-400 mb-6 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                Activity Feed
              </h3>

              <div className="space-y-4">
                {globalFeed.length > 0 ? (
                  globalFeed.map((event, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 animate-fade-in"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-500 to-fuchsia-500 flex-shrink-0 border border-white/10" />
                      <div className="text-[11px] leading-tight">
                        <span className="font-bold text-white block">
                          {event.user?.name || "A Learner"}
                        </span>
                        <span className="text-slate-400 font-medium italic">
                          Just earned Mastery!
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-slate-500 italic">
                    Waiting for fresh achievements...
                  </p>
                )}
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <div className="text-3xl font-black text-slate-900">
                    {summary.uniqueDays || 0}/7
                  </div>
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                    Days Mastered
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-800">
                    {summary.uniqueDays >= 7
                      ? "Goal Smashed! 🎉"
                      : `${7 - (summary.uniqueDays || 0)} days to go`}
                  </div>
                </div>
              </div>
            </div>

            {/* 542: Unified "My Badges" Component */}
            <section className="fj-dashboard-section mt-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  My Badges
                </h2>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
                  {summary.earnedBadges?.length || 0} Unlocked
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {summary.earnedBadges && summary.earnedBadges.length > 0 ? (
                  summary.earnedBadges.map((badge, i) => (
                    <div
                      key={i}
                      className="group relative bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex flex-col items-center text-center group hover:border-indigo-200 transition-all"
                    >
                      <div className="text-4xl mb-3 transition-transform group-hover:scale-110 duration-300">
                        {badge.badge_name === "Weekly Warrior" ? "🛡️" : "🏅"}
                      </div>
                      <div className="text-[10px] font-black text-slate-900 uppercase tracking-tighter leading-tight">
                        {badge.badge_name}
                      </div>
                      <div className="text-[8px] font-bold text-slate-400 mt-1 uppercase">
                        {new Date(badge.earned_at).toLocaleDateString()}
                      </div>

                      {/* 590: Share Button integrated into the main card */}
                      <button
                        onClick={() => shareBadge(badge.badge_name)}
                        className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-600 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest"
                      >
                        Share Badge
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full bg-slate-50 rounded-[2rem] p-8 text-center border-2 border-dashed border-slate-200">
                    <p className="text-sm font-medium text-slate-500">
                      No badges yet. Complete a weekly goal to earn your first!
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Existing Pending Lessons Card */}
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

          {/* 575: Recent Activity Section */}
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

      {/* 🏆 614: Milestone Modal UI */}
      {showMilestoneModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-indigo-950/80 backdrop-blur-xl animate-fade-in">
          <div className="bg-white rounded-[3.5rem] p-10 max-w-md w-full text-center shadow-2xl relative overflow-hidden border-4 border-indigo-100">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
              ✨
            </div>
            <div className="text-7xl mb-6 scale-110">👑</div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter leading-tight">
              Perfect Week!
            </h2>
            <p className="text-slate-500 mt-4 text-sm font-medium leading-relaxed">
              You've mastered 7 days in a row. Your discipline is unmatched!
              You've earned the{" "}
              <span className="text-indigo-600 font-bold">
                "Weekly Warrior"
              </span>{" "}
              status.
            </p>
            <div className="mt-10">
              <button
                onClick={handleClaimBonusXP}
                className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95"
              >
                Collect 500 Bonus XP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
