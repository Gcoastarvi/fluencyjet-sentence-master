// client/src/pages/student/Dashboard.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "@/api/apiClient";
import { useAuth } from "@/context/AuthContext";
import { getDisplayName } from "@/utils/displayName";
import { getToken } from "@/utils/tokenStore";
import { toPng } from "html-to-image";
import confetti from "canvas-confetti";
import { lessonPathForTrack, normalizeTrack } from "../../lib/trackRoutes";

import AvatarFrame from "../../components/student/AvatarFrame";

const UI_TEXT = {
  en: {
    home: "Home",
    lessons: "Lessons",
    ranking: "Ranking",
    progress: "My Progress",
    medals: "My Medals",
    dailyGoal: "Daily Goal",
    master: "Master",
    streak: "Daily Streak",
    newAchievement: "New Medal Unlocked!",
    finishLessons: "Finish 3 Lessons",
    close: "Got it!",
  },
  ta: {
    home: "முகப்பு",
    lessons: "பாடங்கள்",
    ranking: "தரவரிசை",
    progress: "முன்னேற்றம்",
    medals: "எனது பதக்கங்கள்",
    dailyGoal: "இன்றைய இலக்கு",
    master: "நிபுணர்",
    streak: "தொடர் நாட்கள்",
    newAchievement: "புதிய பதக்கம்!",
    finishLessons: "3 பாடங்களை முடிக்கவும்",
    close: "சரி", // 🎯 "Okay/Got it" - Friendly & Natural
  },
};

const currentLang = "en";

const navItems = [
  { label: UI_TEXT[currentLang].home, icon: "🏠", path: "/dashboard" },
  { label: UI_TEXT[currentLang].lessons, icon: "📚", path: "/lessons" },
  { label: UI_TEXT[currentLang].ranking, icon: "🏆", path: "/leaderboard" },
  { label: UI_TEXT[currentLang].progress, icon: "👤", path: "profile" }, // 🎯 CHANGED TO PROGRESS
];

const dashboardStyles = `
  .league-silver-glow {
    background: linear-gradient(135deg, #e2e8f0 0%, #ffffff 50%, #cbd5e1 100%) !important;
    background-size: 200% 200%;
    animation: silverShimmer 3s ease infinite;
    border: 2px solid #94a3b8 !important;
    box-shadow: 0 0 20px rgba(203, 213, 225, 0.5);
  }

  @keyframes silverShimmer {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  @keyframes flamePulse {
    0% { transform: scale(1); filter: drop-shadow(0 0 2px #f97316); }
    50% { transform: scale(1.1); filter: drop-shadow(0 0 8px #ea580c); }
    100% { transform: scale(1); filter: drop-shadow(0 0 2px #f97316); }
  }
  .streak-flame-active {
    animation: flamePulse 2s infinite ease-in-out;
    display: inline-block;
  }
  .frame-silver-pro {
    box-shadow: 0 0 15px rgba(148, 163, 184, 0.5), inset 0 0 10px rgba(255, 255, 255, 0.8);
    border: 4px solid #cbd5e1;
    background: linear-gradient(135deg, #e2e8f0 0%, #ffffff 50%, #94a3b8 100%);
  }
  .rank-master-glow {
    box-shadow: 0 0 20px rgba(99, 102, 241, 0.4);
    border: 4px solid #cbd5e1; /* Silver Border */
    animation: silver-shimmer 3s infinite linear;
  }

  @keyframes silver-shimmer {
    0% { filter: brightness(1); }
    50% { filter: brightness(1.2); }
    100% { filter: brightness(1); }
  }
`;

const LEVELS = [
  { level: 1, xp: 0 },
  { level: 2, xp: 1000 },
  { level: 3, xp: 5000 },
  { level: 4, xp: 10000 },
  { level: 5, xp: 50000 },
  { level: 6, xp: 100000 },
];

const lang = "en"; // Switch to 'en' but we will show BOTH labels for accessibility

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

// 🎯 THE SOURCE OF TRUTH: Unify all league thresholds here
export const getLeagueInfo = (xp) => {
  const score = Number(xp || 0);
  if (score <= 5000)
    return {
      name: "BRONZE",
      icon: "🥉",
      glow: "border-slate-100",
      text: "text-slate-400",
      perks: ["Standard XP", "Public Leaderboard"],
    };
  if (score <= 15000)
    return {
      name: "SILVER",
      icon: "🥈",
      glow: "league-silver-glow",
      text: "text-silver-prestige",
      perks: ["1.2x XP Multiplier", "Silver Badge"],
    };
  if (score <= 40000)
    return {
      name: "GOLD",
      icon: "🥇",
      glow: "league-gold-glow",
      text: "text-yellow-500",
      perks: ["1.5x XP Multiplier", "1 Free Streak Shield/week"],
    };
  if (score <= 80000)
    return {
      name: "EMERALD",
      icon: "✳️",
      glow: "league-emerald-glow",
      text: "text-emerald-500",
    };
  if (score <= 150000)
    return {
      name: "SAPPHIRE",
      icon: "💎",
      glow: "league-sapphire-glow",
      text: "text-blue-500",
    };
  return {
    name: "DIAMOND",
    icon: "👑",
    glow: "league-diamond-glow",
    text: "text-indigo-500",
  };
};

export default function Dashboard() {
  const auth = useAuth();
  const user = auth?.user;
  const xpCapReached = auth?.xpCapReached;
  const plan = auth?.plan;

  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [milestoneType, setMilestoneType] = useState(""); // "FIRST_LESSON" or "BRONZE_LEAGUE"

  const [showVictoryModal, setShowVictoryModal] = useState(false);

  const [lessons, setLessons] = useState([]);
  const [userProgress, setUserProgress] = useState({});

  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState(null);

  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [userName, setUserName] = useState(
    () => getDisplayName?.() || "Learner",
  );

  const [globalFeed, setGlobalFeed] = useState([]);

  const [showMilestoneModal, setShowMilestoneModal] = useState(false);

  const [unlockedBadge, setUnlockedBadge] = useState(null);

  const [showPromotion, setShowPromotion] = useState(false);
  const [newLeague, setNewLeague] = useState("");

  const [worldRanking, setWorldRanking] = useState([]);

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
    xpTotal: 0,
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

  // 🎯 THE SLOT MACHINE HOOK
  const [displayXP, setDisplayXP] = useState(0);

  const showShieldWidget =
    Number(summary?.streak || 0) >= 3 ||
    Number(summary?.streakFreezes || 0) > 0;

  useEffect(() => {
    let start = 0;
    const end = Number(user?.total_xp || 0);
    if (start === end) return;

    let totalMiliseconds = 2000; // 2 second animation
    let timer = setInterval(() => {
      start += Math.ceil(end / 50); // Increment speed
      if (start >= end) {
        clearInterval(timer);
        setDisplayXP(end);
      } else {
        setDisplayXP(start);
      }
    }, 30);

    return () => clearInterval(timer);
  }, [user?.total_xp]);

  // JSX for the XP Card:
  <span className="text-indigo-600 font-black">
    {displayXP.toLocaleString()} TOTAL XP
  </span>;

  // 🎯 This goes at the top with your other states
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [prevLevel, setPrevLevel] = useState(0);
  const [prevBadgeCount, setPrevBadgeCount] = useState(0);

  // 🎯 THE PROGRESS NUDGE CALCULATOR
  // 🎯 THE TRUTH FIX: Ensure the UI respects the Database League
  const currentLeague = user?.league?.toUpperCase() || "BRONZE";

  const leagueNudge = useMemo(() => {
    // 🎯 THE UNIFIER: Look in both places just in case
    const xp = Number(user?.totalXP || user?.total_xp || summary?.totalXP || 0);

    if (xp <= 5000) return { next: "SILVER", diff: 5000 - xp, goal: 5000 };
    if (xp <= 15000) return { next: "GOLD", diff: 15000 - xp, goal: 15000 };
    if (xp <= 40000) return { next: "EMERALD", diff: 40000 - xp, goal: 40000 };
    if (xp <= 80000) return { next: "SAPPHIRE", diff: 80000 - xp, goal: 80000 };
    if (xp <= 150000)
      return { next: "DIAMOND", diff: 150000 - xp, goal: 150000 };
    return null;
  }, [user, summary]); // 👈 Added both as dependencies

  useEffect(() => {
    let start = displayXP;
    const end = summary.totalXP || 0;
    if (start === end) return;

    const duration = 1000; // 1 second animation
    const stepTime = Math.abs(Math.floor(duration / (end - start || 1)));

    const timer = setInterval(() => {
      start += Math.ceil((end - start) / 10); // Move in 10% chunks
      if (start >= end) {
        setDisplayXP(end);
        clearInterval(timer);
      } else {
        setDisplayXP(start);
      }
    }, 50);

    return () => clearInterval(timer);
  }, [summary.totalXP]);

  const playXP = () => {
    const audio = new Audio("/sounds/xp.mp3");
    audio.play().catch((e) => console.log("Audio play blocked"));
  };

  const playLevelUp = () => {
    const audio = new Audio("/sounds/levelup.mp3");
    audio.play().catch((e) => console.log("Audio play blocked"));
  };

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

  const handleOpenProfile = () => {
    setIsProfileOpen(true);

    // 🎆 Trigger the "Pro Master" Confetti
    import("canvas-confetti").then((confetti) => {
      confetti.default({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.8 }, // Fire from the bottom of the drawer
        colors: ["#6366f1", "#f59e0b", "#ffffff"], // Indigo, Gold, and White
      });
    });
  };

  const [isBuying, setIsBuying] = useState(false);

  const handleBuyShield = async () => {
    setIsBuying(true);
    try {
      const res = await buyStreakShield(); // Your API call
      if (res.ok) {
        // 🎯 Sync the frontend summary with the new count
        setSummary((prev) => ({
          ...prev,
          streakFreezes: res.newCount,
          totalXP: res.newXp,
        }));
        alert("Streak Shield Secured! 🔥");
      }
    } catch (err) {
      alert(
        err.message === "INSUFFICIENT_XP"
          ? "Not enough XP! Keep practicing."
          : "Purchase failed.",
      );
    } finally {
      setIsBuying(false);
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

  const syncXP = async () => {
    const res = await api.get("/dashboard/summary");
    const data = res?.data ?? res;
    if (data?.ok) {
      setSummary((prev) => ({ ...prev, ...data }));
    }
  };

  const handleLessonComplete = async (lessonId, xpEarned) => {
    try {
      // 1. Tell the backend we finished
      await api.post("/api/xp/add", {
        xp: xpEarned,
        type: "LESSON_COMPLETED",
        lessonId: lessonId,
      });

      // 2. Play the XP Sound
      const audio = new Audio("/sounds/xp.mp3");
      audio.play();

      // 3. Redirect back with a "success" flag
      navigate("/dashboard?completed=true");
    } catch (err) {
      console.error("XP Sync Failed", err);
    }
  };

  const fetchUserSummary = async () => {
    try {
      const res = await api.get("/dashboard/summary");
      const data = res?.data ?? res;

      if (data?.ok) {
        setSummary((prev) => ({ ...prev, ...data }));

        if (window.location.search.includes("completed=true")) {
          const audio = new Audio(
            "https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3",
          );
          audio.volume = 0.3;
          audio.play().catch(() => {});
        }
      }
    } catch (err) {
      console.error("Summary Sync Failed", err);
    }
  };

  const buyShield = async () => {
    if (summary.totalXP < 500) return alert("Not enough XP! Need 500.");

    try {
      // 🛡️ Deduct XP and add shield in backend
      const res = await api.post("/user/buy-shield");
      if (res.data.ok) {
        // 🎉 Play a "Shield Equip" sound
        const audio = new Audio("/sounds/levelup.mp3");
        audio.play();
        fetchUserSummary(); // Refresh to see 'PROTECTED'
      }
    } catch (err) {
      console.error("Shield Purchase Failed", err);
    }
  };

  // ⚡ Real-Time Stats Refresher
  useEffect(() => {
    // 🎯 Function to fetch latest stats
    const refreshStats = async () => {
      try {
        const response = await api.get("/dashboard/summary");
        const data = response?.data ?? response;

        if (data?.ok) {
          setSummary((prev) => ({ ...prev, ...data }));
          setUserProgress(data.userProgress || {});
        }
      } catch (err) {
        console.error("Stats Refresh Failed:", err);
      }
    };

    // 🔄 Refresh whenever the user brings the tab back to focus
    window.addEventListener("focus", refreshStats);

    // Also refresh once on mount
    refreshStats();

    return () => window.removeEventListener("focus", refreshStats);
  }, []);

  // 🏆 Level Up Celebration Logic
  const handleLevelUpCelebration = () => {
    setShowLevelModal(true); // This opens the Level Up Modal we built
    import("canvas-confetti").then((confetti) => {
      confetti.default({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.6 },
        colors: ["#6366f1", "#f59e0b", "#ffffff"],
      });
    });
  };

  useEffect(() => {
    const savedLeague = localStorage.getItem("last_notified_league");
    if (user?.league && savedLeague && user.league !== savedLeague) {
      setNewLeague(user.league);
      setShowPromotion(true);
      // Play a sound effect if you have one!
    }
    if (user?.league) {
      localStorage.setItem("last_notified_league", user.league);
    }
  }, [user?.league]);

  // 🏆 VICTORY & BADGE DETECTOR
  useEffect(() => {
    // 1. Detect Level Up
    if (summary.level > prevLevel && prevLevel !== 0) {
      handleLevelUpCelebration();
    }

    // 2. Detect New Badge
    if (summary.earnedBadges?.length > prevBadgeCount && prevBadgeCount !== 0) {
      const newestBadge = summary.earnedBadges[summary.earnedBadges.length - 1];
      setUnlockedBadge(newestBadge); // Triggers the 3D Modal we built
      triggerConfetti();
    }

    // Sync the local state so we don't trigger twice
    setPrevLevel(summary.level);
    setPrevBadgeCount(summary.earnedBadges?.length || 0);
  }, [summary.level, summary.earnedBadges]);

  const triggerConfetti = () => {
    import("canvas-confetti").then((confetti) => {
      confetti.default({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    });
  };

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        const res = await api.get("/lessons");
        console.log("🛠️ API DEBUG: Lessons Received ->", res.data); // Add this!
        if (res.data && res.data.length > 0) {
          setLessons(res.data);
        }
      } catch (err) {
        console.error("MISSION CRITICAL: Lesson Fetch Failed", err);
      }
    };
    fetchLessons();
  }, []);

  useEffect(() => {
    // 🏁 If we just came back from a successful lesson
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("completed") === "true") {
      // 🎉 Trigger a manual stats refresh
      fetchUserSummary();

      // Clean up the URL so it doesn't keep refreshing
      window.history.replaceState({}, document.title, "/dashboard");
    }
  }, [location]);

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem("fj_welcome_celebrated");

    // 🎯 Trigger only if they haven't seen it and it's a "fresh" account
    if (!hasSeenWelcome && (summary.totalXP || 0) < 50) {
      const duration = 5 * 1000;
      const end = Date.now() + duration;

      (function frame() {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ["#6366f1", "#a855f7", "#ec4899"],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ["#6366f1", "#a855f7", "#ec4899"],
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();

      localStorage.setItem("fj_welcome_celebrated", "true");
    }
  }, [summary.totalXP]);

  useEffect(() => {
    const adminXP = 1100;
    // 🛡️ Use a single key to prevent double-firing
    const hasCelebratedRank = localStorage.getItem(
      "rank_up_master_celebration",
    );

    if (summary.totalXP > adminXP && !hasCelebratedRank) {
      // 🎆 WORLD-CLASS PERSISTENT CELEBRATION
      const duration = 5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = {
        startVelocity: 30,
        spread: 360,
        ticks: 60,
        zIndex: 1000,
      };

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);

        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults,
          particleCount,
          // Randomly fire from all over the screen
          origin: { x: Math.random(), y: Math.random() - 0.2 },
          // 🌈 Professional Silver & Indigo Palette
          colors: ["#6366f1", "#94a3b8", "#ffffff"],
        });
      }, 250);

      localStorage.setItem("rank_up_master_celebration", "true");
    }
  }, [summary.totalXP]);

  useEffect(() => {
    const currentLeague = getLeagueInfo(
      user?.totalXP || user?.total_xp || 0,
    ).name;
    const lastSeenLeague = localStorage.getItem("last_notified_league");

    // 🥂 THE TRIGGER: If DB league is higher than the last one we saw
    if (lastSeenLeague && currentLeague !== lastSeenLeague) {
      setCelebrationData(getLeagueInfo(user?.totalXP || user?.total_xp || 0));
      setShowCelebration(true);

      // Confetti Cannon
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#6366f1", "#a855f7", "#ec4899"],
      });
    }

    // Update memory for next time
    if (currentLeague) {
      localStorage.setItem("last_notified_league", currentLeague);
    }
  }, [user?.totalXP]);

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

  // 🎯 THE MISSING KEY: Calculate daily trial usage
  const freeLessonsUsed = useMemo(() => {
    // 1. Safety check for data
    if (!lessons || !Array.isArray(lessons)) return 0;

    // 2. Look at the first 3 lessons specifically
    const trialLessons = lessons.slice(0, 3);

    // 3. Count how many have any progress (typing, reorder, or audio > 0)
    const count = trialLessons.filter((lesson) => {
      const p = lesson.progress || {};
      return (
        Number(p.typing) > 0 || Number(p.reorder) > 0 || Number(p.audio) > 0
      );
    }).length;

    return count;
  }, [lessons]);

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

  useEffect(() => {
    if (summary.level > prevLevel && prevLevel !== 0) {
      // 🎇 MASSIVE LEVEL UP CELEBRATION
      const duration = 7 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = {
        startVelocity: 30,
        spread: 360,
        ticks: 60,
        zIndex: 1000,
      };

      const randomInRange = (min, max) => Math.random() * (max - min) + min;

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);

        const particleCount = 50 * (timeLeft / duration);
        // Fling confetti from the corners
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        });
      }, 250);

      setPrevLevel(summary.level);
      setShowLevelModal(true); // Show the Level Up Modal we built earlier
    }
  }, [summary.level]);

  useEffect(() => {
    // 🏁 Check if this is the very first time they land here
    const hasCelebrated = localStorage.getItem("fj_first_login_done");

    if (!hasCelebrated) {
      // 🎆 Side-firing "Fountain" Confetti
      const end = Date.now() + 3 * 1000;
      const colors = ["#6366f1", "#a855f7", "#ffffff"];

      (function frame() {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: colors,
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: colors,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();

      localStorage.setItem("fj_first_login_done", "true");
    }
  }, []);

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

        // 🌍 World Ranking (Top 3)
        const lbRes = await api.get("/leaderboard?period=all&limit=3");
        const lbData = lbRes?.data ?? lbRes;
        const top3 = Array.isArray(lbData?.rows) ? lbData.rows.slice(0, 3) : [];

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

          // 🎯 1. Handle Your Private History (Personal)
          if (sData.recentActivity) {
            // already merged into summary
          }

          // 🌍 2. Handle Global Community Feed (Public)
          if (sData.globalFeed) {
            setGlobalFeed(sData.globalFeed);
            console.log("🌐 Global Activity Synced:", sData.globalFeed.length);
          }
        }

        setWorldRanking(top3);
      } catch (err) {
        console.error("Dashboard Sync Error:", err);
        if (isMounted) {
          setError("Failed to sync your latest progress.");
          setWorldRanking([]);
        }
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
        streak: Number(data.streak ?? data.daily_streak ?? 0),
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

  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const progressPercent = Math.min((summary.totalXP || 0) / 1000, 1);
  const offset = circumference - progressPercent * circumference;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 md:pb-12 transition-all duration-500">
      <style>{`
        /* Target the specific top bar by its text content if needed */
        div:has(> span:contains("Dashboard")), 
        .top-navigation-bar-class-name { 
          display: none !important; 
        }
        @media (min-width: 768px) {
          div:has(> span:contains("Dashboard")) { display: flex !important; }
        }
      `}</style>
      {/* 1. ANNOUNCEMENT BANNER */}
      {auth?.user?.lastNotification && (
        <div className="bg-indigo-600 p-4 text-center text-white text-xs font-black uppercase tracking-widest animate-pulse">
          📢 {auth.user.lastNotification}
        </div>
      )}

      <header className="max-w-6xl mx-auto px-6 pt-12 flex flex-col md:flex-row justify-between items-center gap-8 relative">
        {/* 🎯 Desktop-Only Nav: Hides on Mobile */}
        <nav className="hidden md:flex absolute top-4 right-6 gap-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
          {/* 🎯 THE DASHBOARD NAV FIX (Wrapped in curly braces to prevent text leak) */}
          <button
            onClick={() =>
              navigate(
                user?.track?.toLowerCase() === "intermediate" // Changed from auth?.user to just user for consistency
                  ? "/i/lessons"
                  : "/b/lessons",
              )
            }
          >
            Lessons
          </button>
        </nav>

        <div className="flex items-center gap-6">
          <div
            className={`p-1 rounded-full transition-all duration-1000 ${(summary.xpTotal || 0) > 5000 ? "frame-silver-pro" : ""}`}
          >
            <div
              className={
                summary.totalXP > 1100 ? "rank-master-glow rounded-full" : ""
              }
            >
              <AvatarFrame
                src={auth?.user?.avatar_url}
                league={summary.league || "BRONZE"}
                size="lg"
              />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">
              Welcome back,{" "}
              <span className="text-indigo-600">
                {auth?.user?.name || auth?.user?.email.split("@")[0]}
              </span>
            </h1>
            <div className="flex gap-2 mt-2">
              <span
                className={`bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${summary.streak > 0 ? "streak-flame-active" : ""}`}
              >
                🔥 {summary.streak || 0} DAY STREAK
              </span>
              <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100 flex items-center gap-1 transition-all hover:scale-105">
                <span className="animate-pulse">⭐</span>{" "}
                {displayXP.toLocaleString()} TOTAL XP
              </span>
            </div>
          </div>
        </div>

        {/* 🛡️ Streak Freeze Shield Widget */}
        {showShieldWidget && (
          <div
            className={`p-5 rounded-[2rem] border-2 mb-4 transition-all duration-500 ${
              summary.streakFreezes > 0
                ? "bg-indigo-50 border-indigo-100 shadow-lg shadow-indigo-100/50"
                : "bg-slate-50 border-slate-100 opacity-60"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`text-2xl ${summary.streakFreezes > 0 ? "animate-bounce" : ""}`}
                >
                  {summary.streakFreezes > 0 ? "🛡️" : "🔮"}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400">
                    Streak Shield
                  </p>
                  <p
                    className={`text-xs font-black ${summary.streakFreezes > 0 ? "text-indigo-600" : "text-slate-900"}`}
                  >
                    {summary.streakFreezes > 0 ? "PROTECTED" : "INACTIVE"}
                  </p>
                </div>
              </div>
              <button
                onClick={handleBuyShield}
                disabled={isBuying}
                className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[9px] font-black hover:scale-105 transition-all disabled:opacity-50"
              >
                {isBuying
                  ? "..."
                  : summary.streakFreezes > 0
                    ? "REFILL"
                    : "BUY"}
              </button>
            </div>
          </div>
        )}

        {/* 🏆 THE GLOBAL LEADERBOARD */}
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              World Ranking
            </h3>
            <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-1 rounded-lg">
              LIVE
            </span>
          </div>

          <div className="space-y-6">
            {worldRanking.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                No ranking data yet.
              </p>
            ) : (
              worldRanking.map((player, i) => {
                const isYou =
                  Number(player?.user_id) === Number(auth?.user?.id);

                const color =
                  i === 0
                    ? "bg-amber-100 text-amber-600"
                    : i === 1
                      ? "bg-slate-200 text-slate-500"
                      : isYou
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                        : "bg-orange-100 text-orange-600";

                return (
                  <div
                    key={player?.user_id || i}
                    className="flex items-center justify-between group cursor-default"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-transform group-hover:scale-110 ${color}`}
                      >
                        {player?.rank ?? i + 1}
                      </div>
                      <span
                        className={`text-sm font-bold ${isYou ? "text-indigo-600" : "text-slate-700"}`}
                      >
                        {isYou ? "You" : player?.name || "Learner"}
                      </span>
                    </div>
                    <span className="text-[11px] font-black text-slate-400">
                      {Number(player?.xp || 0).toLocaleString()} XP
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 🎯 Dynamic League Card - League Standing */}
        {(() => {
          const league = getLeagueInfo(
            summary?.totalXP || summary?.xpTotal || 0,
          );
          return (
            <div
              className={`bg-white rounded-[2rem] p-6 border transition-all duration-700 ${league.glow}`}
            >
              <h3
                className={`text-xs font-black uppercase tracking-widest mb-4 ${league.text}`}
              >
                {league.icon} {league.name} LEAGUE STATUS
              </h3>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative w-14 h-14 flex items-center justify-center">
                    {/* ... SVG Circle Logic stays same ... */}
                    <span className="text-xl relative z-10">{league.icon}</span>
                  </div>

                  <div>
                    <p className="text-sm font-black text-slate-900">
                      {league.name === "BRONZE"
                        ? "Bronze League"
                        : `Promoted to ${league.name}!`}
                    </p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                      {leagueNudge
                        ? `Only ${leagueNudge.diff.toLocaleString()} XP to ${leagueNudge.next}`
                        : "Top Tier Achieved!"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </header>

      <div className="mt-4 bg-gradient-to-br from-slate-900 to-indigo-950 p-5 rounded-[2rem] text-white">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-3">
          {currentLeague.name} PERKS
        </h4>
        <ul className="space-y-2">
          {(Array.isArray(currentLeague?.perks) &&
          currentLeague.perks.length > 0
            ? currentLeague.perks
            : ["Keep practicing to unlock league benefits."]
          ).map((perk, i) => (
            <li key={i} className="flex items-center gap-2 text-xs font-bold">
              <span className="text-indigo-400">✦</span> {perk}
            </li>
          ))}
        </ul>
      </div>

      {leagueNudge && (
        <div className="mt-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100 animate-pulse">
          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
            Next Promotion
          </p>
          <p className="text-sm font-bold text-indigo-900 mt-1">
            Only{" "}
            <span className="text-indigo-600">
              {leagueNudge.diff.toLocaleString()} XP
            </span>{" "}
            until {leagueNudge.next}!
          </p>
          <div className="h-1.5 w-full bg-indigo-200 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-indigo-600"
              style={{ width: `${((user?.total_xp % 5000) / 5000) * 100}%` }}
            />
          </div>
        </div>
      )}

      {false && (
        <>
          {/* 📊 FIXED WEEKLY PERFORMANCE GRAPH */}
          <div className="flex items-end justify-between h-32 gap-3 px-2">
            {[
              { day: "M", xp: 45 },
              { day: "T", xp: 82 },
              { day: "W", xp: 60 },
              { day: "T", xp: 95 },
              { day: "F", xp: 70 },
              { day: "S", xp: 30 },
              { day: "S", xp: 15 },
            ].map((d, i) => (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-2 group"
              >
                <div
                  className="w-full bg-slate-100 rounded-t-xl relative overflow-hidden transition-all duration-700 hover:bg-indigo-50"
                  style={{ height: `${Math.max(d.xp || 0, 5)}%` }}
                >
                  <div className="absolute bottom-0 left-0 w-full bg-indigo-500 h-full origin-bottom" />
                </div>
                <span className="text-[9px] font-black text-slate-400">
                  {d.day}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

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

            {/* 🎯 THE DAILY TRIAL CIRCLE */}
            <div className="flex items-center gap-4 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="relative h-12 w-12">
                {/* Background Circle */}
                <svg className="h-12 w-12 transform -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    className="text-slate-200"
                  />
                  {/* Progress Circle */}
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    strokeDasharray={125.6}
                    strokeDashoffset={125.6 - 125.6 * (freeLessonsUsed / 3)}
                    className="text-indigo-600 transition-all duration-1000"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black">
                  {freeLessonsUsed}/3
                </span>
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Daily Trial
                </h4>
                <p className="text-sm font-bold text-slate-700">
                  {freeLessonsUsed === 3
                    ? "Trial finished! 🚀"
                    : "Keep going, Master!"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.isArray(lessons) && lessons.length > 0 ? (
                lessons.map((lesson, idx) => {
                  // 🛡️ Use the real progress from your API (seen in your curl output)
                  const typingProg = lesson.progress?.typing || 0;
                  const reorderProg = lesson.progress?.reorder || 0;
                  const avgProgress = Math.round(
                    (typingProg + reorderProg) / 2,
                  );
                  const isCompleted = avgProgress === 100;

                  // Unlock Lesson 1 always; others unlock if previous is > 0%
                  const lessonNum = idx + 1;

                  const storedTrack =
                    typeof window !== "undefined"
                      ? localStorage.getItem("fj_track") || ""
                      : "";

                  const pathname =
                    typeof window !== "undefined"
                      ? window.location.pathname
                      : "";

                  const resolvedTrack = pathname.startsWith("/i/")
                    ? "intermediate"
                    : pathname.startsWith("/b/")
                      ? "beginner"
                      : normalizeTrack(
                          storedTrack ||
                            auth?.user?.track ||
                            summary?.tier_level ||
                            (summary?.plan === "INTERMEDIATE"
                              ? "intermediate"
                              : "beginner"),
                        );

                  const d = resolvedTrack;
                  const isInt = resolvedTrack === "intermediate";

                  const hasPaidAccess =
                    auth?.user?.has_access === true ||
                    auth?.has_access === true ||
                    summary?.has_access === true ||
                    summary?.plan === "BEGINNER" ||
                    summary?.plan === "INTERMEDIATE" ||
                    summary?.plan === "PRO";

                  const isFreeLesson = lessonNum <= 3;

                  const isLocked = !hasPaidAccess && !isFreeLesson;

                  return (
                    <div
                      key={lesson.id || idx}
                      onClick={() => {
                        if (hasPaidAccess || isFreeLesson) {
                          navigate(
                            lessonPathForTrack(resolvedTrack, lessonNum),
                          );
                          return;
                        }

                        const plan = isInt ? "INTERMEDIATE" : "BEGINNER";
                        navigate(
                          `/paywall?plan=${encodeURIComponent(plan)}&from=lesson_${lessonNum}&difficulty=${encodeURIComponent(d)}`,
                        );
                      }}
                      className={`p-6 rounded-[2.5rem] border-2 transition-all cursor-pointer shadow-sm relative group
                            ${isLocked ? "bg-slate-50 border-slate-100 opacity-60" : "bg-white border-white hover:border-indigo-100 hover:scale-[1.02]"}`}
                    >
                      <div className="flex items-center gap-5">
                        <div
                          className={`h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-black 
                          ${isCompleted ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"}`}
                        >
                          {isLocked ? "🔒" : isCompleted ? "✓" : idx + 1}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-black text-slate-900 leading-tight mb-1">
                            {lesson.title || `Mastery ${idx + 1}`}
                          </h3>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 transition-all duration-1000"
                              style={{ width: `${avgProgress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-2 py-20 text-center">
                  <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-slate-400 font-bold italic">
                    Opening the Mastery Path...
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* 4. RIGHT COLUMN: MISSIONS & FEED */}
        <div className="space-y-8">
          <section
            className={`fj-dashboard-section mb-6 rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden transition-all duration-500 ${
              summary.missionProgress >= 3
                ? "bg-gradient-to-br from-emerald-600 to-teal-500 scale-[1.02]"
                : "bg-gradient-to-br from-slate-900 to-slate-800"
            }`}
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400">
                  Daily Mission
                </h3>

                {summary.missionProgress >= 3 ? (
                  <button
                    onClick={handleClaimBonusXP}
                    className="bg-white text-emerald-600 text-[10px] font-black px-4 py-2 rounded-full uppercase animate-bounce shadow-lg"
                  >
                    🎁 Claim 500 XP
                  </button>
                ) : (
                  <span className="text-[10px] font-bold text-slate-400">
                    +{summary.missionXpReward || 50} XP
                  </span>
                )}
              </div>
              <p className="text-sm font-bold mb-4">
                Complete 3 Practice Sessions
              </p>

              {/* Progress Bar */}
              <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full transition-all duration-1000 ${summary.missionProgress >= 3 ? "bg-white" : "bg-indigo-500"}`}
                  style={{
                    width: `${Math.min((summary.missionProgress / 3) * 100, 100)}%`,
                  }}
                />
              </div>
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
                  {/* Dynamic Avatar: Uses initials if possible */}
                  <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 shrink-0 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                    {event.userName?.charAt(0) || "M"}
                  </div>

                  <div>
                    <p className="text-xs font-black text-slate-900 uppercase tracking-tighter">
                      {event.userName} {/* 🎯 Matches backend 'userName' */}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium italic">
                      Earned {event.xp} XP in {event.type}{" "}
                      {/* 🎯 Matches backend 'xp' and 'type' */}
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
      {showLevelModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-2xl animate-in fade-in duration-500">
          <div className="bg-white rounded-[4rem] p-12 max-w-sm w-full text-center shadow-2xl border-b-8 border-indigo-600 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

            <div className="text-8xl mb-6 animate-bounce">🏆</div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">
              LEVEL UP!
            </h2>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-8">
              New Mastery Unlocked
            </p>

            <div className="flex justify-center items-center gap-4 mb-10">
              <span className="text-4xl font-black text-slate-200 line-through">
                {summary.level - 1}
              </span>
              <div className="flex flex-col items-center">
                <span className="text-6xl font-black text-indigo-600 animate-in zoom-in spin-in-12 duration-700">
                  {summary.level}
                </span>
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                  {UI_TEXT.ta.master}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowLevelModal(false)}
              className="w-full py-5 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-xl"
            >
              Keep Climbing →
            </button>
          </div>
        </div>
      )}
      {showVictoryModal && (
        <VictoryModal
          isOpen={showVictoryModal}
          xp={earnedXp}
          onNext={() => {
            setShowVictoryModal(false);
            fetchUserSummary(); // Refresh stats immediately
          }}
        />
      )}
      {/* 📱 MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 px-6 py-4 pb-8 z-[100] flex justify-between items-center shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() =>
              item.label === "My Progress" || item.label === "Profile"
                ? handleOpenProfile()
                : navigate(item.path)
            }
            className="flex flex-col items-center gap-1 group transition-all"
          >
            <span className="text-xl group-active:scale-125 transition-transform">
              {item.icon}
            </span>
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-black uppercase tracking-tighter text-slate-400 group-hover:text-indigo-600">
                {item.label === "Profile" ? UI_TEXT.en.progress : item.label}
              </span>
              {/* 🇮🇳 TAMIL SUBTEXT */}
              <span className="text-[8px] font-bold text-slate-300 -mt-0.5">
                {item.label === "Home" && UI_TEXT.ta.home}
                {item.label === "Lessons" && UI_TEXT.ta.lessons}
                {item.label === "Ranking" && UI_TEXT.ta.ranking}
                {(item.label === "Profile" || item.label === "My Progress") &&
                  UI_TEXT.ta.progress}
              </span>
            </div>
          </button>
        ))}
      </nav>
      {/* 👤 MOBILE PROFILE DRAWER */}
      {/* 🎯 Always render the drawer, but control visibility with classes */}
      <div
        className={`fixed inset-0 z-[200] transition-all duration-700 ${
          isProfileOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none delay-500"
        }`}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-700 ${isProfileOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setIsProfileOpen(false)}
        />

        {/* The Actual Drawer */}
        {/* The Panel */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-[3rem] p-8 pb-12 shadow-[0_-20px_40px_rgba(0,0,0,0.1)] transition-transform duration-700 ease-in-out transform ${isProfileOpen ? "translate-y-0" : "translate-y-full"}`}
        >
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-8" />

          <div className="flex flex-col items-center text-center">
            <div className="relative w-32 h-32 mb-6 flex items-center justify-center">
              {/* 🎡 ANIMATED PRESTIGE RING */}
              <svg
                className="absolute inset-0 w-full h-full -rotate-90"
                viewBox="0 0 100 100"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="transparent"
                  stroke="#f1f5f9"
                  strokeWidth="4"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="transparent"
                  stroke="#6366f1"
                  strokeWidth="4"
                  strokeDasharray="289"
                  /* 🎯 Animation Logic: Starts at 289 (empty) and transitions to value */
                  strokeDashoffset={
                    isProfileOpen
                      ? 289 - Math.min((summary.totalXP % 1000) / 1000, 1) * 289
                      : 289
                  }
                  strokeLinecap="round"
                  className="transition-all duration-[1500ms] ease-out delay-300"
                />
              </svg>

              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-xl relative z-10">
                <img
                  src={auth?.user?.avatar_url}
                  className="w-full h-full object-cover"
                  alt="Profile"
                />
              </div>
            </div>

            <h2 className="text-2xl font-black text-slate-900">
              {auth?.user?.name}
            </h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
              Level {summary.level} {UI_TEXT.en.master} • {UI_TEXT.ta.master}
            </p>

            {/* 🔥 Pulsing Streak Flame Inserted Here */}
            <div className="flex items-center gap-4 bg-orange-50 p-6 rounded-[2rem] w-full mb-6 border border-orange-100">
              <div className="relative">
                <span className="text-4xl animate-pulse">🔥</span>
                <div className="absolute inset-0 bg-orange-400 blur-xl opacity-20 animate-ping rounded-full" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest leading-none mb-1">
                  {UI_TEXT.en.streak} • {UI_TEXT.ta.streak}
                </p>
                <p className="text-xl font-black text-orange-600">
                  {summary.streak || 1} {summary.streak === 1 ? "DAY" : "DAYS"}
                </p>
              </div>
            </div>

            {/* 🎯 DAILY MISSION TRACKER */}
            <div className="w-full bg-slate-50 border border-slate-100 rounded-[2rem] p-6 mb-8">
              <div className="flex justify-between items-center mb-4">
                <div className="text-left">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                    {UI_TEXT.en.dailyGoal} • {UI_TEXT.ta.dailyGoal}
                  </p>
                  <h4 className="text-sm font-black text-slate-900">
                    {UI_TEXT.en.finishLessons}
                  </h4>
                </div>
                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                  +50 XP
                </span>
              </div>

              {/* 📈 The Progress Bar */}
              <div className="relative h-4 w-full bg-slate-200 rounded-full overflow-hidden mb-2">
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-1000 ease-out"
                  style={{
                    width: `${Math.min(((summary.todayLessons || 0) / 3) * 100, 100)}%`,
                  }}
                />
              </div>

              <div className="flex justify-between items-center">
                <p className="text-[10px] font-bold text-slate-400">
                  {summary.todayLessons || 0} / 3 Completed
                </p>
                {summary.todayLessons >= 3 && (
                  <span className="text-[10px] font-black text-emerald-500 animate-bounce">
                    MISSION COMPLETE! ✅
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full mb-8">
              <div className="bg-slate-50 p-4 rounded-2xl text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase">
                  Total XP
                </p>
                <p className="text-lg font-black text-indigo-600">
                  ⭐ {summary.totalXP}
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase">
                  League
                </p>
                <p className="text-lg font-black text-amber-600">🥉 Bronze</p>
              </div>
            </div>

            {/* 🎖️ BADGE GALLERY */}
            <div className="w-full mb-10">
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  My Medals
                </h3>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                  {summary.earnedBadges?.length || 1} Unlocked
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    id: "streak_7",
                    icon: "🔥",
                    label: "7 Day Warrior",
                    locked: summary.streak < 7,
                  },
                  {
                    id: "xp_100k",
                    icon: "💎",
                    label: "100K Club",
                    locked: (summary.totalXP || 0) < 100000,
                  },
                  {
                    id: "lesson_50",
                    icon: "🎯",
                    label: "Half Century",
                    locked: (summary.completedLessons || 0) < 50,
                  },
                  {
                    id: "first_shield",
                    icon: "🛡️",
                    label: "Protected",
                    locked: (summary.streakFreezes || 0) === 0,
                  },
                  {
                    id: "night_owl",
                    icon: "🦉",
                    label: "Night Owl",
                    locked: true,
                  }, // For future logic
                  {
                    id: "early_bird",
                    icon: "🌅",
                    label: "Early Bird",
                    locked: true,
                  }, // For future logic
                ].map((badge) => (
                  <div
                    key={badge.id}
                    className="flex flex-col items-center gap-2"
                  >
                    <div
                      className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl transition-all duration-500 border-2 ${
                        badge.locked
                          ? "bg-slate-50 border-slate-100 grayscale opacity-40"
                          : "bg-white border-indigo-100 shadow-lg shadow-indigo-100/50 scale-110"
                      }`}
                    >
                      {badge.icon}
                    </div>
                    <span
                      className={`text-[8px] font-black uppercase tracking-tighter text-center leading-tight ${
                        badge.locked ? "text-slate-300" : "text-indigo-600"
                      }`}
                    >
                      {badge.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setIsProfileOpen(false)}
              className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-transform"
            >
              {UI_TEXT[currentLang].close}
            </button>
          </div>
        </div>
      </div>
      {unlockedBadge && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-slate-900/95 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="bg-white rounded-[4rem] p-12 max-w-sm w-full text-center shadow-2xl relative overflow-hidden animate-in zoom-in duration-700">
            {/* 🎇 Confetti Background */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <div className="absolute top-10 left-10 text-4xl animate-bounce">
                ✨
              </div>
              <div className="absolute bottom-10 right-10 text-4xl animate-bounce delay-300">
                ✨
              </div>
            </div>

            <div className="text-8xl mb-8 animate-in spin-in-180 duration-1000">
              {unlockedBadge.icon}
            </div>

            <h2 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] mb-2">
              {UI_TEXT.en.newAchievement} • {UI_TEXT.ta.newAchievement}
            </h2>
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-6">
              {unlockedBadge.label}
            </h3>

            <p className="text-slate-400 text-xs font-bold leading-relaxed mb-10 px-4">
              You've officially joined the elite ranks of FluencyJet! Keep
              pushing your boundaries.
            </p>

            <button
              onClick={() => setUnlockedBadge(null)}
              className="w-full py-5 rounded-3xl bg-indigo-600 text-white font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
            >
              Collect Reward →
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
        {showPromotion && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/90 backdrop-blur-xl p-6">
            <div className="text-center animate-in zoom-in duration-500">
              <div className="text-8xl mb-6">💎</div>
              <h2 className="text-5xl font-black text-white mb-2">PROMOTED!</h2>
              <p className="text-indigo-300 text-xl font-bold uppercase tracking-widest mb-8">
                Welcome to the {newLeague} Family
              </p>
              <button
                onClick={() => setShowPromotion(false)}
                className="px-12 py-4 bg-white text-indigo-600 rounded-full font-black text-lg shadow-2xl hover:scale-105 transition-transform"
              >
                Continue My Journey
              </button>
            </div>
          </div>
        )}
        {showCelebration && celebrationData && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/90 backdrop-blur-2xl p-6">
            <div className="text-center animate-in zoom-in duration-500 max-w-sm">
              <div className="text-9xl mb-6 drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]">
                {celebrationData.icon}
              </div>
              <h2 className="text-5xl font-black text-white mb-2 tracking-tighter">
                PROMOTED!
              </h2>
              <p className="text-indigo-300 text-xl font-bold uppercase tracking-widest mb-8">
                Welcome to {celebrationData.name} League
              </p>
              <button
                onClick={() => setShowCelebration(false)}
                className="w-full py-4 bg-white text-indigo-600 rounded-2xl font-black text-lg shadow-2xl hover:scale-105 active:scale-95 transition-all"
              >
                Continue My Journey
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
}
