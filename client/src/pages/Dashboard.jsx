// client/src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { fetchMyProgress, awardXP } from "@/lib/xpTracker";
import LessonCard from "@/components/LessonCard";
import LockBadge from "@/components/LockBadge";
import { API_BASE } from "@/lib/api"; // ✅ centralized base for /api calls

export default function Dashboard() {
  const [lessons, setLessons] = useState([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // ✅ Load user progress once after mount
  useEffect(() => {
    (async () => {
      try {
        const data = await fetchMyProgress();
        if (data) setProgress(data);
      } catch (e) {
        console.error("Progress fetch failed:", e);
        setErr(e.message || "Failed to load progress");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ✅ Load lesson list (placeholder until real backend)
  useEffect(() => {
    fetch(`${API_BASE}/api/lessons`)
      .then((r) => r.json())
      .then(setLessons)
      .catch((err) => {
        console.warn("Lesson fetch failed:", err);
        setLessons([]);
      });
  }, []);

  // ✅ Simulate XP for debugging
  async function simulateXP() {
    try {
      const updated = await awardXP({
        xpEarned: 50,
        type: "debug",
        completedQuiz: false,
      });
      if (updated) setProgress(updated);
    } catch (e) {
      console.error("Simulate XP failed:", e);
      alert(e.message || "XP update failed");
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5">
      <h2 className="text-2xl font-bold text-center text-indigo-700">
        Your Dashboard
      </h2>
      <p className="text-center text-gray-500">
        Earn XP by completing lessons daily!
      </p>

      {loading && <p className="text-center text-gray-500">Loading…</p>}
      {err && <p className="text-center text-red-500">{err}</p>}

      {progress && (
        <div className="bg-indigo-50 p-4 rounded-xl shadow-sm text-center space-y-2">
          <p>
            XP: <b>{progress.xp ?? 0}</b>
          </p>
          <div className="w-full bg-gray-200 h-2 rounded-full">
            <div
              className="bg-violet-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min((progress.xp % 1000) / 10, 100)}%` }}
              aria-label="XP progress"
            />
          </div>
          <p>
            🔥 Streak: <b>{progress.streak ?? 0}</b> days
          </p>
          <p>
            🏅 Badges:{" "}
            {progress.badges?.length ? progress.badges.join(", ") : "None yet"}
          </p>

          <button
            onClick={simulateXP}
            className="mt-2 bg-violet-600 text-white px-4 py-2 rounded-full hover:scale-105 transition"
          >
            +50 XP (simulate)
          </button>
        </div>
      )}

      <LockBadge hasAccess={hasAccess} />
      <div className="grid gap-4">
        {lessons.map((l, i) => (
          <LessonCard
            key={i}
            lesson={l}
            locked={!hasAccess && i > 2}
            onSelect={() => alert("Lesson Opened!")}
          />
        ))}
      </div>
    </div>
  );
}
