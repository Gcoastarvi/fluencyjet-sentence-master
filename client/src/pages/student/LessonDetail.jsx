import React, { useMemo } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useParams } from "react-router-dom";

// IMPORTANT:
// This page expects Lessons page to navigate here with `state: { lesson }`.
// If not present (hard refresh), we gracefully fall back to showing a minimal UI.

export default function LessonDetail() {
  const { lessonSlug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const lesson = location.state?.lesson || null;

  const { lessonId: lessonIdParam } = useParams();
  const lessonIdNum = Number(lessonIdParam); // this is dayNumber for paywall redirect

  const lessonDbId = lesson?.id; // this is Lesson table id if present via navigation state
  const title =
    lesson?.lessonTitle ||
    lesson?.title ||
    lessonSlug ||
    `Lesson ${lessonIdNum || ""}`;

  if (!lesson) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-2">Lesson {lessonIdNum}</h1>
        <p className="text-red-600 font-semibold mb-4">
          Locked. Upgrade required to continue.
        </p>

        <div className="space-y-3">
          <a
            href="/checkout"
            className="inline-block px-5 py-3 rounded-xl bg-purple-600 text-white font-semibold"
          >
            Unlock Beginner Course
          </a>

          <a href="/lessons" className="block text-sm underline">
            Go back to lessons
          </a>
        </div>
      </div>
    );
  }

  function readLastSession() {
    try {
      return JSON.parse(localStorage.getItem("fj_last_session") || "null");
    } catch {
      return null;
    }
  }

  function readProgress(lessonId, mode) {
    try {
      return JSON.parse(
        localStorage.getItem(`fj_progress:${lessonId}:${mode}`) || "null",
      );
    } catch {
      return null;
    }
  }

  const session = useMemo(() => {
    if (!lessonId) return null;
    const s = readLastSession();
    if (!s) return null;

    // ✅ allow Continue only for supported modes
    const m = String(s.mode || "").toLowerCase();
    if (!["typing", "reorder", "cloze", "audio"].includes(m)) return null;

    const sameLesson = String(s.lessonId) === String(lessonId);
    if (!sameLesson) return null;

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

  const pct = (p) => {
    const total = Number(p?.total || 0);
    const done = Number(p?.completed || 0);
    if (!total) return 0;
    return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
  };

  const lastAt = (p) => Number(p?.updatedAt || 0);

  const formatLast = (ms) => {
    if (!ms) return "—";
    const diff = Date.now() - ms;
    if (diff < 60_000) return "just now";
    if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 24 * 60 * 60_000)
      return `${Math.floor(diff / (60 * 60_000))}h ago`;
    return `${Math.floor(diff / (24 * 60 * 60_000))}d ago`;
  };

  const modeLabel = (m) => {
    if (!m) return "";
    const x = String(m).toLowerCase();
    if (x === "typing") return "Typing";
    if (x === "reorder") return "Reorder";
    if (x === "cloze") return "Cloze";
    if (x === "audio") return "Audio";
    return x.charAt(0).toUpperCase() + x.slice(1);
  };

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

  function startMode(mode) {
    if (!lessonId) return;
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

        <div className="mt-5 rounded-2xl bg-gray-50 p-4">
          <div className="text-sm font-medium">Progress summary</div>

          {!lessonId ? (
            <div className="mt-2 text-sm text-gray-600">
              (Tip: open this page from Lessons list so it can load lesson
              details.)
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {/* Top mini-cards */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-xl bg-white p-3">
                  <div className="text-xs text-gray-500">Lesson</div>
                  <div className="text-sm font-semibold">{lessonSlug}</div>
                </div>

                <div className="rounded-xl bg-white p-3">
                  <div className="text-xs text-gray-500">Continue</div>
                  <div className="text-sm font-semibold">
                    {session ? `Mode: ${session.mode}` : "No session yet"}
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
                  { label: "Cloze", p: clozeProg },
                ].map(({ label, p }) => (
                  <div
                    key={label}
                    className="rounded-full border bg-white px-3 py-1 text-xs"
                    title={`Last practiced: ${formatLast(lastAt(p))}`}
                  >
                    <span className="font-semibold">{label}</span>
                    <span className="text-gray-500"> • </span>
                    <span>{pct(p)}%</span>
                    <span className="text-gray-500"> • </span>
                    <span className="text-gray-600">
                      {formatLast(lastAt(p))}
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
          )}
        </div>

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
            disabled={!lessonId}
            className={`rounded-2xl px-4 py-4 text-center ${
              lessonId
                ? "border bg-white hover:bg-gray-50"
                : "cursor-not-allowed bg-gray-100 text-gray-400"
            }`}
          >
            <div className="text-base font-semibold">Typing</div>
            <div className="mt-1 text-xs text-gray-500">
              Fast fluency builder
            </div>
          </button>

          {/* Reorder */}
          <button
            onClick={() => startMode("reorder")}
            disabled={!lessonId}
            className={`rounded-2xl px-4 py-4 text-center ${
              lessonId
                ? "border bg-white hover:bg-gray-50"
                : "cursor-not-allowed bg-gray-100 text-gray-400"
            }`}
          >
            <div className="text-base font-semibold">Reorder</div>
            <div className="mt-1 text-xs text-gray-500">
              Fix word order instantly
            </div>
          </button>

          {/* Cloze */}
          <button
            onClick={() => startMode("cloze")}
            disabled={!lessonId}
            className={`rounded-2xl px-4 py-4 text-center ${
              lessonId
                ? "border bg-white hover:bg-gray-50"
                : "cursor-not-allowed bg-gray-100 text-gray-400"
            }`}
          >
            <div className="text-base font-semibold">Cloze</div>
            <div className="mt-1 text-xs text-gray-500">
              Fill the missing word
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
            <div className="mt-1 text-xs text-gray-500">Listen + repeat</div>
          </button>
        </div>
      </div>
    </div>
  );
}
