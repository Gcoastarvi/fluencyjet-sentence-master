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

  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [milestoneType, setMilestoneType] = useState(""); // "FIRST_LESSON" or "BRONZE_LEAGUE"

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
    streakFreezes: 0,
    uniqueDays: 0,
    xpTotal: 0 ? nextBadge : null,
    earnedBadges: [],
    pendingLessons: [],
    recentActivity: [],
  });

  const percent = useMemo(
    () => levelProgressPct(summary.totalXP),
    [summary.totalXP],
  );

  const currentTime = new Date();
  const isLate = currentTime.getHours() >= 22;
  const hasNoFreezes = (summary?.streakFreezes || 0) === 0; // Safe access
  const needsMastery = (summary?.uniqueDays || 0) === 0;

  const showEmergencyAlert = isLate && hasNoFreezes && needsMastery;

  const triggerCelebration = (type) => {
    setMilestoneType(type);
    setShowPromotionModal(true);

    // 🎊 Simple CSS Confetti Trigger (if using a library like canvas-confetti)
    // If you don't have a library yet, this is where you'd call it.
    if (window.confetti) {
      window.confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#6366f1", "#10b981", "#f59e0b"],
      });
    }
  };

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

    const buyStreakFreeze = async () => {
      try {
        // 🚀 Calls your new shop router in server/routes/shop.js
        const res = await api.post("/shop/purchase-freeze");
        const data = res?.data ?? res;

        if (data.ok) {
          // ✅ Instantly updates the UI with new totals
          setSummary((prev) => ({
            ...prev,
            xpTotal: data.xpTotal,
            streak_freezes: data.streakFreezes,
          }));
          alert("Streak Protected! ❄️");
        } else {
          alert(data.error || "You need more XP!");
        }
      } catch (err) {
        console.error("Shop Error:", err);
        alert("Could not connect to the shop.");
      }
    };

    // Existing call
    loadSummary();

    async function loadAllDashboardData() {
      try {
        // 🚀 Single consolidated fetch (XP + Activity + Missions)
        const summaryRes = await api.get("/dashboard/summary");
        const sData = summaryRes?.data ?? summaryRes;

        if (!isMounted) return;

        if (sData) {
          setSummary((prev) => ({
            ...prev,
            ...sData,
            uniqueDays: sData.uniqueDays || 0,
          }));

          // 🏆 Achievement & Promotion Triggers
          if (
            sData.xpTotal >= 150 &&
            !localStorage.getItem("fj_first_lesson_celebrated")
          ) {
            setMilestoneType("FIRST_LESSON");
            setShowPromotionModal(true);
            localStorage.setItem("fj_first_lesson_celebrated", "true");
          } else if (
            sData.xpTotal >= 500 &&
            !localStorage.getItem("fj_bronze_league_celebrated")
          ) {
            setMilestoneType("BRONZE_LEAGUE");
            setShowPromotionModal(true);
            localStorage.setItem("fj_bronze_league_celebrated", "true");
          }

          // 🎯 Handle Global Feed Data from the same summary object
          if (sData.recentActivity) {
            setGlobalFeed(sData.recentActivity);
          }
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

          {showEmergencyAlert && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-500 rounded-3xl animate-pulse">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🚨</span>
                <div>
                  <h4 className="text-sm font-black text-red-900 uppercase tracking-tighter">
                    Streak at Risk!
                  </h4>
                  <p className="text-xs text-red-700 font-bold">
                    It's past 10 PM and you have 0 freezes. Complete a lesson
                    now to save your streak!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Pending + Snapshot */}
          {/* Premium Dashboard Grid */}
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
                {/* 🎯 Supports both camelCase and snake_case from the server */}
                {/* 🎯 Streak Freeze Row */}
                <div className="mt-4 flex items-center justify-between p-3 bg-blue-500/10 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">❄️</span>
                    <div>
                      <p className="text-[10px] font-black text-blue-300 uppercase leading-none">
                        Equipped
                      </p>
                      <p className="text-sm font-black text-white">
                        {summary.streak_freezes ?? summary.streakFreezes ?? 0}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={buyStreakFreeze}
                    disabled={(summary.xpTotal || 0) < 200}
                    className="px-4 py-2 bg-blue-500 text-white text-[10px] font-black rounded-xl hover:bg-blue-400 disabled:opacity-30 transition-all active:scale-95"
                  >
                    BUY FOR 200 XP
                  </button>
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

            <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm mt-6">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                League Standing
              </h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* 🎡 League Progress Ring with Promotion Preview */}
                  <div className="group relative w-14 h-14 flex items-center justify-center">
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                      <circle
                        cx="28"
                        cy="28"
                        r="24"
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth="4"
                        className="text-slate-100"
                      />
                      <circle
                        cx="28"
                        cy="28"
                        r="24"
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeDasharray={150.8}
                        strokeDashoffset={
                          150.8 -
                          Math.min((summary.xpTotal || 0) / 500, 1) * 150.8
                        }
                        strokeLinecap="round"
                        className="text-orange-500 transition-all duration-1000"
                      />
                    </svg>
                    <div className="text-2xl z-10">🥉</div>

                    {/* 💎 Promotion Preview Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-40 p-3 bg-slate-900 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-50">
                      <p className="font-black mb-1 uppercase tracking-widest text-orange-400">
                        Next Reward
                      </p>
                      <p className="text-slate-300 leading-tight">
                        Reach 500 XP to unlock the{" "}
                        <span className="text-white font-bold">
                          Silver Frame
                        </span>{" "}
                        & 50 Bonus Gems!
                      </p>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      Bronze League
                    </p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">
                      {summary.xpTotal < 500
                        ? `${500 - summary.xpTotal} XP to promote`
                        : "In Promotion Zone!"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-indigo-600">Rank #1</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">
                    Top 10%
                  </p>
                </div>
              </div>
            </div>

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
  // 统一 Promotion Modal - Place at the very bottom of Dashboard.jsx
  function PromotionModal({ isOpen, type, league, onClose }) {
    if (!isOpen) return null;

    const content = {
      FIRST_LESSON: {
        title: "FIRST STEP TO MASTERY!",
        desc: "You've earned your first 150 XP. The journey begins with a single lesson.",
        icon: "🎓",
        color: "border-indigo-400 shadow-[0_0_50px_rgba(99,102,241,0.3)]",
      },
      BRONZE_LEAGUE: {
        title: "LEAGUE PROMOTED!",
        desc: `You've ascended to the ${league || "BRONZE"} Division.`,
        icon: "🥉",
        color: "border-yellow-400 shadow-[0_0_50px_rgba(250,204,21,0.3)]",
      },
    };

    const active = content[type] || content.FIRST_LESSON;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`text-center p-8 bg-gradient-to-b from-slate-800 to-slate-900 border-2 rounded-3xl max-w-sm w-full ${active.color}`}
        >
          <div className="text-6xl mb-4">{active.icon}</div>
          <h2 className="text-3xl font-black text-white mb-2">
            {active.title}
          </h2>
          <p className="text-slate-300 mb-8">{active.desc}</p>

          <button
            onClick={onClose}
            className="w-full py-4 bg-yellow-400 text-black font-black rounded-2xl hover:scale-105 transition-transform active:scale-95"
          >
            COLLECT REWARDS
          </button>
        </motion.div>
        <PromotionModal
          isOpen={showPromotionModal}
          type={milestoneType}
          league={summary.league}
          onClose={() => setShowPromotionModal(false)}
        />
      </div>
    );
  }
}
