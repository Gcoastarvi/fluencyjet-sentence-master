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

function readProgress(lessonId, mode) {
  return safeJsonParse(
    localStorage.getItem(`fj_progress:${lessonId}:${mode}`) || "null",
  );
}

function readLastSession() {
  return safeJsonParse(localStorage.getItem(LAST_SESSION_KEY) || "null");
}

function pct(p) {
  const total = Number(p?.total || 0);
  const done = Number(p?.completed || 0);
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
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
  const [missedBanner, setMissedBanner] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();

  const { lessonId: lessonIdParam } = useParams(); // this is dayNumber in MVP routing

  const dayNumber = Number(lessonIdParam); // numeric dayNumber
  const dayNumberStr = String(lessonIdParam || ""); // string for storage / url encoding

  // ✅ compatibility: many parts of this file still expect `lessonId`
  const lessonId = dayNumberStr;
  const lessonIdNum = dayNumber; // optional alias if older code uses lessonIdNum

  const [searchParams, setSearchParams] = useSearchParams();

  // If Lessons page passes state: { lesson }, we use it. If not, we still render safely.
  const [lesson, setLesson] = useState(location.state?.lesson || null);

  // Difficulty: URL wins, else lesson metadata, else beginner
  const lessonDifficulty = (
    getDifficultyFromLesson(lesson) || ""
  ).toLowerCase();
  const urlDifficulty = (searchParams.get("difficulty") || "").toLowerCase();
  const difficulty = urlDifficulty || lessonDifficulty || "beginner";

  const [showMoreModes, setShowMoreModes] = useState(false);

  useEffect(() => {
    setShowMoreModes(false);
  }, [lessonIdNum, difficulty]);

  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const [smartStarting, setSmartStarting] = useState(false);
  const [smartStartMsg, setSmartStartMsg] = useState("");

  const [showTamilHelp, setShowTamilHelp] = useState(false);

  // ✅ Use backend + lesson metadata for lock UI. Do NOT use "first 3 only" anymore.
  const isLocked = Boolean(lesson?.isLocked ?? lesson?.is_locked ?? false);

  // Preference toggle (Show Tamil help)
  //const [showTa, setShowTa] = useState(() => {
  // Avoid SSR issues (not relevant here) and keep predictable default
  //if (typeof window === "undefined") return true;
  //return readPrefShowTa(dayNumber);
  //});

  // Tamil toggle disabled for MVP (no showTa state)

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
    () => (lessonId ? readProgress(lessonId, "typing") : null),
    [lessonId],
  );
  const reorderProg = useMemo(
    () => (lessonId ? readProgress(lessonId, "reorder") : null),
    [lessonId],
  );
  const clozeProg = useMemo(
    () => (lessonId ? readProgress(lessonId, "cloze") : null),
    [lessonId],
  );
  const audioProg = useMemo(
    () => (lessonId ? readProgress(lessonId, "audio") : null),
    [lessonId],
  );

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
    if (total <= 0) return false; // if no items, don’t nag
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
    navigate(
      `/paywall?plan=BEGINNER&from=lesson_${dayNumber || ""}&difficulty=${encodeURIComponent(difficulty)}`,
    );
  }

  function startMode(mode) {
    setShowMoreModes(false);
    if (!lessonId) return;
    if (isLocked) return goPaywall();

    if (mode === "audio" && !ENABLE_AUDIO) return;
    if (mode === "cloze" && !ENABLE_CLOZE) return;

    track("mode_card_clicked", {
      lessonId: Number(dayNumber) || 0,
      difficulty,
      mode,
    });

    const lid = Number(dayNumber);

    navigate(
      `/practice/${mode}?lessonId=${encodeURIComponent(lid)}&difficulty=${encodeURIComponent(
        difficulty,
      )}`,
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

      if (status === 403 && data?.code === "PAYWALL") {
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

  // Trigger Mastery Celebration
  useEffect(() => {
    // 1. Calculate the same overallAvg used in your UI
    const pts = [
      modeAvail.typing ? pct(typingProg) : null,
      modeAvail.reorder ? pct(reorderProg) : null,
      ENABLE_AUDIO && modeAvail.audio ? pct(audioProg) : null,
    ].filter((x) => typeof x === "number");

    const overallAvg = pts.length
      ? Math.round(pts.reduce((a, b) => a + b, 0) / pts.length)
      : 0;

    // 2. Trigger if 100% and it hasn't rained yet in this session
    if (overallAvg === 100 && hasLoadedOnce) {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.7 },
        colors: ["#f97316", "#fbbf24", "#ffffff"], // Orange/Gold for Streak Mastery
      });

      const sound = new Audio("/sounds/levelup.mp3");
      sound.volume = 0.4;
      sound.play().catch(() => {});
    }
  }, [typingProg, reorderProg, audioProg, modeAvail, hasLoadedOnce]);

  async function smartStart() {
    if (!lessonId) return;
    if (isLocked) return goPaywall();

    track("start_practice_clicked", {
      lessonId: Number(dayNumber) || 0,
      difficulty,
      recommendedMode,
      hasContinue: Boolean(continueHref),
    });

    // If Continue exists, always honor it first
    if (continueHref) {
      track("continue_clicked", {
        lessonId: Number(dayNumber) || 0,
        difficulty,
        mode: normalizedSession?.mode || session?.mode || null,
        q: normalizedSession?.questionIndex ?? session?.questionIndex ?? null,
      });
      navigate(continueHref);
      return;
    }

    const lid = Number(dayNumber);
    if (!lid) return;

    setSmartStarting(true);
    setSmartStartMsg("");

    try {
      // Try recommended first, then fall back in this order
      const baseOrder = ["reorder", "typing", "audio"];
      const order = recommendedMode
        ? [recommendedMode, ...baseOrder.filter((m) => m !== recommendedMode)]
        : baseOrder;

      for (const mode of order) {
        // Skip disabled modes
        if (mode === "audio" && !ENABLE_AUDIO) continue;
        if (mode === "cloze" && !ENABLE_CLOZE) continue;

        const ok = await hasExercises(dayNumber, mode, difficulty);
        if (ok === "AUTH" || ok === "PAYWALL") return;

        if (ok) {
          navigate(
            `/practice/${mode}?lessonId=${encodeURIComponent(dayNumber)}&difficulty=${encodeURIComponent(
              difficulty,
            )}`,
          );
          return;
        }
      }

      setSmartStartMsg("No practice items yet for this lesson.");
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
    const prevTyping = readProgress(fromLessonId, "typing");
    const prevReorder = readProgress(fromLessonId, "reorder");
    const prevAudio = readProgress(fromLessonId, "audio");

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

  return (
    <div className="mx-auto max-w-xl p-4">
      <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm overflow-hidden relative">
        {/* Animated Streak Background Glow */}
        {Number(streak || 0) > 0 && (
          <div className="absolute -top-10 -right-10 h-32 w-32 bg-orange-100/50 blur-3xl rounded-full" />
        )}

        <div className="flex items-start justify-between gap-3 relative">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-slate-900">{title}</h1>

              {/* 🎖️ Verified Level Badge */}
              {userProfile?.placement_level?.toLowerCase() ===
                difficulty.toLowerCase() && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-tight border border-emerald-100">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Verified
                </span>
              )}

              {/* 🔥 Daily Streak Flame */}
              {Number(streak || 0) > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 text-[10px] font-black uppercase tracking-tight border border-orange-100 animate-bounce-subtle">
                  <span className="text-sm">🔥</span>
                  {streak} Day Streak
                </span>
              )}
            </div>

            <p className="text-sm font-medium text-slate-500">
              {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Track •
              10 min daily goal
            </p>
          </div>

          <button
            onClick={() => navigate(-1)}
            className="rounded-2xl bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
          >
            Back
          </button>
        </div>

        {/* Lock banner */}
        {isLocked ? (
          <div className="mt-4 rounded-2xl border border-purple-200 bg-purple-50 p-4">
            <div className="font-semibold text-purple-900">Locked lesson</div>
            <div className="mt-1 text-sm text-purple-800">
              Upgrade to unlock Lessons 4+.
            </div>
            <button
              type="button"
              onClick={goPaywall}
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-3 font-semibold text-white hover:opacity-95"
            >
              Unlock Beginner Course <span aria-hidden>→</span>
            </button>
          </div>
        ) : null}

        {teach ? (
          <div className="mt-4 rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 text-left shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Learn (60 sec): {teach.title}
                </div>
                <div className="mt-1 text-sm text-slate-700">
                  <span className="font-semibold">Rule:</span> {teach.rule}
                </div>
                {/* Coach / Recommendation row */}
                {(() => {
                  // Recommendation order (lowest friction first):
                  // Reorder -> Typing -> Audio
                  const ordered = ["reorder", "typing", "audio"];

                  // Only recommend modes that are available + actually have items
                  const canUse = (m) => {
                    if (m === "typing") return !!modeAvail.typing;
                    if (m === "reorder") return !!modeAvail.reorder;
                    if (m === "audio") return !!modeAvail.audio && ENABLE_AUDIO;
                    return false;
                  };

                  const firstIncomplete = ordered.find(
                    (m) =>
                      canUse(m) &&
                      (m === "typing"
                        ? isIncomplete(typingProg)
                        : m === "reorder"
                          ? isIncomplete(reorderProg)
                          : isIncomplete(audioProg)),
                  );

                  const nextMode = continueHref
                    ? null
                    : firstIncomplete ||
                      (canUse("reorder")
                        ? "reorder"
                        : canUse("typing")
                          ? "typing"
                          : canUse("audio")
                            ? "audio"
                            : canUse("cloze")
                              ? "cloze"
                              : "reorder");

                  const nextLabel =
                    nextMode === "typing"
                      ? "Typing"
                      : nextMode === "reorder"
                        ? "Reorder"
                        : "Audio";

                  const chosenMode = recommendedMode || nextMode || "reorder";
                  const coachText = continueHref
                    ? `Continue ${modeLabel(session?.mode)} — you were at Q# ${Number(session?.questionIndex || 0) + 1}.`
                    : uiFor(chosenMode).coach ||
                      `Recommended: Start ${uiFor(chosenMode).title} now.`;

                  return (
                    <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="inline-flex flex-wrap items-center gap-2 text-xs text-slate-700">
                        <span className="inline-flex items-center rounded-full bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white">
                          Coach
                        </span>
                        <span>{coachText}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {continueHref ? (
                          <Link
                            to={continueHref}
                            className="inline-flex items-center justify-center rounded-full bg-black px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
                          >
                            Continue →
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              startMode(
                                recommendedMode || nextMode || "reorder",
                              )
                            }
                            className="inline-flex items-center justify-center rounded-full bg-black px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
                          >
                            Start{" "}
                            {
                              uiFor(recommendedMode || nextMode || "reorder")
                                .title
                            }{" "}
                            →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <button
                type="button"
                className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                  showTamilHelp
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => setShowTamilHelp((v) => !v)}
              >
                {showTamilHelp ? "Hide Tamil" : "Tamil help"}
              </button>
            </div>

            <div className="mt-3">
              <div className="text-xs font-semibold text-slate-600">
                Patterns
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(teach?.patterns ?? []).map((p, idx) => (
                  <span
                    key={`${p}-${idx}`}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-800"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <div className="text-xs font-semibold text-slate-600">
                Examples
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(teach?.examples ?? []).map((e, idx) => (
                  <div
                    key={`${e}-${idx}`}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                  >
                    {e}
                  </div>
                ))}
              </div>
            </div>

            {/* 998: Cinematic Video Wrapper with Glassmorphism */}
            {teach?.video?.id ? (
              <div className="mt-8 group relative overflow-hidden rounded-[2.5rem] border-4 border-white shadow-2xl bg-slate-900 transition-all duration-500 hover:shadow-indigo-100">
                {/* Subtle Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-transparent to-transparent z-10 opacity-60 pointer-events-none" />

                <div
                  className={`relative z-0 w-full ${teach.video.ratio === "9:16" ? "aspect-[9/16] max-h-[500px]" : "aspect-video"}`}
                >
                  <iframe
                    title={`Lesson ${lessonId} video`}
                    className="absolute inset-0 h-full w-full"
                    src={
                      teach.video.provider === "vimeo"
                        ? `https://player.vimeo.com/video/${teach.video.id}`
                        : `https://www.youtube-nocookie.com/embed/${teach.video.id}?rel=0&modestbranding=1`
                    }
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>

                {/* Floating interaction bar using glassmorphism */}
                <div className="absolute bottom-6 left-6 right-6 z-20 flex items-center justify-between">
                  <div className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold uppercase tracking-widest shadow-sm">
                    Visual Guide
                  </div>
                  <button
                    onClick={() =>
                      document
                        .getElementById("practice-actions")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                    className="bg-white text-slate-900 px-6 py-2 rounded-full font-bold text-xs shadow-lg hover:scale-105 active:scale-95 transition-all"
                  >
                    Practice Now ↓
                  </button>
                </div>
              </div>
            ) : null}

            {showTamilHelp ? (
              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-800">
                <div className="mb-1 text-xs font-semibold text-slate-600">
                  Tamil help
                </div>
                {teach.ta}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                onClick={() => {
                  document
                    .getElementById("practice-actions")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Start practice →
              </button>
              <div className="text-xs text-slate-500">
                1 minute learn → 2 minutes practice
              </div>
            </div>
          </div>
        ) : null}

        {/* 1106: World-Class Dashboard with Progress Ring */}
        {(() => {
          const pts = [
            modeAvail.typing ? pct(typingProg) : null,
            modeAvail.reorder ? pct(reorderProg) : null,
            ENABLE_AUDIO && modeAvail.audio ? pct(audioProg) : null,
          ].filter((x) => typeof x === "number");
          const overallAvg = pts.length
            ? Math.round(pts.reduce((a, b) => a + b, 0) / pts.length)
            : 0;

          return (
            <div className="mt-8 rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm relative overflow-hidden">
              <div className="flex flex-col items-center text-center">
                <div className="relative h-32 w-32 mb-4">
                  <svg className="h-full w-full" viewBox="0 0 100 100">
                    <circle
                      className="text-slate-100 stroke-current"
                      strokeWidth="8"
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                    />
                    <circle
                      className="text-orange-500 stroke-current transition-all duration-1000 ease-out"
                      strokeWidth="8"
                      strokeLinecap="round"
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 - 251.2 * (overallAvg / 100)}
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl">🔥</span>
                    <span className="text-xl font-black text-slate-900">
                      {streak || 0}
                    </span>
                  </div>
                </div>

                {/* 🤖 Dynamic Lesson Coach Integration */}
                <h2 className="text-lg font-bold text-slate-900">
                  {overallAvg === 100
                    ? "Mastery Achieved! 🎉"
                    : overallAvg > 50
                      ? "Almost there! 💪"
                      : "Great start! 🚀"}
                </h2>
                <p className="text-sm text-slate-500 mb-6">
                  {overallAvg === 100
                    ? "You've crushed every mode in this lesson."
                    : `You've mastered ${overallAvg}% of this lesson.`}
                </p>

                <div className="grid grid-cols-3 gap-4 w-full">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Status
                    </div>
                    <div className="text-xs font-black text-slate-800">
                      {session ? "In Progress" : "New"}
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Pace
                    </div>
                    <div className="text-xs font-black text-slate-800">
                      Swift
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Focus
                    </div>
                    <div className="text-xs font-black text-slate-800">
                      Daily
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 1162: Mode chips start here */}
        <div className="mt-6 flex flex-wrap gap-2">
          {/* Mode chips */}
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              {
                label: uiFor("typing").title,
                p: typingProg,
                show: modeAvail.typing,
              },
              {
                label: uiFor("reorder").title,
                p: reorderProg,
                show: modeAvail.reorder,
              },
              {
                label: uiFor("audio").title,
                p: audioProg,
                show: ENABLE_AUDIO && modeAvail.audio,
              },
              {
                label: uiFor("cloze").title,
                p: clozeProg,
                show: ENABLE_CLOZE && modeAvail.cloze,
              },
            ]
              .filter((x) => x.show)
              .map(({ label, p }) => (
                <div
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs"
                  title={`Last practiced: ${formatLast(Number(p?.updatedAt || 0))}`}
                >
                  <span className="font-semibold text-slate-900">{label}</span>
                  <span className="text-slate-500">•</span>
                  <span className="font-semibold text-slate-800">
                    {pct(p)}%
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-600">
                    {formatLast(Number(p?.updatedAt || 0))}
                  </span>
                </div>
              ))}
          </div>

          {/* If no modes have items, show a single empty-state */}
          {!showMoreModes && noModes && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              No practice items yet for this lesson.
            </div>
          )}
        </div>

        {missedBanner ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="text-sm font-semibold text-amber-900">
              Quick win: finish your missed practice
            </div>

            <div className="mt-1 text-sm text-amber-800">
              You skipped{" "}
              <span className="font-semibold">
                {missedBanner.missingModesLabel}
              </span>{" "}
              in Lesson{" "}
              <span className="font-semibold">{missedBanner.prevLessonId}</span>
              .
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold"
                onClick={goToPrevLessonHub}
              >
                Finish Lesson {missedBanner.prevLessonId}
              </button>

              <button
                type="button"
                className="px-3 py-2 rounded-lg border border-amber-300 text-amber-900 text-sm font-semibold"
                onClick={dismissMissedBanner}
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        {/* Actions */}
        <div id="practice-actions" className="mt-6 space-y-4">
          {/* HERO CTA */}
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-purple-600 to-indigo-600 p-5 text-white shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-white/90">
                  {continueHref ? "Continue" : "Start now"}
                </div>
                <div className="mt-1 text-2xl font-semibold">
                  {continueHref ? continueText : "Start practice"}
                </div>
                <div className="mt-1 text-xs text-white/80">
                  {continueHref
                    ? "Resume exactly where you left off"
                    : "Auto-picks the best mode for you"}
                </div>
                {!continueHref ? (
                  <div className="mt-1 text-xs text-white/80">
                    Path: {uiFor(recommendedMode || "reorder").title} →{" "}
                    {uiFor("typing").title} → {uiFor("audio").title}
                  </div>
                ) : null}
              </div>

              {continueHref ? (
                <Link
                  to={continueHref}
                  onClick={() =>
                    track("continue_clicked", {
                      lessonId: Number(dayNumber) || 0,
                      difficulty,
                      mode: normalizedSession?.mode || session?.mode || null,
                      q:
                        normalizedSession?.questionIndex ??
                        session?.questionIndex ??
                        null,
                      source: "hero",
                    })
                  }
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:opacity-95"
                >
                  Continue →
                </Link>
              ) : (
                <button
                  onClick={smartStart}
                  disabled={smartStarting}
                  className={`inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold ${
                    smartStarting
                      ? "bg-white/40 text-white/90 cursor-not-allowed"
                      : "bg-white text-slate-900 hover:opacity-95"
                  }`}
                >
                  {smartStarting ? "Starting..." : "Start →"}
                </button>
              )}
            </div>

            {/* micro reassurance row */}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/85">
              <span className="inline-flex items-center rounded-full bg-white/15 px-2 py-1">
                ⚡ Fast sessions
              </span>
              <span className="inline-flex items-center rounded-full bg-white/15 px-2 py-1">
                🎯 Fluency-focused
              </span>
              <span className="inline-flex items-center rounded-full bg-white/15 px-2 py-1">
                🏆 XP + streak
              </span>

              {/* Premium: time + XP estimate (based on recommended mode) */}
              <span className="ml-auto inline-flex items-center rounded-full bg-black/20 px-2 py-1">
                {(() => {
                  if (continueHref) return `Next: ${modeLabel(session?.mode)}`;

                  const rm = recommendedMode;
                  if (!rm) return "Next: —";

                  return `Next: ${uiFor(rm).title}`;
                })()}
              </span>
            </div>

            <span
              className={`ml-auto inline-flex items-center rounded-full px-2 py-1 text-xs ${
                continueHref || !recommendedMode
                  ? "cursor-not-allowed bg-black/10 text-white/60"
                  : "bg-black/20 text-white"
              }`}
              title={
                continueHref
                  ? `Continue ${modeLabel(session?.mode)}`
                  : !recommendedMode
                    ? "No recommended mode available yet"
                    : recommendedMode === "reorder"
                      ? "Recommended because it's the easiest quick win (word order)"
                      : recommendedMode === "typing"
                        ? "Recommended to build speed + sentence flow"
                        : "Recommended for pronunciation + listening"
              }
            >
              {(() => {
                if (continueHref) return `Next: ${modeLabel(session?.mode)}`;

                const rm = recommendedMode;
                if (!rm) return "Next: —";
              })()}
            </span>
          </div>

          {/* Optional Smart Start message */}
          {smartStartMsg ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {smartStartMsg}
            </div>
          ) : null}

          {/* QUICK MODE PICKER */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Choose a mode
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Pick one — or hit Start for auto mode.
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowMoreModes((v) => {
                    const next = !v;
                    track("view_details_toggled", {
                      lessonId: Number(dayNumber) || 0,
                      difficulty,
                      open: next,
                    });
                    return next;
                  })
                }
                className="text-xs font-semibold text-slate-600 underline-offset-4 hover:underline"
              >
                {showMoreModes ? "Hide details" : "View details"}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Typing */}
              <button
                disabled={!modeEnabled("typing", modeAvail)}
                onClick={() =>
                  modeEnabled("typing", modeAvail) && startMode("typing")
                }
                className={`rounded-2xl border p-4 text-left transition ${
                  modeEnabled("typing", modeAvail)
                    ? isRec("typing")
                      ? "border-black bg-white shadow-sm ring-2 ring-black/10"
                      : "border-slate-200 bg-gradient-to-br from-slate-50 to-white hover:shadow-sm"
                    : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">
                      {uiFor("typing").title}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {modeEnabled("typing", modeAvail)
                        ? uiFor("typing").sub
                        : "Coming soon"}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="rounded-full bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white">
                      {pct(typingProg)}%
                    </span>
                    {isRec("typing") ? (
                      <span className="rounded-full border border-black/10 bg-black px-2 py-0.5 text-[10px] font-semibold text-white">
                        Recommended
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-slate-900"
                    style={{ width: `${pct(typingProg)}%` }}
                  />
                </div>
              </button>

              {/* Reorder */}
              <button
                disabled={!modeAvail.reorder}
                onClick={() => startMode("reorder")}
                className={`rounded-2xl border p-4 text-left transition ${
                  modeEnabled("reorder", modeAvail)
                    ? isRec("reorder")
                      ? "border-black bg-white shadow-sm ring-2 ring-black/10"
                      : "border-slate-200 bg-gradient-to-br from-slate-50 to-white hover:shadow-sm"
                    : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">
                      {uiFor("reorder").title}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {modeEnabled("reorder", modeAvail)
                        ? uiFor("reorder").sub
                        : "Coming soon"}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="rounded-full bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white">
                      {pct(reorderProg)}%
                    </span>

                    {isRec("reorder") ? (
                      <span className="rounded-full border border-black/10 bg-black px-2 py-0.5 text-[10px] font-semibold text-white">
                        Recommended
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-slate-900"
                    style={{ width: `${pct(reorderProg)}%` }}
                  />
                </div>
              </button>

              {/* Audio */}
              <button
                disabled={!modeAvail.audio}
                onClick={() => startMode("audio")}
                className={`rounded-2xl border p-4 text-left transition ${
                  modeEnabled("audio", modeAvail)
                    ? isRec("audio")
                      ? "border-black bg-white shadow-sm ring-2 ring-black/10"
                      : "border-slate-200 bg-gradient-to-br from-slate-50 to-white hover:shadow-sm"
                    : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">
                      {uiFor("audio").title}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {modeEnabled("audio", modeAvail)
                        ? uiFor("audio").sub
                        : "Coming soon"}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="rounded-full bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white">
                      {pct(audioProg)}%
                    </span>

                    {isRec("audio") ? (
                      <span className="rounded-full border border-black/10 bg-black px-2 py-0.5 text-[10px] font-semibold text-white">
                        Recommended
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-slate-900"
                    style={{ width: `${pct(audioProg)}%` }}
                  />
                </div>
              </button>
            </div>

            {/* DETAILS DRAWER */}
            {showMoreModes && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="font-semibold">What each mode does</div>
                <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
                  <li>
                    <span className="font-semibold">
                      {uiFor("typing").title}:
                    </span>{" "}
                    build speed + sentence flow
                  </li>
                  <li>
                    <span className="font-semibold">
                      {uiFor("reorder").title}:
                    </span>{" "}
                    fix grammar + word order
                  </li>
                  <li>
                    <span className="font-semibold">
                      {uiFor("audio").title}:
                    </span>{" "}
                    pronunciation + listening
                  </li>
                </ul>

                <div className="mt-3">
                  <button
                    onClick={() => startMode("cloze")}
                    disabled={!ENABLE_CLOZE}
                    className={`w-full rounded-2xl px-4 py-3 text-left ${
                      ENABLE_CLOZE
                        ? "border border-slate-200 bg-white hover:bg-slate-50"
                        : "cursor-not-allowed bg-slate-100 text-slate-400"
                    }`}
                  >
                    <div className="text-sm font-semibold">Cloze</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {ENABLE_CLOZE ? "Fill the missing word" : "Coming soon"}
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
