import React, { useMemo } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

// IMPORTANT:
// This page expects Lessons page to navigate here with `state: { lesson }`.
// If not present (hard refresh), we gracefully fall back to showing a minimal UI.

export default function LessonDetail() {
  const { lessonSlug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const lesson = location.state?.lesson || null;

  const lessonId = lesson?.id;
  const title = lesson?.lessonTitle || lesson?.title || lessonSlug;

  const session = useMemo(() => {
    if (!lessonId) return null;
    const s = readLastSession();
    if (!s) return null;

    const sameLesson = String(s.lessonId) === String(lessonId);
    if (!sameLesson) return null;

    return s;
  }, [lessonId]);

  const continueHref =
    session && session.mode
      ? `/practice/${session.mode}?lessonId=${encodeURIComponent(lessonId)}`
      : null;

  function startMode(mode) {
    if (!lessonId) return;
    navigate(`/practice/${mode}?lessonId=${encodeURIComponent(lessonId)}`);
  }

  function readLastSession() {
    try {
      return JSON.parse(localStorage.getItem("fj_last_session") || "null");
    } catch {
      return null;
    }
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
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
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
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Continue */}
          {continueHref ? (
            <Link
              to={continueHref}
              className="rounded-2xl bg-black px-4 py-4 text-center text-white hover:opacity-90"
            >
              <div className="text-base font-semibold">Continue</div>
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

          {/* Cloze (disabled) */}
          <button
            disabled
            className="cursor-not-allowed rounded-2xl border bg-white px-4 py-4 text-center opacity-60"
            title="Coming soon"
          >
            <div className="text-base font-semibold">Cloze</div>
            <div className="mt-1 text-xs text-gray-500">Coming soon</div>
          </button>

          {/* Audio (disabled) */}
          <button
            disabled
            className="cursor-not-allowed rounded-2xl border bg-white px-4 py-4 text-center opacity-60"
            title="Coming soon"
          >
            <div className="text-base font-semibold">Audio</div>
            <div className="mt-1 text-xs text-gray-500">Coming soon</div>
          </button>
        </div>
      </div>
    </div>
  );
}
