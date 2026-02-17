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

// Audio v1 can be turned on later without refactor:
const ENABLE_AUDIO = true;
const ENABLE_CLOZE = false; // keep off unless you really have cloze exercises

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
  if (x === "typing") return "Typing";
  if (x === "reorder") return "Reorder";
  if (x === "cloze") return "Cloze";
  if (x === "audio") return "Audio";
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

  const [searchParams] = useSearchParams();

  // If Lessons page passes state: { lesson }, we use it. If not, we still render safely.
  const [lesson, setLesson] = useState(location.state?.lesson || null);

  // Difficulty: URL wins, else lesson metadata, else beginner
  const lessonDifficulty = (
    getDifficultyFromLesson(lesson) || ""
  ).toLowerCase();
  const urlDifficulty = (searchParams.get("difficulty") || "").toLowerCase();
  const difficulty = urlDifficulty || lessonDifficulty || "beginner";

  const [showMoreModes, setShowMoreModes] = useState(false);

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

    const sameLesson = String(s.lessonId) === String(lessonId);
    if (!sameLesson) return null;

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

    // index gate
    if (!Number.isFinite(idx) || idx < 0) return null;

    const total = Number(totalsByMode[m] || 0);
    if (total <= 0) return null; // nothing to resume
    if (idx >= total) return null; // stale/out-of-range session

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

  // ✅ If last session is "done", don't show Continue
  const isSessionDone =
    normalizedSession?.index === "done" ||
    normalizedSession?.questionIndex === "done";

  const canContinue =
    normalizedSession &&
    !isSessionDone &&
    typeof normalizedSession.questionIndex === "number" &&
    Number.isFinite(normalizedSession.questionIndex);

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

    if (!dayNumber) return; // safety
    navigate(
      `/practice/${mode}?lessonId=${encodeURIComponent(dayNumber)}&difficulty=${encodeURIComponent(difficulty)}`,
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
      `/lesson/${missedBanner.prevLessonId}?difficulty=${encodeURIComponent(difficulty)}`,
    );
  }

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

  async function smartStart() {
    if (!lessonId) return;
    if (isLocked) return goPaywall();

    // If Continue exists, always honor it first
    if (continueHref) {
      navigate(continueHref);
      return;
    }

    const lid = Number(dayNumber);
    if (!lid) return;

    setSmartStarting(true);
    setSmartStartMsg("");

    try {
      // Prefer Typing (fluency), fallback Reorder, then Audio
      const typingOk = await hasExercises(dayNumber, "typing", difficulty);
      if (typingOk === "AUTH" || typingOk === "PAYWALL") return;
      if (typingOk) {
        navigate(
          `/practice/typing?lessonId=${encodeURIComponent(dayNumber)}&difficulty=${encodeURIComponent(
            difficulty,
          )}`,
        );
        return;
      }

      const reorderOk = await hasExercises(dayNumber, "reorder", difficulty);
      if (reorderOk === "AUTH" || reorderOk === "PAYWALL") return;
      if (reorderOk) {
        navigate(
          `/practice/reorder?lessonId=${encodeURIComponent(dayNumber)}&difficulty=${encodeURIComponent(
            difficulty,
          )}`,
        );
        return;
      }

      const audioOk = await hasExercises(dayNumber, "audio", difficulty);
      if (audioOk === "AUTH" || audioOk === "PAYWALL") return;
      if (audioOk) {
        navigate(
          `/practice/audio?lessonId=${encodeURIComponent(dayNumber)}&difficulty=${encodeURIComponent(
            difficulty,
          )}`,
        );
        return;
      }

      setSmartStartMsg("No practice items yet for this lesson.");
    } finally {
      setSmartStarting(false);
    }
  }

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

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="mt-1 text-sm text-gray-600">
              Practice hub • Choose a mode to begin
            </p>
          </div>

          <button
            onClick={() => navigate(-1)}
            className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
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
              </div>

              <button
                type="button"
                className="rounded-xl border bg-slate-50 px-3 py-2 text-sm font-semibold hover:bg-slate-100"
                onClick={() => setShowTamilHelp((v) => !v)}
              >
                {showTamilHelp ? "Hide Tamil" : "Tamil help"}
              </button>
            </div>

            <div className="mt-3">
              <div className="text-xs font-semibold text-slate-600">
                Patterns
              </div>
              <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                {teach.patterns.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>

            <div className="mt-3">
              <div className="text-xs font-semibold text-slate-600">
                Examples
              </div>
              <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                {teach.examples.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>

            {teach?.video?.id ? (
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 items-center rounded-full border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700">
                    ▶ Video
                  </span>
                  <span className="text-xs text-slate-500">60–90 sec</span>
                </div>

                <a
                  className="text-xs font-semibold text-slate-600 underline-offset-4 hover:underline"
                  href={
                    teach.video.provider === "vimeo"
                      ? `https://vimeo.com/${encodeURIComponent(teach.video.id)}`
                      : `https://www.youtube.com/watch?v=${encodeURIComponent(teach.video.id)}`
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  Open ↗
                </a>
              </div>

              <div
                className={`mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-sm ${
                  teach.video.ratio === "9:16" || teach.video.kind === "short"
                    ? "mx-auto max-w-sm"
                    : ""
                }`}
              >
                <div
                  className={`relative w-full ${
                    teach.video.ratio === "9:16" || teach.video.kind === "short"
                      ? "aspect-[9/16] max-h-[460px]"
                      : "aspect-video"
                  }`}
                >
                  <iframe
                    title={`Lesson ${lessonId} video`}
                    className="absolute inset-0 h-full w-full"
                    src={
                      teach.video.provider === "vimeo"
                        ? `https://player.vimeo.com/video/${encodeURIComponent(
                            teach.video.id,
                          )}`
                        : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(
                            teach.video.id,
                          )}?rel=0&modestbranding=1`
                    }
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-3">
                <div className="text-xs text-slate-600">
                  ✅ Watch, then jump into practice for instant recall.
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
                    onClick={() =>
                      document
                        .getElementById("practice-actions")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                  >
                    Jump to practice ↓
                  </button>
                </div>
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

        {/* Progress summary */}
        <div className="mt-5 rounded-2xl bg-gray-50 p-4">
          <div className="text-sm font-medium">Progress summary</div>

          <div className="mt-3 space-y-3">
            {/* Top mini-cards */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-white p-3">
                <div className="text-xs text-gray-500">Lesson</div>
                <div className="text-sm font-semibold">{dayNumber || "—"}</div>
              </div>

              <div className="rounded-xl bg-white p-3">
                <div className="text-xs text-gray-500">Continue</div>
                <div className="text-sm font-semibold">
                  {session
                    ? `Mode: ${modeLabel(session.mode)}`
                    : "No session yet"}
                </div>
              </div>

              <div className="rounded-xl bg-white p-3">
                <div className="text-xs text-gray-500">Last position</div>
                <div className="text-sm font-semibold">
                  {session ? `Q# ${Number(session.questionIndex) + 1}` : "—"}
                </div>
              </div>
            </div>

            {/* Mode badges */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Typing", p: typingProg },
                { label: "Reorder", p: reorderProg },
                ENABLE_CLOZE ? { label: "Cloze", p: clozeProg } : null,
                ENABLE_AUDIO ? { label: "Audio", p: audioProg } : null,
              ]
                .filter(Boolean)
                .map(({ label, p }) => (
                  <div
                    key={label}
                    className="rounded-full border bg-white px-3 py-1 text-xs"
                    title={`Last practiced: ${formatLast(Number(p?.updatedAt || 0))}`}
                  >
                    <span className="font-semibold">{label}</span>
                    <span className="text-gray-500"> • </span>
                    <span>{pct(p)}%</span>
                    <span className="text-gray-500"> • </span>
                    <span className="text-gray-600">
                      {formatLast(Number(p?.updatedAt || 0))}
                    </span>
                  </div>
                ))}
            </div>

            {/* If no modes have items, show a single empty-state */}
            {!showMoreModes && noModes && (
              <div className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-600">
                No practice items yet for this lesson.
              </div>
            )}

            {/* Typing progress */}
            {modeAvail.typing && (
              <div className="rounded-xl bg-white p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Typing</div>
                  <div className="text-xs text-gray-600">
                    {typingProg?.completed || 0}/{typingProg?.total || 0}
                  </div>
                </div>

                <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-indigo-600"
                    style={{ width: `${pct(typingProg)}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {pct(typingProg)}% complete
                </div>
              </div>
            )}

            {/* Reorder progress */}
            {modeAvail.reorder && (
              <div className="rounded-xl bg-white p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Reorder</div>
                  <div className="text-xs text-gray-600">
                    {reorderProg?.completed || 0}/{reorderProg?.total || 0}
                  </div>
                </div>

                <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-indigo-600"
                    style={{ width: `${pct(reorderProg)}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {pct(reorderProg)}% complete
                </div>
              </div>
            )}
          </div>
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
                <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-purple-600 to-indigo-600 p-4 text-white shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white/90">
                        {continueHref ? "Continue" : "Start now"}
                      </div>
                      <div className="mt-1 text-lg font-semibold">
                        {continueHref ? continueText : "Start practice"}
                      </div>
                      <div className="mt-1 text-xs text-white/80">
                        {continueHref
                          ? "Resume exactly where you left off"
                          : "Auto-picks the best mode for you"}
                      </div>
                    </div>

                    {continueHref ? (
                      <Link
                        to={continueHref}
                        className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:opacity-95"
                      >
                        Continue →
                      </Link>
                    ) : (
                      <button
                        onClick={smartStart}
                        disabled={smartStarting}
                        className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold ${
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
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/85">
                    <span className="inline-flex items-center rounded-full bg-white/15 px-2 py-1">
                      ⚡ Fast sessions
                    </span>
                    <span className="inline-flex items-center rounded-full bg-white/15 px-2 py-1">
                      🎯 Fluency-focused
                    </span>
                    <span className="inline-flex items-center rounded-full bg-white/15 px-2 py-1">
                      🏆 XP + streak
                    </span>
                  </div>
                </div>

                {/* Optional Smart Start message */}
                {smartStartMsg ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    {smartStartMsg}
                  </div>
                ) : null}

                {/* QUICK MODE PICKER (always visible) */}
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">Choose a mode</div>
                    <button
                      type="button"
                      onClick={() => setShowMoreModes((v) => !v)}
                      className="text-xs font-semibold text-slate-600 underline-offset-4 hover:underline"
                    >
                      {showMoreModes ? "Hide details" : "View details"}
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {/* Typing */}
                    <button
                      disabled={!modeAvail.typing}
                      onClick={() => startMode("typing")}
                      className={`rounded-2xl border p-4 text-left transition ${
                        modeAvail.typing
                          ? "border-slate-200 bg-gradient-to-br from-slate-50 to-white hover:shadow-sm"
                          : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold">Typing</div>
                          <div className="mt-1 text-xs text-slate-500">Fast fluency builder</div>
                        </div>
                        <span className="rounded-full bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white">
                          {pct(typingProg)}%
                        </span>
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
                        modeAvail.reorder
                          ? "border-slate-200 bg-gradient-to-br from-slate-50 to-white hover:shadow-sm"
                          : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold">Reorder</div>
                          <div className="mt-1 text-xs text-slate-500">
                            Fix word order instantly
                          </div>
                        </div>
                        <span className="rounded-full bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white">
                          {pct(reorderProg)}%
                        </span>
                      </div>
                      <div className="mt-3 h-2 w-full rounded-full bg-slate-200">
                        <div
                          className="h-2 rounded-full bg-slate-900"
                          style={{ width: `${pct(reorderProg)}%` }}
                        />
                      </div>
                    </button>

                    {/* Audio (kept premium even if disabled) */}
                    <button
                      disabled={!modeAvail.audio}
                      onClick={() => startMode("audio")}
                      className={`rounded-2xl border p-4 text-left transition ${
                        modeAvail.audio
                          ? "border-slate-200 bg-gradient-to-br from-slate-50 to-white hover:shadow-sm"
                          : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold">Audio</div>
                          <div className="mt-1 text-xs text-slate-500">Repeat + Dictation</div>
                        </div>
                        <span className="rounded-full bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white">
                          {pct(audioProg)}%
                        </span>
                      </div>
                      <div className="mt-3 h-2 w-full rounded-full bg-slate-200">
                        <div
                          className="h-2 rounded-full bg-slate-900"
                          style={{ width: `${pct(audioProg)}%` }}
                        />
                      </div>
                    </button>
                  </div>

                  {/* DETAILS DRAWER (optional) */}
                  {showMoreModes && (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      <div className="font-semibold">What each mode does</div>
                      <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
                        <li><span className="font-semibold">Typing:</span> build speed + sentence flow</li>
                        <li><span className="font-semibold">Reorder:</span> fix grammar + word order</li>
                        <li><span className="font-semibold">Audio:</span> pronunciation + listening</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              )}

              {/* Typing */}
              {modeAvail.typing && (
                <button
                  onClick={() => startMode("typing")}
                  className="rounded-2xl border bg-white px-4 py-4 text-center hover:bg-gray-50"
                >
                  <div className="text-base font-semibold">Typing</div>
                  <div className="mt-1 text-xs text-gray-500">
                    Fast fluency builder
                  </div>
                </button>
              )}

              {/* Reorder */}
              {modeAvail.reorder && (
                <button
                  onClick={() => startMode("reorder")}
                  className="rounded-2xl border bg-white px-4 py-4 text-center hover:bg-gray-50"
                >
                  <div className="text-base font-semibold">Reorder</div>
                  <div className="mt-1 text-xs text-gray-500">
                    Fix word order instantly
                  </div>
                </button>
              )}

              {/* Audio */}
              {modeAvail.audio && (
                <button
                  onClick={() => startMode("audio")}
                  className="rounded-2xl border bg-white px-4 py-4 text-center hover:bg-gray-50"
                >
                  <div className="text-base font-semibold">Audio</div>
                  <div className="mt-1 text-xs text-gray-500">
                    Repeat + Dictation
                  </div>
                </button>
              )}

              {/* Cloze */}
              <button
                onClick={() => startMode("cloze")}
                disabled={!ENABLE_CLOZE}
                className={`rounded-2xl px-4 py-4 text-center ${
                  ENABLE_CLOZE
                    ? "border bg-white hover:bg-gray-50"
                    : "cursor-not-allowed bg-gray-100 text-gray-400"
                }`}
              >
                <div className="text-base font-semibold">Cloze</div>
                <div className="mt-1 text-xs text-gray-500">
                  {ENABLE_CLOZE ? "Fill the missing word" : "Coming soon"}
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
