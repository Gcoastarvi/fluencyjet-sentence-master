//client/src/pages/student/LessonDetail.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { api } from "../../api/apiClient";

import { LESSON_TEACH } from "../../content/lessonTeach";

import { MODE_UI, uiFor } from "../../lib/modeUi";

import { track } from "../../lib/track";

import { toPng } from "html-to-image";

import AchievementCard from "@/components/student/AchievementCard";
import Certificate from "@/components/student/Certificate";

import confetti from "canvas-confetti";

import { useAuth } from "../../context/AuthContext";

import { readProgress, pct } from "@/lib/progressStore";

// Audio v1 can be turned on later without refactor:
const ENABLE_AUDIO = true;
const ENABLE_CLOZE = false; // keep off unless you really have cloze exercises

const modeEnabled = (mode, modeAvail) => {
  if (mode === "audio") return ENABLE_AUDIO && modeAvail.audio;
  if (mode === "cloze") return ENABLE_CLOZE && modeAvail.cloze;
  if (mode === "typing") return modeAvail.typing;
  if (mode === "reorder") return modeAvail.reorder;
  return false;
};

const MODE_CONFIG = {
  reorder: {
    title: uiFor("reorder").title,
    sub: "Think Fast & Smart",
    tamil: "வேகமாக சிந்திக்க",
    icon: "⚡",
  },
  typing: {
    title: uiFor("typing").title,
    sub: "Office Writing Pro",
    tamil: "அலுவலக எழுத்துமுறை",
    icon: "⌨️",
  },
  audio: {
    title: uiFor("audio").title,
    sub: "Speak with Confidence",
    tamil: "சரளமாக பேச",
    icon: "🎧",
  },
};

const LAST_SESSION_KEY = "fj_last_session";

function getDayNumberFromLesson(lesson) {
  // Prefer explicit dayNumber if it exists
  const direct =
    lesson?.dayNumber ?? lesson?.day_number ?? lesson?.practiceDayNumber;
  if (Number.isFinite(Number(direct)) && Number(direct) > 0)
    return Number(direct);

  // Fallback: parse last number in slug like "intermediate-13", "basic-2"
  const slug = String(lesson?.slug || lesson?.lessonSlug || "");
  const m = slug.match(/(\d+)(?!.*\d)/);
  if (m) return Number(m[1]);

  // Last resort: try from title
  const title = String(lesson?.title || lesson?.lessonTitle || "");
  const t = title.match(/(\d+)(?!.*\d)/);
  if (t) return Number(t[1]);

  return null;
}

// 🎯 1. Calculate the overall mastery percentage
// 🎯 1. Consolidate the data check (Safe Naming)
const currentData =
  typeof lessonData !== "undefined"
    ? lessonData
    : typeof lesson !== "undefined"
      ? lesson
      : null;

// 🎯 2. Safe progress extraction
const progress = currentData?.progress || { typing: 0, reorder: 0, audio: 0 };

// 🎯 3. Calculate Mastery (Only once!)
const overallDone = Math.round(
  (Number(progress.typing || 0) +
    Number(progress.reorder || 0) +
    Number(progress.audio || 0)) /
    3,
);

function getDifficultyFromLesson(lesson) {
  // Prefer API field
  const raw = String(
    lesson?.difficulty ||
      lesson?.level ||
      lesson?.lessonLevel ||
      lesson?.lesson_level ||
      "",
  ).toLowerCase();

  // Normalize
  if (raw.includes("intermediate")) return "intermediate";

  // Treat "basic" as beginner track (MVP choice)
  if (raw.includes("basic")) return "beginner";

  return "beginner";
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function getShowTaDefault(dayNumber) {
  // simple default: beginner lessons show Tamil help
  if (!dayNumber) return true;
  return dayNumber <= 3;
}

function readPrefShowTa(dayNumber) {
  const raw = localStorage.getItem(PREF_KEY_SHOW_TA);
  if (raw === "1") return true;
  if (raw === "0") return false;
  return getShowTaDefault(dayNumber);
}

function writePrefShowTa(v) {
  localStorage.setItem(PREF_KEY_SHOW_TA, v ? "1" : "0");
}

function readLastSession() {
  return safeJsonParse(localStorage.getItem(LAST_SESSION_KEY) || "null");
}

function formatLast(ms) {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 24 * 60 * 60_000)
    return `${Math.floor(diff / (60 * 60_000))}h ago`;
  return `${Math.floor(diff / (24 * 60 * 60_000))}d ago`;
}

function modeLabel(m) {
  if (!m) return "";
  const x = String(m).toLowerCase();

  // Use single source of truth for known practice modes
  const ui = uiFor(x);
  if (ui && ui.title) return ui.title;

  // Fallback for unexpected strings
  return x.charAt(0).toUpperCase() + x.slice(1);
}

export default function LessonDetail() {
  // 1. ALL HOOKS (Only once!)
  const { lessonId: lessonIdParam, lid } = useParams();
  const { auth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // 2. IDENTITY & DIFFICULTY (The "Intermediate" Fix)
  const difficulty = window.location.pathname.includes("/i/")
    ? "intermediate"
    : "beginner";
  const dayNumber = Number(lessonIdParam || lid || 1);
  const lessonId = String(dayNumber);
  const displayNum = location.state?.lessonNumber || dayNumber;

  console.log("🕵️ LessonDetail Context:", { dayNumber, difficulty });

  // 3. USER CONTEXT (The Logic you need to keep)
  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  })();

  const progressUserId =
    auth?.user?.id ||
    auth?.user?.email ||
    auth?.id ||
    auth?.email ||
    storedUser?.id ||
    storedUser?.email ||
    null;

  // 🎯 2. State MUST be second
  const [lessonData, setLessonData] = useState(null);
  const [lesson, setLesson] = useState(location.state?.lesson || null);

  // 🎯 3. Calculated Variables (Safe now because State is defined)
  const currentData = lessonData || lesson || null;
  const progress = currentData?.progress || { typing: 0, reorder: 0, audio: 0 };
  const overallDone = Math.round(
    (Number(progress.typing || 0) +
      Number(progress.reorder || 0) +
      Number(progress.audio || 0)) /
      3,
  );

  const [isSharing, setIsSharing] = useState(false);
  const [missedBanner, setMissedBanner] = useState(null);

  useEffect(() => {
    // 🥂 THE PERSONALIZED WELCOME HOOK
    const rawUser = localStorage.getItem("user");
    if (rawUser) {
      try {
        const user = JSON.parse(rawUser);
        if (user.name) {
          // 🎯 This shows a real popup to the user
          alert(`Welcome, ${user.name}! Coach Aravind is ready for you.`);
        }
      } catch (e) {
        console.error("User data parse error");
      }
    }
  }, []);

  // 🎯 4. Effects (The Actions)
  useEffect(() => {
    if (overallDone === 100) {
      // Confetti Cannon Logic
      const duration = 3 * 1000;
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

      // Also trigger the Bonus XP write-back here if needed
      if (typeof triggerBonusCelebration === "function")
        triggerBonusCelebration();
    }
  }, [overallDone]);

  const lessonIdNum = dayNumber;

  // 150: Image Generation Handlers
  const handleShare = async (avg) => {
    const node = document.getElementById("achievement-canvas");
    if (!node || isSharing) return;
    setIsSharing(true);
    try {
      const dataUrl = await toPng(node, { quality: 1.0, pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `FluencyJet-Mastery-Lesson-${dayNumber}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Share failed:", err);
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownloadCertificate = async () => {
    const node = document.getElementById("certificate-canvas");
    if (!node) return;
    try {
      const dataUrl = await toPng(node, { quality: 1.0, pixelRatio: 3 });
      const link = document.createElement("a");
      link.download = `FluencyJet-Certificate-${userProfile?.name || "Student"}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Certificate generation failed:", err);
    }
  };

  const [showMoreModes, setShowMoreModes] = useState(false);

  useEffect(() => {
    setShowMoreModes(false);
  }, [lessonIdNum, difficulty]);

  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const [smartStarting, setSmartStarting] = useState(false);
  const [smartStartMsg, setSmartStartMsg] = useState("");

  const [showTamilHelp, setShowTamilHelp] = useState(false);

  // 🎯 OPTION A: 3 LESSONS FREE
  const isLocked = auth?.user?.has_access === false && dayNumber > 3;

  useEffect(() => {
    // 🏆 Trigger celebration only when they reach 100%
    if (overallDone === 100) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min, max) => Math.random() * (max - min) + min;

      const interval = setInterval(function () {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        // Since they're confused, they might fly off-screen, so we launch from two sides
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
    }
  }, [overallDone]); // 🎯 Re-run only when the progress hits 100

  useEffect(() => {
    track("lesson_hub_view", { lessonId: Number(dayNumber) || 0, difficulty });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayNumber, difficulty]);

  // 192: Add state for User Metadata
  const [userProfile, setUserProfile] = useState(null);

  // 194: Fetch user profile on mount
  useEffect(() => {
    async function fetchUser() {
      try {
        const userRes = await api.get("/auth/me");
        // check for .data because apiClient usually wraps the response
        if (userRes?.data?.user || userRes?.user) {
          setUserProfile(userRes.data?.user || userRes.user);
        }
      } catch (err) {
        console.error("Failed to fetch user profile:", err);
      }
    }
    fetchUser();
  }, []);

  // Fallback: if page is hard-refreshed and no state.lesson, try to fetch lesson list and locate this lesson
  useEffect(() => {
    let cancelled = false;
    async function loadFallback() {
      if (lesson) return;

      try {
        const res = await fetch("/api/lessons", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();

        // data may be { lessons: [...] } or just [...]
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.lessons)
            ? data.lessons
            : [];

        const found =
          // ✅ preferred: dayNumber-like fields
          list.find((l) => String(l?.dayNumber) === String(dayNumber)) ||
          list.find((l) => String(l?.day_number) === String(dayNumber)) ||
          list.find(
            (l) => String(l?.practiceDayNumber) === String(dayNumber),
          ) ||
          list.find(
            (l) => String(l?.practice_day_number) === String(dayNumber),
          ) ||
          // ✅ fallback: parse trailing number from slug like intermediate-13
          list.find((l) => {
            const slug = String(l?.slug || l?.lessonSlug || "");
            const m = slug.match(/(\d+)(?!.*\d)/);
            return m ? Number(m[1]) === Number(dayNumber) : false;
          }) ||
          null;

        if (!cancelled) setLesson(found);
      } catch {
        // silent: we can still render minimal UI
      }
    }

    loadFallback();
    return () => {
      cancelled = true;
    };
  }, [lesson, dayNumber]);

  const title =
    lesson?.lessonTitle ||
    lesson?.title ||
    lesson?.name ||
    `Lesson ${dayNumber || ""}`;

  const [modeAvail, setModeAvail] = useState({
    typing: false,
    reorder: false,
    audio: false,
    cloze: false,
  });
  const [checkingModes, setCheckingModes] = useState(true);

  const noModes =
    !checkingModes &&
    !modeAvail.typing &&
    !modeAvail.reorder &&
    !modeAvail.audio &&
    !modeAvail.cloze;

  useEffect(() => {
    const lid = Number(dayNumber);
    if (!lid || lid <= 1) {
      setMissedBanner(null);
      return;
    }

    const prev = lid - 1;

    // Optional: respect dismissal for this current lesson for 7 days
    const dismissKey = `fj_dismiss_missed:${lid}`;
    const dismissedAt = Number(localStorage.getItem(dismissKey) || "0");
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (dismissedAt && Date.now() - dismissedAt < sevenDays) {
      setMissedBanner(null);
      return;
    }

    const modes = ["typing", "reorder", "audio"];
    const missing = [];
    let anyProgressFound = false;

    for (const m of modes) {
      const key = `fj_progress:${prev}:${m}`;
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      anyProgressFound = true;

      try {
        const obj = JSON.parse(raw);
        if (!obj?.completed) missing.push(m);
      } catch {
        // corrupted JSON shouldn't crash UI
        missing.push(m);
      }
    }

    // If user never touched the previous lesson, don't nudge.
    if (!anyProgressFound || missing.length === 0) {
      setMissedBanner(null);
      return;
    }

    const label = missing
      .map((m) => (m === "audio" ? "Audio" : m[0].toUpperCase() + m.slice(1)))
      .join(", ");

    setMissedBanner({
      prevLessonId: prev,
      missingModes: missing,
      missingModesLabel: label,
      dismissKey,
    });
  }, [dayNumber]);

  // Continue session (supports typing/reorder, and audio later)
  const session = useMemo(() => {
    if (!lessonId) return null;
    const s = readLastSession();
    if (!s) return null;

    const m = String(s.mode || "").toLowerCase();
    const allowed = ["typing", "reorder", "cloze", "audio"];
    if (!allowed.includes(m)) return null;

    const sameLesson = Number(s.lessonId) === Number(dayNumber);
    if (!sameLesson) return null;

    const sameDiff =
      String(s.difficulty || "").toLowerCase() ===
      String(difficulty).toLowerCase();
    if (!sameDiff) return null;

    if (m === "audio" && !ENABLE_AUDIO) return null;
    if (m === "cloze" && !ENABLE_CLOZE) return null;

    return s;
  }, [lessonId]);

  const typingProg = useMemo(
    () => (lessonId ? readProgress(progressUserId, lessonId, "typing") : null),
    [progressUserId, lessonId],
  );
  const reorderProg = useMemo(
    () => (lessonId ? readProgress(progressUserId, lessonId, "reorder") : null),
    [progressUserId, lessonId],
  );
  const clozeProg = useMemo(
    () => (lessonId ? readProgress(progressUserId, lessonId, "cloze") : null),
    [progressUserId, lessonId],
  );
  const audioProg = useMemo(
    () => (lessonId ? readProgress(progressUserId, lessonId, "audio") : null),
    [progressUserId, lessonId],
  );

  // 🏆 World-Class Achievement Math (Global Scope within component)
  const overallAvg = useMemo(() => {
    const pts = [
      modeAvail.typing ? pct(typingProg) : null,
      modeAvail.reorder ? pct(reorderProg) : null,
      ENABLE_AUDIO && modeAvail.audio ? pct(audioProg) : null,
    ].filter((x) => typeof x === "number");
    return pts.length
      ? Math.round(pts.reduce((a, b) => a + b, 0) / pts.length)
      : 0;
  }, [typingProg, reorderProg, audioProg, modeAvail]);

  const totalXP = useMemo(() => {
    // Basic math: 150XP per completed mode
    let count = 0;
    if (pct(typingProg) === 100) count += 150;
    if (pct(reorderProg) === 100) count += 150;
    if (pct(audioProg) === 100) count += 150;
    return count;
  }, [typingProg, reorderProg, audioProg]);

  // Auto-open modes once user has any progress (prevents overwhelm for brand-new users)
  const didAutoOpenModesRef = useRef(false);

  useEffect(() => {
    if (didAutoOpenModesRef.current) return;

    const hasProgress =
      Number(typingProg?.completed || 0) > 0 ||
      Number(reorderProg?.completed || 0) > 0 ||
      Number(audioProg?.completed || 0) > 0 ||
      Number(clozeProg?.completed || 0) > 0;

    if (hasProgress) {
      didAutoOpenModesRef.current = true;
      setShowMoreModes(true);
    }
  }, [typingProg, reorderProg, audioProg, clozeProg]);

  function isIncomplete(prog) {
    if (!prog) return false;
    const total = Number(prog.total || 0);
    const completed = Number(prog.completed || 0);
    if (total <= 0) return false; // if no items, don ��t nag
    return completed < total;
  }

  // --- Safe Continue (guards stale session + adds q=) ---
  const totalsByMode = {
    typing: Number(typingProg?.total || 0),
    reorder: Number(reorderProg?.total || 0),
    cloze: ENABLE_CLOZE ? Number(clozeProg?.total || 0) : 0,
    audio: ENABLE_AUDIO ? Number(audioProg?.total || 0) : 0,
  };

  const normalizedSession = (() => {
    if (!session) return null;

    const m = String(session?.mode || "").toLowerCase();
    const idx = Number(session?.questionIndex);

    // mode gate
    if (!["typing", "reorder", "cloze", "audio"].includes(m)) return null;
    if (m === "audio" && !ENABLE_AUDIO) return null;
    if (m === "cloze" && !ENABLE_CLOZE) return null;

    // difficulty gate
    const sameDiff =
      String(session?.difficulty || "").toLowerCase() ===
      String(difficulty).toLowerCase();
    if (!sameDiff) return null;

    // index gate
    if (!Number.isFinite(idx) || idx < 0) return null;

    // If we know total, enforce bounds. If we don't, still allow resume.
    const total = Number(totalsByMode[m] || 0);
    if (total > 0 && idx >= total) return null;

    return { mode: m, questionIndex: idx, total, variant: session?.variant };
  })();

  const qNum =
    normalizedSession && typeof normalizedSession.questionIndex === "number"
      ? normalizedSession.questionIndex + 1
      : null;

  const continueText =
    normalizedSession && qNum
      ? `Continue • ${modeLabel(normalizedSession.mode)} • Q${qNum}`
      : "Continue";

  const canContinue =
    normalizedSession &&
    typeof normalizedSession.questionIndex === "number" &&
    Number.isFinite(normalizedSession.questionIndex) &&
    normalizedSession.questionIndex >= 0;

  const continueHref =
    canContinue && dayNumber
      ? `/practice/${normalizedSession.mode}?lessonId=${encodeURIComponent(dayNumber)}&difficulty=${encodeURIComponent(difficulty)}&q=${encodeURIComponent(normalizedSession.questionIndex)}${
          normalizedSession.mode === "audio" && normalizedSession.variant
            ? `&variant=${encodeURIComponent(normalizedSession.variant)}`
            : ""
        }`
      : null;

  function goPaywall() {
    // 🎯 THE TRACK PRESERVER
    const plan = difficulty?.toUpperCase() || "BEGINNER";
    const from = `lesson_${dayNumber}`;

    navigate(`/paywall?plan=${plan}&from=${from}&difficulty=${difficulty}`);
  }

  console.log("[LessonDetail progress debug]", {
    progressUserId,
    dayNumber,
    lessonId,
    typingProg,
    reorderProg,
    audioProg,
    storedUser: (() => {
      try {
        return JSON.parse(localStorage.getItem("user") || "null");
      } catch {
        return null;
      }
    })(),
    progressKeys: Object.keys(localStorage)
      .filter((k) => k.startsWith("fj_progress"))
      .sort(),
  });

  async function startMode(mode) {
    // 🎯 Added async here
    setShowMoreModes(false);
    if (!lessonId) return;
    if (isLocked) return goPaywall();

    // Check if the mode actually has exercises before navigating
    const ok = await hasExercises(dayNumber, mode, difficulty); // 🎯 Now await is valid
    if (!ok) {
      alert("This mode is coming soon for this lesson!");
      return;
    }

    if (mode === "audio" && !ENABLE_AUDIO) return;
    if (mode === "cloze" && !ENABLE_CLOZE) return;

    track("mode_card_clicked", {
      lessonId: Number(dayNumber) || 0,
      difficulty,
      mode,
    });

    const lid = Number(dayNumber);

    if (mode === "audio") {
      navigate(
        `/practice/audio?lessonId=${encodeURIComponent(
          lid,
        )}&difficulty=${encodeURIComponent(
          difficulty,
        )}&variant=repeat&q=0&restart=${Date.now()}`,
      );
      return;
    }

    // 🎯 Ensure 'difficulty' is passed to the practice engine
    navigate(
      `/practice/${mode}?lessonId=${encodeURIComponent(lid)}&difficulty=${difficulty}&q=0&restart=${Date.now()}`,
    );
  }

  function dismissMissedBanner() {
    if (!missedBanner?.dismissKey) return;
    localStorage.setItem(missedBanner.dismissKey, String(Date.now()));
    setMissedBanner(null);
  }

  function goToPrevLessonHub() {
    if (!missedBanner?.prevLessonId) return;
    navigate(
      `/b/lesson/${missedBanner.prevLessonId}?difficulty=${encodeURIComponent(difficulty)}`,
    );
  }

  function getNextRecommendedMode() {
    // If Continue exists, we don't recommend a "next" (Continue wins)
    if (continueHref) return null;

    // Reorder-first = lowest friction quick win
    if (modeAvail?.reorder && isIncomplete(reorderProg)) return "reorder";
    if (modeAvail?.typing && isIncomplete(typingProg)) return "typing";
    if (modeAvail?.audio && isIncomplete(audioProg)) return "audio";

    // Fallback: first available
    if (modeAvail?.reorder) return "reorder";
    if (modeAvail?.typing) return "typing";
    if (modeAvail?.audio) return "audio";
    return null;
  }

  const recommendedMode = getNextRecommendedMode();

  const isRec = (m) =>
    !continueHref && !!recommendedMode && recommendedMode === m;

  async function hasExercises(lid, mode, diff) {
    try {
      const res = await api.get(
        `/quizzes/by-lesson/${lid}?mode=${encodeURIComponent(
          mode,
        )}&difficulty=${encodeURIComponent(diff || "beginner")}`,
        { credentials: "include" },
      );

      // ✅ apiClient returns JSON directly (not axios response)
      const data = res?.data ?? res;

      if (!data || data.ok !== true) return false;

      const exercises = Array.isArray(data.exercises) ? data.exercises : [];
      return exercises.length > 0;
    } catch (e) {
      const status = e?.response?.status ?? e?.status ?? null;
      const data = e?.response?.data ?? e?.data ?? null;

      if (status === 401) {
        const next = `/lesson/${encodeURIComponent(lid)}?difficulty=${encodeURIComponent(
          diff || "beginner",
        )}`;
        navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true });
        return "AUTH";
      }

      // 🎯 Added a safety check for Lesson 1-3
      if (
        status === 403 &&
        data?.code === "PAYWALL" &&
        parseInt(lessonId) > 3
      ) {
        const action = data?.nextAction || null;
        const from = action?.from || `lesson_${lid}`;
        const base = action?.url || `/paywall?plan=BEGINNER`;
        const sep = String(base).includes("?") ? "&" : "?";
        const target = `${base}${sep}from=${encodeURIComponent(from)}`;
        navigate(target, { replace: true });
        return "PAYWALL";
      }

      return false;
    }
  }

  useEffect(() => {
    let alive = true;

    async function check() {
      const lid = Number(dayNumber);

      // If no valid lessonId -> reset and stop
      if (!lid) {
        if (!alive) return;
        setModeAvail({
          typing: false,
          reorder: false,
          audio: false,
          cloze: false,
        });
        setCheckingModes(false);
        return;
      }

      setCheckingModes(true);

      try {
        const [typingOk, reorderOk, audioOk, clozeOk] = await Promise.all([
          hasExercises(lid, "typing", difficulty),
          hasExercises(lid, "reorder", difficulty),
          hasExercises(lid, "audio", difficulty),
          ENABLE_CLOZE
            ? hasExercises(lid, "cloze", difficulty)
            : Promise.resolve(false),
        ]);

        // If auth/paywall happened during checks, stop (navigation already triggered)
        if (
          typingOk === "AUTH" ||
          typingOk === "PAYWALL" ||
          reorderOk === "AUTH" ||
          reorderOk === "PAYWALL" ||
          audioOk === "AUTH" ||
          audioOk === "PAYWALL" ||
          clozeOk === "AUTH" ||
          clozeOk === "PAYWALL"
        ) {
          return;
        }

        if (!alive) return;

        setModeAvail({
          typing: typingOk === true,
          reorder: reorderOk === true,
          audio: audioOk === true,
          cloze: clozeOk === true,
        });
      } finally {
        if (!alive) return;
        setCheckingModes(false);
      }
    }

    check();

    return () => {
      alive = false;
    };
  }, [dayNumber]); // keep minimal deps

  // --- 🏆 Mastery Celebration Helper ---
  const triggerBonusCelebration = async () => {
    // 1. 🎊 Trigger the confetti burst (using the global hook)
    if (typeof triggerConfetti === "function") {
      triggerConfetti();
    }

    // 2. 🔊 Audio Dopamine
    try {
      const audio = new Audio(
        "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3",
      );
      audio.volume = 0.4;
      audio.play();
    } catch (e) {
      /* Browser blocked audio */
    }

    // 3. 🚀 Persistent XP Write-back
    try {
      await api.post("/user/award-bonus", {
        xpAmount: 100,
        reason: "Daily Goal Mastered",
      });
      console.log("🏆 Bonus XP saved to database!");
    } catch (err) {
      console.error("❌ XP Write-back failed:", err);
    }
  };

  // 695: Trigger Mastery Celebration & Cloud Push
  useEffect(() => {
    const pts = [
      modeAvail.typing ? pct(typingProg) : null,
      modeAvail.reorder ? pct(reorderProg) : null,
      ENABLE_AUDIO && modeAvail.audio ? pct(audioProg) : null,
    ].filter((x) => typeof x === "number");

    const overallAvg = pts.length
      ? Math.round(pts.reduce((a, b) => a + b, 0) / pts.length)
      : 0;

    if (overallAvg === 100 && hasLoadedOnce) {
      // 1. Visual Celebration
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.7 },
        colors: ["#f97316", "#fbbf24", "#ffffff"],
      });

      const sound = new Audio("/sounds/levelup.mp3");
      sound.volume = 0.4;
      sound.play().catch(() => {});

      // 2. 🚀 Push Mastery Event to Railway
      api
        .post("/quizzes/sync-mastery", {
          lessonId: Number(dayNumber),
          level: difficulty.toUpperCase(),
          xpDelta: 150, // 👈 Explicitly passing XP for the event log
        })
        .then((res) => {
          console.log("[CLOUD] Mastery achievement synced to PostgreSQL");

          // 🎯 PERFECT STREAK BONUS LOGIC
          const newProgress = res.data?.newProgress || 0;
          if (newProgress >= 100) {
            // 1. Award +100 Bonus XP
            api
              .post("/xp/bonus", {
                amount: 100,
                reason: "PERFECT_MASTERY",
                lessonId: Number(dayNumber),
              })
              .catch((e) => console.error("Bonus failed", e));

            // 2. Trigger the celebration (Dopamine Injector)
            if (typeof triggerBonusCelebration === "function") {
              // 🎯 This line "reads" the value, clearing the TypeScript error
              triggerBonusCelebration();
            } else {
              // Fallback if the helper is out of reach
              if (typeof triggerConfetti === "function") triggerConfetti();
              alert("PERFECT STREAK! 🏆 +100 Bonus XP awarded!");
            }
          }

          // 🚩 3. Set the trigger for the Lessons list popup
          localStorage.setItem("fj_show_mastery_popup", dayNumber);
        })
        .catch((err) => {
          console.error("[CLOUD] Mastery sync failed:", err);
        });
    }
  }, [
    typingProg,
    reorderProg,
    audioProg,
    modeAvail,
    hasLoadedOnce,
    dayNumber,
    difficulty,
  ]);

  async function smartStart() {
    // 1. Core Invariants (Keep your safety guards)
    if (!lessonId) return;
    if (isLocked) return goPaywall();

    // 2. Priority 1: Resume an existing session
    if (continueHref) {
      track("continue_clicked", {
        lessonId: Number(dayNumber),
        difficulty,
        mode: normalizedSession?.mode || session?.mode || null,
      });
      navigate(continueHref);
      return;
    }

    setSmartStarting(true);
    setSmartStartMsg("");

    try {
      // 3. Priority 2: The "Mastery Path" Logic
      // We look for the first mode that is NOT 100% complete
      const path = [
        { id: "reorder", current: pct(reorderProg) },
        { id: "typing", current: pct(typingProg) },
        { id: "audio", current: pct(audioProg) },
      ];

      // Find the first one below 100%
      const nextBest = path.find((m) => m.current < 100) || path[0];

      // 4. Verification: Ensure the mode actually has content
      const ok = await hasExercises(dayNumber, nextBest.id, difficulty);

      if (ok === "AUTH" || ok === "PAYWALL") return;

      if (ok) {
        track("start_practice_clicked", {
          lessonId: Number(lessonId),
          difficulty,
          mode: nextBest.id,
          autoSelected: true,
        });

        navigate(
          `/practice/${nextBest.id}?lessonId=${encodeURIComponent(dayNumber)}&difficulty=${encodeURIComponent(difficulty)}`,
        );
      } else {
        // Fallback if the "best" mode is empty for some reason
        setSmartStartMsg("No practice items found for the recommended mode.");
      }
    } catch (err) {
      console.error("SmartStart Error:", err);
    } finally {
      setSmartStarting(false);
    }
  }

  useEffect(() => {
    const a = searchParams.get("autostart");
    if (a !== "1") return;

    // Remove autostart so refresh/back doesn't auto-start again
    const sp = new URLSearchParams(searchParams);
    sp.delete("autostart");
    setSearchParams(sp, { replace: true });

    // Fire the same logic as the Start button
    smartStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let marker = null;

    try {
      marker = JSON.parse(
        localStorage.getItem("fj_prev_lesson_prompt") || "null",
      );
    } catch {
      marker = null;
    }

    // No marker → no banner
    if (!marker) return;

    const toLessonId = Number(marker.toLessonId || 0);
    const fromLessonId = Number(marker.fromLessonId || 0);
    const ts = Number(marker.ts || 0);

    // Only show on the intended destination lesson
    if (!toLessonId || !fromLessonId) return;
    if (Number(dayNumber) !== toLessonId) return;

    // Expire marker after 10 minutes (prevents random nags later)
    if (ts && Date.now() - ts > 10 * 60 * 1000) {
      try {
        localStorage.removeItem("fj_prev_lesson_prompt");
      } catch {}
      return;
    }

    // Dismissed recently?
    const dismissKey = `fj_missed_banner_dismiss:${fromLessonId}->${toLessonId}`;
    try {
      const dismissedAt = Number(localStorage.getItem(dismissKey) || 0);
      if (dismissedAt && Date.now() - dismissedAt < 24 * 60 * 60 * 1000) return;
    } catch {}

    // NOTE: this banner is only meant to nudge the PREVIOUS lesson’s missing modes.
    // We can’t read previous lesson progress if you only compute progress for current lesson.
    // So we derive it from localStorage keys directly:
    const prevTyping = readProgress(progressUserId, fromLessonId, "typing");
    const prevReorder = readProgress(progressUserId, fromLessonId, "reorder");
    const prevAudio = readProgress(progressUserId, fromLessonId, "audio");

    const missing = [];
    if (isIncomplete(prevTyping)) missing.push("typing");
    if (isIncomplete(prevReorder)) missing.push("reorder");
    if (isIncomplete(prevAudio)) missing.push("audio");

    if (missing.length === 0) {
      // Nothing missing → clear marker so it doesn’t keep checking
      try {
        localStorage.removeItem("fj_prev_lesson_prompt");
      } catch {}
      return;
    }

    setMissedBanner({ fromLessonId, missing });
  }, [dayNumber]); // keep deps tight

  const didAutostartRef = useRef(false);

  useEffect(() => {
    if (didAutostartRef.current) return;
    const sp = new URLSearchParams(location.search);
    if (sp.get("autostart") !== "1") return;
    didAutostartRef.current = true;

    sp.delete("autostart");
    navigate(
      `${location.pathname}${sp.toString() ? `?${sp.toString()}` : ""}`,
      { replace: true },
    );

    smartStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const teach = LESSON_TEACH[Number(lessonId)] || null;

  const streak = userProfile?.daily_streak || 0;

  // 🎯 DATA NORMALIZATION: Moved here so 'lesson' is guaranteed to be available
  const videoUrl = lesson?.videoUrl || lesson?.video_url || "";
  const description = lesson?.description || lesson?.desc || "";

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 font-sans text-slate-900">
      {/* 1. COMPACT HEADER */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-100 bg-white/80 p-4 backdrop-blur-md max-w-2xl mx-auto w-full sm:rounded-b-3xl">
        <button
          onClick={() => navigate("/lessons")}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-all"
        >
          <span>←</span> BACK
        </button>
        <div className="flex items-center gap-3">
          {streak > 0 && (
            <span className="bg-orange-50 text-orange-600 px-3 py-1 rounded-full text-[10px] font-black border border-orange-100">
              🔥 {streak} DAY STREAK
            </span>
          )}
          <span className="bg-slate-900 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
            {difficulty}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-6 pt-10">
        {/* 2. DUAL-LANGUAGE CONCEPT CARD (Creative Solution) */}
        <section className="mb-8 group">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl font-black">
              அ
            </div>

            <h1 className="text-4xl font-black text-slate-900 mb-6 tracking-tight">
              Lesson {displayNum || lessonId}
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
              <div className="space-y-2">
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                  English Goal
                </span>
                <p className="text-sm font-bold text-slate-700 leading-relaxed italic">
                  "
                  {lesson?.english_mastery_goal ||
                    "Master these sentence structures through active practice."}
                  "
                </p>
              </div>
              <div className="space-y-2 border-t pt-4 md:border-t-0 md:pt-0 md:border-l md:pl-6">
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                  Tamil Translation
                </span>
                <p className="text-sm font-bold text-slate-700 leading-relaxed">
                  {lesson?.tamil_sentence ||
                    "இந்த பாடத்தின் வாக்கிய அமைப்புகளைப் பயிற்சி மூலம் தேர்ச்சி பெறுங்கள்."}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 3. VIDEO GUIDE (Cinematic Placeholder) */}
        <section className="mb-10">
          <div className="aspect-video w-full rounded-[2.5rem] bg-slate-900 shadow-2xl border-4 border-white overflow-hidden relative group">
            {videoUrl || teach?.video?.id ? (
              <iframe
                className="w-full h-full"
                src={
                  videoUrl ||
                  (teach?.video?.provider === "vimeo"
                    ? `https://player.vimeo.com/video/${teach.video.id}`
                    : `https://www.youtube-nocookie.com/embed/${teach.video.id}`)
                }
                allowFullScreen
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40">
                <span className="text-4xl mb-2">🎬</span>
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">
                  Video Guide Coming Soon
                </p>
              </div>
            )}
          </div>
        </section>

        {/* 4. THE ACTION HUB (THE REDIRECTION FIX) */}
        <section className="mb-12 relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[2.5rem] blur opacity-20 transition duration-1000 group-hover:opacity-40"></div>
          <div className="relative bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-50">
            <button
              onClick={() => {
                if (isLocked) return goPaywall();
                if (continueHref) return navigate(continueHref);

                // 🎯 CTO LOGIC: Priority-based Smart Start
                const bestMode =
                  modeAvail.reorder && pct(reorderProg) < 100
                    ? "reorder"
                    : modeAvail.typing && pct(typingProg) < 100
                      ? "typing"
                      : modeAvail.audio && pct(audioProg) < 100
                        ? "audio"
                        : "reorder";

                navigate(
                  `/practice/${bestMode}?lessonId=${lessonId}&difficulty=${difficulty}`,
                );
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 rounded-2xl text-xl font-black shadow-xl shadow-indigo-100 transition-all hover:scale-[1.01] active:scale-[0.99] mb-4"
            >
              {continueHref ? "RESUME MASTERY" : "START PRACTICE"}
            </button>

            <p className="text-center text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-8">
              {continueHref
                ? "Continuing from where you left off"
                : "Standard Learning Path Enabled"}
            </p>

            {/* 🎯 NEW: Quick Mode Switcher (The Choice Layer) */}
            <div className="flex justify-center gap-6 border-t border-slate-50 pt-8">
              {["reorder", "typing", "audio"].map((m) => {
                const isDone =
                  pct(
                    m === "reorder"
                      ? reorderProg
                      : m === "typing"
                        ? typingProg
                        : audioProg,
                  ) === 100;
                const config = MODE_CONFIG[m] || {};
                const icon = config.icon || "🧩";
                const label = config.title || m;
                const subText = config.sub || "";

                m === "reorder" ? "Logic" : m === "typing" ? "Speed" : "Audio";

                return (
                  modeAvail[m] && (
                    <button
                      key={m}
                      onClick={() => startMode(m)}
                      className="flex flex-col items-center gap-2 group transition-all"
                    >
                      <div
                        className={`h-14 w-14 rounded-2xl flex items-center justify-center text-xl transition-all shadow-sm border 
                              ${isDone ? "bg-emerald-50 border-emerald-100" : "bg-slate-50 border-slate-100 group-hover:bg-white group-hover:border-indigo-200"}`}
                      >
                        {isDone ? "✅" : icon}
                      </div>
                      <span
                        className={`text-[10px] font-black uppercase tracking-widest ${isDone ? "text-emerald-500" : "text-slate-400"}`}
                      >
                        {label}
                      </span>
                      <span className="text-[8px] font-bold text-slate-300 italic -mt-1">
                        {config.tamil}
                      </span>
                    </button>
                  )
                );
              })}
            </div>
          </div>
        </section>

        {/* 5. SKILL PROGRESS BARS */}
        <div className="space-y-4 mb-10">
          {["typing", "reorder", "audio"].map(
            (m) =>
              modeAvail[m] && (
                <div
                  key={m}
                  className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between"
                >
                  <span className="text-xl">{MODE_CONFIG[m]?.icon}</span>
                  <div className="flex-1 px-4">
                    <div className="flex justify-between items-end mb-1">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {MODE_CONFIG[m]?.title}
                        </span>
                        <p className="text-[9px] font-bold text-slate-300 italic -mt-0.5">
                          {MODE_CONFIG[m]?.tamil}
                        </p>
                      </div>
                    </div>

                    <div className="h-1.5 w-full bg-slate-50 rounded-full border border-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 transition-all duration-1000"
                        style={{
                          width: `${pct(m === "typing" ? typingProg : m === "reorder" ? reorderProg : audioProg)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-[11px] font-black text-slate-900">
                    {pct(
                      m === "typing"
                        ? typingProg
                        : m === "reorder"
                          ? reorderProg
                          : audioProg,
                    )}
                    %
                  </span>
                </div>
              ),
          )}
        </div>
      </main>
    </div>
  );
}
