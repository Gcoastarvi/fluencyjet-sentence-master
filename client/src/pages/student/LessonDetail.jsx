import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

// Audio v1 can be turned on later without refactor:
const ENABLE_AUDIO = true;
const ENABLE_CLOZE = false; // keep off unless you really have cloze exercises

const PREF_KEY_SHOW_TA = "fj_pref_show_ta"; // "1" or "0"
const LAST_SESSION_KEY = "fj_last_session";

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function getShowTaDefault(lessonIdNum) {
  // simple default: beginner lessons show Tamil help
  if (!lessonIdNum) return true;
  return lessonIdNum <= 3;
}

function readPrefShowTa(lessonIdNum) {
  const raw = localStorage.getItem(PREF_KEY_SHOW_TA);
  if (raw === "1") return true;
  if (raw === "0") return false;
  return getShowTaDefault(lessonIdNum);
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
  const { lessonId: lessonIdParam } = useParams(); // App.jsx uses :lessonId
  const lessonIdNum = Number(lessonIdParam);
  const lessonId = lessonIdParam; // keep as string for URL encoding

  const location = useLocation();
  const navigate = useNavigate();

  // If Lessons page passes state: { lesson }, we use it. If not, we still render safely.
  const [lesson, setLesson] = useState(location.state?.lesson || null);

  // Lock rule (MVP-safe): first 3 lessons free.
  // Later you can replace isLocked with entitlements check.
  const isFree = Number(lessonIdNum) <= 3;
  const isLocked = !isFree;

  // Preference toggle (Show Tamil help)
  //const [showTa, setShowTa] = useState(() => {
  // Avoid SSR issues (not relevant here) and keep predictable default
  //if (typeof window === "undefined") return true;
  //return readPrefShowTa(lessonIdNum);
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
          list.find((l) => String(l?.id) === String(lessonIdNum)) ||
          list.find((l) => String(l?.dayNumber) === String(lessonIdNum)) ||
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
  }, [lesson, lessonIdNum]);

  const title =
    lesson?.lessonTitle ||
    lesson?.title ||
    lesson?.name ||
    `Lesson ${lessonIdNum || ""}`;

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

  const qNum = session
    ? Math.max(1, Number(session.questionIndex || 0) + 1)
    : null;
  const continueText = session
    ? `Continue • ${modeLabel(session.mode)} • Q${qNum}`
    : "Continue";
  const continueHref =
    session && session.mode
      ? `/practice/${session.mode}?lessonId=${encodeURIComponent(lessonId)}`
      : null;

  function goPaywall() {
    navigate(`/paywall?plan=BEGINNER&from=lesson_${lessonIdNum || ""}`);
  }

  function startMode(mode) {
    if (!lessonId) return;
    if (isLocked) return goPaywall();

    if (mode === "audio" && !ENABLE_AUDIO) return;
    if (mode === "cloze" && !ENABLE_CLOZE) return;

    navigate(`/practice/${mode}?lessonId=${encodeURIComponent(lessonId)}`);
  }

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

        {/* Preference toggle */}
        {/*<div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gray-50 p-4">
          <div>
            <div className="text-sm font-semibold">Language help</div>
            <div className="text-xs text-gray-600">
              Turn Tamil hints on/off across the app.
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowTa((v) => !v)}
            className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50"
            title="Saved for future sessions"
          >
            {showTa ? "Tamil help: ON" : "Tamil help: OFF"}
          </button>
        </div>

        {/* Progress summary */}
        <div className="mt-5 rounded-2xl bg-gray-50 p-4">
          <div className="text-sm font-medium">Progress summary</div>

          <div className="mt-3 space-y-3">
            {/* Top mini-cards */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-white p-3">
                <div className="text-xs text-gray-500">Lesson</div>
                <div className="text-sm font-semibold">
                  {lessonIdNum || "—"}
                </div>
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

            {/* Typing progress */}
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

            {/* Reorder progress */}
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
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Continue */}
          {continueHref ? (
            <Link
              to={continueHref}
              className="rounded-2xl bg-black px-4 py-4 text-center text-white hover:opacity-90"
            >
              <div className="text-base font-semibold">{continueText}</div>
              <div className="mt-1 text-xs text-gray-200">
                Resume exactly where you left off
              </div>
            </Link>
          ) : (
            <button
              disabled
              className="cursor-not-allowed rounded-2xl bg-gray-200 px-4 py-4 text-center text-gray-500"
            >
              <div className="text-base font-semibold">Continue</div>
              <div className="mt-1 text-xs">Start a mode to enable</div>
            </button>
          )}

          {/* Typing */}
          <button
            onClick={() => startMode("typing")}
            className="rounded-2xl border bg-white px-4 py-4 text-center hover:bg-gray-50"
          >
            <div className="text-base font-semibold">Typing</div>
            <div className="mt-1 text-xs text-gray-500">
              Fast fluency builder
            </div>
          </button>

          {/* Reorder */}
          <button
            onClick={() => startMode("reorder")}
            className="rounded-2xl border bg-white px-4 py-4 text-center hover:bg-gray-50"
          >
            <div className="text-base font-semibold">Reorder</div>
            <div className="mt-1 text-xs text-gray-500">
              Fix word order instantly
            </div>
          </button>

          {/* Cloze (kept future-ready, off by default) */}
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

          {/* Audio */}
          <button
            onClick={() => startMode("audio")}
            disabled={!lessonId}
            className={`rounded-2xl px-4 py-4 text-center ${
              lessonId
                ? "border bg-white hover:bg-gray-50"
                : "cursor-not-allowed bg-gray-100 text-gray-400"
            }`}
          >
            <div className="text-base font-semibold">Audio</div>
            <div className="mt-1 text-xs text-gray-500">Repeat + Dictation</div>
          </button>
        </div>

        {/* Tiny note for devs */}
        <div className="mt-4 text-xs text-gray-400">
          Preference saved:{" "}
          <span className="font-mono">{PREF_KEY_SHOW_TA}</span>
        </div>
      </div>
    </div>
  );
}
