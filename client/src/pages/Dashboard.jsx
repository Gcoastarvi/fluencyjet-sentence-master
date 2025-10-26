// client/src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { fetchMyProgress, awardXP } from "@/lib/xpTracker";
import LessonCard from "@/components/LessonCard";
import LockBadge from "@/components/LockBadge";
import { API_BASE } from "@/lib/api";

export default function Dashboard() {
  const [lessons, setLessons] = useState([]);
  const [hasAccess] = useState(false); // keep as-is until paywall is wired
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  async function loadProgress() {
    setLoading(true);
    setErr("");
    try {
      const data = await fetchMyProgress();
      setProgress(data ?? null);
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Progress fetch failed:", e);
      setErr(e?.message || "Failed to load progress");
      setProgress(null);
    } finally {
      setLoading(false);
    }
  }

  // Load user progress once after mount
  useEffect(() => {
    loadProgress();
    // Optionally re-fetch when the tab regains focus
    const onFocus = () => loadProgress();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // Load lesson list (fallback if endpoint not present)
  useEffect(() => {
    fetch(`${API_BASE}/api/lessons`)
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error("No lessons API")),
      )
      .then((list) => setLessons(Array.isArray(list) ? list : []))
      .catch(() => {
        // harmless placeholder
        setLessons([
          {
            title: "Basics 1",
            description: "Simple Tamil → English sentences",
          },
          { title: "Basics 2", description: "Pronouns & verbs" },
          { title: "Daily Life", description: "Common phrases" },
          { title: "Past Tense", description: "Narrating events" },
        ]);
      });
  }, []);

  // Simulate XP for debugging
  async function simulateXP() {
    try {
      const updated = await awardXP({
        xpEarned: 50,
        type: "debug",
        completedQuiz: false,
      });
      if (updated) {
        setProgress(updated);
        setLastUpdated(new Date());
      }
    } catch (e) {
      console.error("Simulate XP failed:", e);
      alert(e?.message || "XP update failed");
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-indigo-700">Your Dashboard</h2>
        <button
          onClick={loadProgress}
          className="text-sm bg-indigo-600 text-white px-3 py-1 rounded-full hover:opacity-90"
          aria-label="Refresh progress"
        >
          Refresh
        </button>
      </div>

      <p className="text-center text-gray-500">
        Earn XP by completing lessons daily!
      </p>

      {loading && <p className="text-center text-gray-500">Loading…</p>}
      {err && !loading && <p className="text-center text-red-500">{err}</p>}

      {!loading && !err && !progress && (
        <p className="text-center text-gray-500">
          No progress yet — complete a quiz to get started!
        </p>
      )}

      {progress && (
        <div className="bg-indigo-50 p-4 rounded-xl shadow-sm text-center space-y-3">
          <p>
            XP: <b>{progress.xp ?? 0}</b>
          </p>

          <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-violet-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(((progress.xp ?? 0) % 1000) / 10, 100)}%`,
              }}
              aria-label="XP progress"
              role="progressbar"
            />
          </div>

          <p>
            🔥 Streak: <b>{progress.streak ?? 0}</b> days
          </p>

          <p>
            🏅 Badges:{" "}
            {Array.isArray(progress.badges) && progress.badges.length
              ? progress.badges.join(", ")
              : "None yet"}
          </p>

          <button
            onClick={simulateXP}
            className="bg-violet-600 text-white px-4 py-2 rounded-full hover:scale-105 transition"
          >
            +50 XP (simulate)
          </button>

          {lastUpdated && (
            <p className="text-xs text-gray-500">
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
      )}

      <LockBadge hasAccess={hasAccess} />

      <div className="grid gap-4">
        {lessons.map((l, i) => (
          <LessonCard
            key={`${l.title ?? "lesson"}-${i}`}
            lesson={l}
            locked={!hasAccess && i > 2}
            onSelect={() => alert("Lesson Opened!")}
          />
        ))}
      </div>
    </div>
  );
}
