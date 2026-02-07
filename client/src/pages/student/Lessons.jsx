// client/src/pages/student/Lessons.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/api/apiClient";

// --- local progress helpers (same storage keys used by SentencePractice) ---
const progressKey = (lid, mode) => `fj_progress:${lid}:${mode}`;

function readProgress(lid, mode) {
  try {
    return JSON.parse(localStorage.getItem(progressKey(lid, mode)) || "null");
  } catch {
    return null;
  }
}

function pct(p) {
  const c = Number(p?.completed || 0);
  const t = Number(p?.total || 0);
  if (!t) return 0;
  return Math.max(0, Math.min(100, Math.round((c / t) * 100)));
}

export default function Lessons() {
  const navigate = useNavigate();

  const [lessons, setLessons] = useState([]);
  const [unlocked, setUnlocked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const getDayNumber = (lesson, index) =>
    Number(
      lesson?.dayNumber ??
        lesson?.day_number ??
        lesson?.orderIndex ??
        lesson?.order_index ??
        index + 1,
    );

  const getTileProgress = (dayNumber) => {
    const typingProg = readProgress(dayNumber, "typing");
    const reorderProg = readProgress(dayNumber, "reorder");
    const audioProg = readProgress(dayNumber, "audio");

    const typingPct = pct(typingProg);
    const reorderPct = pct(reorderProg);
    const audioPct = pct(audioProg);

    const bestPct = Math.max(typingPct, reorderPct, audioPct);

    const hasStarted =
      (Number(typingProg?.completed || 0) > 0 &&
        Number(typingProg?.total || 0) > 0) ||
      (Number(reorderProg?.completed || 0) > 0 &&
        Number(reorderProg?.total || 0) > 0) ||
      (Number(audioProg?.completed || 0) > 0 &&
        Number(audioProg?.total || 0) > 0);

    return {
      typingProg,
      reorderProg,
      audioProg,
      bestPct,
      hasStarted,
      typingPct,
      reorderPct,
      audioPct,
    };
  };

  useEffect(() => {
    let alive = true;

    async function fetchLessons() {
      try {
        setLoading(true);
        setError("");

        const res = await api.get("/lessons");
        const data = res?.data ?? res;

        if (!data?.ok) throw new Error(data?.error || "Failed to load lessons");

        if (!alive) return;
        setLessons(Array.isArray(data.lessons) ? data.lessons : []);
        setUnlocked(Array.isArray(data.unlocked) ? data.unlocked : []);
      } catch (err) {
        console.error("❌ Lessons fetch failed:", err);
        if (!alive) return;
        setError(err?.message || "Failed to load lessons");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    fetchLessons();
    return () => {
      alive = false;
    };
  }, []);

  const orderedLessons = useMemo(() => {
    const arr = Array.isArray(lessons) ? [...lessons] : [];
    return arr.sort((a, b) => {
      const aDay = getDayNumber(a, 0);
      const bDay = getDayNumber(b, 0);

      const aUnlocked = unlocked.includes(a?.id);
      const bUnlocked = unlocked.includes(b?.id);

      // unlocked first
      if (aUnlocked !== bUnlocked) return aUnlocked ? -1 : 1;

      // then by dayNumber ascending
      return aDay - bDay;
    });
  }, [lessons, unlocked]);

  const recommendedLessonId = useMemo(() => {
    // rule: first unlocked lesson with lowest progress %
    const unlockedLessons = orderedLessons.filter((l) =>
      unlocked.includes(l?.id),
    );
    if (!unlockedLessons.length) return null;

    let best = null;
    let bestScore = Infinity;

    for (let i = 0; i < unlockedLessons.length; i++) {
      const l = unlockedLessons[i];
      const dayNumber = getDayNumber(l, i);
      const t = getTileProgress(dayNumber);
      const score = Number.isFinite(t.bestPct) ? t.bestPct : 0;

      if (score < bestScore) {
        bestScore = score;
        best = l;
      }
    }

    return best?.id ?? null;
  }, [orderedLessons, unlocked]);

  if (loading) {
    return (
      <div className="text-center text-xl text-indigo-600 mt-20">
        Loading lessons…
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-xl text-red-600 mt-20">{error}</div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6 mt-6">
      <h1 className="text-3xl font-bold text-indigo-700 text-center">
        Lessons
      </h1>

      <div className="space-y-4">
        {orderedLessons.map((lesson, index) => {
          const isUnlocked = unlocked.includes(lesson.id);
          const isCompleted = Boolean(lesson.completed);
          const dayNumber = getDayNumber(lesson, index);

          const t = getTileProgress(dayNumber);
          const bestPct = t.bestPct;
          const hasStarted = t.hasStarted;

          const isRecommended = isUnlocked && recommendedLessonId === lesson.id;

          const primaryLabel = !isUnlocked
            ? "Locked"
            : hasStarted
              ? "Continue"
              : "Start";

          const goPrimary = () => {
            if (!isUnlocked) {
              navigate(`/paywall?plan=BEGINNER&from=lesson_${dayNumber}`);
              return;
            }
            navigate(`/lesson/${dayNumber}`);
          };

          return (
            <div
              key={lesson.id ?? `${lesson.slug ?? "lesson"}_${index}`}
              className="relative p-5 bg-white rounded-xl shadow hover:shadow-lg transition"
            >
              {/* Lock badge */}
              {!isUnlocked && (
                <div className="absolute right-3 top-3 rounded-full bg-gray-900/90 px-3 py-1 text-xs font-semibold text-white">
                  🔒 Locked
                </div>
              )}

              {/* Progress badge */}
              {isUnlocked && (
                <div className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gray-800 border">
                  {bestPct}% done
                </div>
              )}

              {!isUnlocked && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-sm rounded-xl flex items-center justify-center text-3xl text-gray-600">
                  🔒
                </div>
              )}

              {isRecommended && (
                <div className="absolute left-3 top-3 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                  ⭐ Recommended next
                </div>
              )}

              <div className={isUnlocked ? "" : "opacity-40"}>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  Lesson {dayNumber}: {lesson.title}
                  {isCompleted && (
                    <span className="text-green-600 text-lg font-bold">✓</span>
                  )}
                </h2>

                <p className="text-gray-500 mt-1">{lesson.description}</p>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* Progress chips */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "Typing", p: t.typingProg },
                      { label: "Reorder", p: t.reorderProg },
                      { label: "Audio", p: t.audioProg },
                    ].map(({ label, p }) => (
                      <span
                        key={label}
                        className="rounded-full border bg-white px-3 py-1 text-xs text-gray-700"
                        title={`${label}: ${Number(p?.completed || 0)}/${Number(p?.total || 0)}`}
                      >
                        <span className="font-semibold">{label}</span>
                        <span className="text-gray-500"> • </span>
                        <span>{pct(p)}%</span>
                      </span>
                    ))}
                  </div>

                  {/* Primary CTA (single, clear) */}
                  <button
                    type="button"
                    onClick={goPrimary}
                    className={`px-5 py-2.5 rounded-full transition inline-flex items-center gap-2 ${
                      isUnlocked
                        ? "bg-indigo-600 text-white hover:scale-105"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    <span className="font-semibold">
                      {!isUnlocked
                        ? "Locked"
                        : hasStarted
                          ? "Continue"
                          : "Start"}
                    </span>
                    <span aria-hidden>→</span>
                  </button>

                  {/* Small helper text under CTA (optional but makes it feel premium) */}
                  <div className="text-xs text-gray-500 sm:text-right">
                    {!isUnlocked
                      ? `Unlock to access`
                      : hasStarted
                        ? `Resume where you left off`
                        : `Open Practice Hub`}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
