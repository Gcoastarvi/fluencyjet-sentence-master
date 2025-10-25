import { useEffect, useState } from "react";
import { fetchMyProgress, awardXP } from "@/lib/xpTracker";
import LessonCard from "@/components/LessonCard";
import LockBadge from "@/components/LockBadge";

export default function Dashboard() {
  const [lessons, setLessons] = useState([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Load progress
  useEffect(() => {
    (async () => {
      try {
        const p = await fetchMyProgress();
        setProgress(p);
      } catch (e) {
        setErr(e.message || "Failed to load progress");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Placeholder lessons
  useEffect(() => {
    fetch("/api/lessons")
      .then((r) => r.json())
      .then(setLessons)
      .catch(() => setLessons([]));
  }, []);

  async function simulateXP() {
    try {
      const updated = await awardXP({
        xpEarned: 50,
        type: "debug",
        completedQuiz: false,
      });
      setProgress(updated);
    } catch (e) {
      alert(e.message || "XP add failed");
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
            XP: <b>{progress.xp}</b>
          </p>
          <div className="w-full bg-gray-200 h-2 rounded-full">
            <div
              className="bg-violet-600 h-2 rounded-full"
              style={{ width: `${Math.min((progress.xp % 1000) / 10, 100)}%` }}
              aria-label="XP progress"
            />
          </div>
          <p>
            🔥 Streak: <b>{progress.streak}</b> days
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
