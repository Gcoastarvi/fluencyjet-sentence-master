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

    // --- PASTE THIS INSIDE Dashboard() BEFORE THE RETURN ---
    const buyStreakFreeze = async () => {
      try {
        const res = await api.post("/shop/purchase-freeze");
        const data = res?.data ?? res;
        if (data.ok) {
          setSummary((prev) => ({
            ...prev,
            xpTotal: data.xpTotal,
            streak_freezes: data.streakFreezes,
          }));
          alert("Streak Protected! ❄️");
        } else {
          alert(data.error || "Purchase failed");
        }
      } catch (err) {
        console.error("Shop Error:", err);
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
    <div className="min-h-screen bg-[#F8FAFC] pb-24 font-sans selection:bg-indigo-100">
      {/* 1. ANNOUNCEMENT BANNER */}
      {auth?.user?.lastNotification && (
        <div className="bg-indigo-600 p-4 text-center text-white text-xs font-black uppercase tracking-widest animate-pulse">
          📢 {auth.user.lastNotification}
        </div>
      )}

      <header className="max-w-6xl mx-auto px-6 pt-12 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex items-center gap-6">
          <AvatarFrame
            src={auth?.user?.avatar_url}
            league={summary.league || "BRONZE"}
            size="lg"
          />
          <div>
            <h1 className="text-3xl font-black text-slate-900 leading-tight">
              Welcome back, <span className="text-indigo-600">{userName}</span>
            </h1>
            <div className="flex gap-2 mt-2">
              <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                🔥 {summary.streak} DAY STREAK
              </span>
              <span className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                ⭐ {summary.totalXP} TOTAL XP
              </span>
            </div>
          </div>
        </div>

        {/* 2. LEAGUE PROMOTION RING (Side-Widget) */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="relative h-16 w-16 flex items-center justify-center">
            <svg className="absolute inset-0 -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="transparent"
                stroke="#F1F5F9"
                strokeWidth="6"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="transparent"
                stroke="#F97316"
                strokeWidth="6"
                strokeDasharray="175.9"
                strokeDashoffset={
                  175.9 - 175.9 * (Math.min(summary.xpTotal || 0, 500) / 500)
                }
                strokeLinecap="round"
              />
            </svg>
            <span className="text-2xl">🥉</span>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              League Standing
            </p>
            <p className="text-sm font-black text-slate-900">
              {summary.xpTotal < 500
                ? `${500 - summary.xpTotal} XP to Silver`
                : "Promotion Ready!"}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 mt-12 grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* 3. CENTER COLUMN: THE MASTERY PATH */}
        <div className="lg:col-span-2 space-y-10">
          <section>
            <div className="flex justify-between items-end mb-8 px-2">
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  Foundations Path
                </h2>
                <p className="text-sm text-slate-400 font-medium italic">
                  Phase 1: 120 Essential Lessons
                </p>
              </div>
              <span className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">
                Level {summary.level}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lessons
                .filter((l) => l.level === "Beginner")
                .slice(0, 10)
                .map((lesson, idx) => {
                  const isCompleted = userProgress[lesson.id] === 100;
                  const isLocked =
                    idx > 0 && userProgress[lessons[idx - 1].id] < 100;
                  return (
                    <div
                      key={lesson.id}
                      onClick={() =>
                        !isLocked && navigate(`/lesson/${lesson.id}`)
                      }
                      className={`p-6 rounded-[2.5rem] border-2 transition-all cursor-pointer shadow-sm relative overflow-hidden group
                    ${isLocked ? "bg-slate-50 border-slate-100 grayscale" : "bg-white border-white hover:border-indigo-100 hover:scale-[1.02]"}`}
                    >
                      <div className="flex items-center gap-5">
                        <div
                          className={`h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-black ${isCompleted ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"}`}
                        >
                          {isLocked ? "🔒" : isCompleted ? "✓" : idx + 1}
                        </div>
                        <div>
                          <h3 className="font-black text-slate-900 leading-tight mb-1">
                            {lesson.title || `Lesson ${idx + 1}`}
                          </h3>
                          <div className="h-1 w-24 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500"
                              style={{
                                width: `${userProgress[lesson.id] || 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        </div>

        {/* 4. RIGHT COLUMN: MISSIONS & FEED */}
        <div className="space-y-8">
          {/* Daily Mission Card */}
          <section className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
            <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">
              Daily Mission
            </h3>
            <p className="text-lg font-bold mb-6 italic leading-tight">
              Complete 3 Instant Accuracy sessions
            </p>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-indigo-500 transition-all duration-1000"
                style={{
                  width: `${((summary.missionProgress || 0) / 3) * 100}%`,
                }}
              />
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase">
              {summary.missionProgress || 0} / 3 Sessions Completed
            </p>
            <div className="absolute -right-4 -bottom-4 text-7xl opacity-10 rotate-12">
              🎯
            </div>
          </section>

          {/* Global Activity Feed (World-Class Polish) */}
          <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <span className="relative h-2 w-2 flex">
                <span className="animate-ping absolute h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
              </span>
              Live Activity
            </h3>
            <div className="space-y-6">
              {globalFeed.slice(0, 5).map((event, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 animate-in fade-in slide-in-from-right-4 duration-500"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 shrink-0" />
                  <div>
                    <p className="text-xs font-black text-slate-900 uppercase tracking-tighter">
                      {event.user?.name || "A Master"}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium italic">
                      Earned 50 XP in Level {summary.level}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* 5. PERFECT WEEK MODAL */}
      {showMilestoneModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-xl">
          <div className="bg-white rounded-[3.5rem] p-12 max-w-md w-full text-center shadow-2xl">
            <div className="text-7xl mb-6">👑</div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter mb-4">
              PERFECT WEEK!
            </h2>
            <p className="text-slate-500 font-medium mb-10">
              You've mastered 7 days in a row. Your discipline is legendary.
            </p>
            <button
              onClick={handleClaimBonusXP}
              className="w-full py-5 rounded-2xl bg-indigo-600 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-100"
            >
              CLAIM 500 BONUS XP
            </button>
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
