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

function deriveDayNumber(lesson) {
  const slug = String(lesson?.slug || "").toLowerCase();
  if (slug === "english-diagnostic") return 1;
  const m = slug.match(/(?:basic|inter|intermediate)-(\d+)/);
  return m ? Number(m[1]) : Number(lesson?.id) || null;
}

function getDayNumber(lesson, index) {
  // ✅ Prefer explicit dayNumber-like fields if present
  const direct =
    lesson?.dayNumber ??
    lesson?.day_number ??
    lesson?.practiceDayNumber ??
    lesson?.practice_day_number;

  if (Number.isFinite(Number(direct)) && Number(direct) > 0)
    return Number(direct);

  // ✅ Parse trailing number in slug (intermediate-13, basic-2)
  const slug = String(lesson?.slug || lesson?.lessonSlug || "");
  const m = slug.match(/(\d+)(?!.*\d)/);
  if (m) return Number(m[1]);

  // fallback: index-based legacy behavior
  return index + 1;
}

export default function Lessons({ track = "beginner", basePath = "" }) {
  const navigate = useNavigate();

  const [lessons, setLessons] = useState([]);
  const [unlocked, setUnlocked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [streak, setStreak] = useState(0);
  const [summary, setSummary] = useState({ streakFreezes: 0 });
  const [masteryNote, setMasteryNote] = useState(null);

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
    const masteredDay = localStorage.getItem("fj_show_mastery_popup");
    if (masteredDay) {
      setMasteryNote(masteredDay);
      localStorage.removeItem("fj_show_mastery_popup"); // 🧹 Clear it so it only shows once
    }
  }, []);

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

  useEffect(() => {
    async function fetchStreak() {
      try {
        const res = await api.get("/dashboard/summary");
        const data = res?.data ?? res;
        if (data?.ok) {
          setStreak(data.streak || 0);
          setSummary(data); // 👈 Add this line to store the full data
        }
      } catch (err) {
        console.error("Failed to fetch summary for Lessons page:", err);
      }
    }
    fetchStreak();
  }, [api]);

  const orderedLessons = useMemo(() => {
    const arr = Array.isArray(lessons) ? [...lessons] : [];

    // ✅ Filter by track (beginner vs intermediate)
    const filtered = arr.filter((l) => {
      const diff = String(
        l?.difficulty || l?.lessonLevel || "beginner",
      ).toLowerCase();
      const isInter = diff === "intermediate";
      return track === "intermediate" ? isInter : !isInter;
    });

    return filtered.sort((a, b) => {
      const aDay = getDayNumber(a, 0);
      const bDay = getDayNumber(b, 0);

      const aUnlocked = unlocked.includes(a?.id);
      const bUnlocked = unlocked.includes(b?.id);

      if (aUnlocked !== bUnlocked) return aUnlocked ? -1 : 1;
      return aDay - bDay;
    });
  }, [lessons, unlocked, track]);

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
      {/* 🏆 Mastery Celebration Popup */}
      {masteryNote && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[3rem] p-8 max-w-sm w-full text-center shadow-2xl animate-bounce-in">
            <div className="text-6xl mb-4">🎖️</div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Mastery Unlocked!
            </h2>
            <p className="text-slate-500 mt-2 text-sm leading-relaxed">
              Congratulations! You've officially conquered every mode in{" "}
              <span className="font-bold text-indigo-600">
                Lesson {masteryNote}
              </span>
              .
            </p>

            <div className="mt-8 space-y-3">
              <button
                onClick={() => navigate(`/b/hall-of-fame`)}
                className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100"
              >
                View in Hall of Fame
              </button>
              <button
                onClick={() => setMasteryNote(null)}
                className="w-full py-3 rounded-2xl bg-slate-100 text-slate-600 font-bold text-xs uppercase tracking-widest hover:bg-slate-200"
              >
                Keep Learning
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 🔥 Daily Streak Visual */}
      <div className="flex flex-col items-center mb-8 animate-bounce-subtle">
        <div className="relative">
          <span className="text-5xl">🔥</span>
          <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-[12px] font-bold text-white shadow-lg border-2 border-white">
            {streak || 0}
          </div>
        </div>
        <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-orange-600">
          Day Streak
        </div>
      </div>
      <h1 className="text-3xl font-black text-indigo-700 text-center tracking-tight">
        {track === "intermediate" ? "Intermediate Lessons" : "Beginner Lessons"}
      </h1>

      <div className="flex justify-center mb-4">
        <button
          onClick={() => navigate("/b/hall-of-fame")}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
        >
          <span>🏆</span> View Hall of Fame
        </button>
      </div>

      {/* 🔥 Daily Streak + 🛡️ Protection Shield */}
      <div className="flex flex-col items-center mb-8 animate-bounce-subtle">
        <div className="flex items-center gap-4">
          <div className="relative">
            <span className="text-5xl">🔥</span>
            <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-[12px] font-bold text-white shadow-lg border-2 border-white">
              {streak || 0}
            </div>
          </div>

          {/* 🧊 NEW: Streak Freeze Active Indicator */}
          {summary.streakFreezes > 0 && (
            <div
              className="relative group cursor-help"
              title="Streak Freeze Active"
            >
              <span className="text-4xl">🛡️</span>
              <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[10px] font-black text-white shadow-md border-2 border-white">
                {summary.streakFreezes}
              </div>
            </div>
          )}
        </div>

        <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-orange-600">
          Current Progress
        </div>
      </div>

      {/* 🏆 Navigation to Hall of Fame */}
      <div className="flex justify-center mb-4">
        <button
          onClick={() => navigate(`${basePath}/hall-of-fame`)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
        >
          <span>🏆</span> View Hall of Fame
        </button>
      </div>

      <div className="space-y-4">
        {orderedLessons.map((lesson, index) => {
          const isUnlocked = unlocked.includes(lesson.id);
          const dayNumber = getDayNumber(lesson, index);

          // 🎀 Unified Mastery & Progress Calculation
          const { isMastered, bestPct, hasStarted } = (() => {
            const modes = ["typing", "reorder", "audio"];
            let maxP = 0;
            let started = false;

            const stats = modes
              .map((m) => {
                const raw = localStorage.getItem(
                  `fj_progress:${dayNumber}:${m}`,
                );
                if (!raw) return null;
                try {
                  const p = JSON.parse(raw);
                  const total = Number(p.total || 0);
                  const completed = Number(p.completed || 0);
                  const pctValue =
                    total > 0 ? Math.round((completed / total) * 100) : 0;
                  if (pctValue > 0) started = true;
                  if (pctValue > maxP) maxP = pctValue;
                  return pctValue;
                } catch {
                  return null;
                }
              })
              .filter((s) => s !== null);

            return {
              isMastered: stats.length > 0 && stats.every((s) => s === 100),
              bestPct: maxP,
              hasStarted: started,
            };
          })();

          const isRecommended = isUnlocked && recommendedLessonId === lesson.id;

          const goPrimary = () => {
            const diff = String(
              lesson?.difficulty || lesson?.lessonLevel || track || "beginner",
            ).toLowerCase();
            if (!isUnlocked) {
              navigate(
                `/paywall?plan=${diff === "intermediate" ? "INTERMEDIATE" : "BEGINNER"}&from=lesson_${dayNumber}&difficulty=${encodeURIComponent(diff)}`,
              );
              return;
            }
            navigate(
              `${basePath}/lesson/${dayNumber}?difficulty=${encodeURIComponent(diff)}`,
            );
          };

          return (
            <div
              key={lesson.id ?? `${lesson.slug ?? "lesson"}_${index}`}
              onClick={goPrimary}
              className={`relative p-6 cursor-pointer rounded-[2rem] border-2 transition-all duration-300 ${
                isMastered
                  ? "border-emerald-100 bg-emerald-50/20 shadow-sm"
                  : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-md"
              }`}
            >
              {/* Status Badges (Lock & Progress) */}
              {!isUnlocked ? (
                <div className="absolute right-4 top-4 rounded-full bg-slate-900 px-3 py-1 text-[10px] font-bold text-white uppercase tracking-widest">
                  🔒 Locked
                </div>
              ) : hasStarted && !isMastered ? (
                <div className="absolute right-3 top-3 rounded-full bg-violet-600 px-3 py-1 text-[10px] font-bold text-white uppercase tracking-tight">
                  {bestPct}% done
                </div>
              ) : null}

              {isRecommended && (
                <div className="absolute left-3 -top-3 rounded-full bg-amber-400 px-3 py-1 text-[10px] font-black text-amber-900 uppercase tracking-widest shadow-sm">
                  ⭐ Recommended next
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className={isUnlocked ? "" : "opacity-40"}>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                    Lesson {dayNumber}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {lesson.title || `Mastery Session ${dayNumber}`}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {lesson.description}
                  </p>
                </div>
                <div className="text-2xl text-slate-300 group-hover:text-indigo-500 transition-colors">
                  {isUnlocked ? "→" : "🔒"}
                </div>
              </div>
              {isMastered && <MasteryRibbon />}
            </div>
          );
        })}
      </div>
    </div>
  );
// 🎀 Mastery Ribbon Component (Placed outside the main Lessons component)
function MasteryRibbon() {
  return (
    <div className="absolute -top-2 -left-2 z-10 animate-pop-in">
      <div className="relative flex items-center justify-center">
        <span className="text-3xl drop-shadow-md">🎀</span>
        <div className="absolute inset-0 bg-emerald-400/20 blur-lg rounded-full" />
      </div>
    </div>
  );
}