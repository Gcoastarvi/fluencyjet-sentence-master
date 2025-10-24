import { useEffect, useState } from "react";
import LessonCard from "@/components/LessonCard";
import LockBadge from "@/components/LockBadge";

export default function Dashboard() {
  const [lessons, setLessons] = useState([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("fj_token");

  // 🧠 Fetch user progress (XP + Streak + Badges)
  useEffect(() => {
    if (!token) return;

    fetch(`${import.meta.env.VITE_API_URL}/api/progress/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setProgress(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Progress fetch failed:", err);
        setLoading(false);
      });
  }, [token]);

  // 📚 Load lessons (placeholder)
  useEffect(() => {
    fetch("/api/lessons")
      .then((r) => r.json())
      .then(setLessons)
      .catch(console.error);
  }, []);

  // 🏆 Manual XP award (for testing)
  async function earnXP() {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/progress/update`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ xpEarned: 100 }), // reward for test
        },
      );
      const data = await res.json();
      setProgress(data);
    } catch (err) {
      console.error("XP update failed:", err);
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

      {/* ⏳ Loading indicator */}
      {loading && (
        <p className="text-center text-gray-400">Loading your progress...</p>
      )}

      {/* 🔥 Progress Display */}
      {progress && !loading && (
        <div className="bg-indigo-50 p-4 rounded-xl shadow text-center">
          <p className="text-lg font-semibold text-indigo-700">
            XP: <b>{progress.xp ?? 0}</b>
          </p>

          <div className="mt-2 w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-violet-500 h-3 rounded-full transition-all"
              style={{
                width: `${Math.min(((progress.xp ?? 0) / 1000) * 100, 100)}%`,
              }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Level goal: {Math.floor((progress.xp ?? 0) / 1000) + 1}
          </p>

          <p className="mt-2">
            🔥 <b>Streak:</b> {progress.streak ?? 0} day
            {progress.streak > 1 ? "s" : ""}
          </p>

          <p>
            🏅 <b>Badges:</b>{" "}
            {progress.badges?.length
              ? progress.badges.join(", ")
              : "None yet — keep learning!"}
          </p>

          <button
            onClick={earnXP}
            className="mt-3 bg-violet-600 text-white px-5 py-2 rounded-full hover:scale-105 transition"
          >
            +100 XP Test
          </button>
        </div>
      )}

      {/* 🔓 Lessons */}
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
