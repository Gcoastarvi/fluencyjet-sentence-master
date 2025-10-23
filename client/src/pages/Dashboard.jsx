// client/src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import LessonCard from "@/components/LessonCard";
import LockBadge from "@/components/LockBadge";

export default function Dashboard() {
  const [lessons, setLessons] = useState([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [progress, setProgress] = useState(null);

  const token = localStorage.getItem("fj_token");

  // 🧠 Fetch user progress (XP + Streak)
  useEffect(() => {
    if (!token) return;
    fetch(`${import.meta.env.VITE_API_URL}/api/progress`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setProgress)
      .catch(console.error);
  }, [token]);

  // 📚 Load lessons (placeholder)
  useEffect(() => {
    fetch("/api/lessons")
      .then((r) => r.json())
      .then(setLessons)
      .catch(console.error);
  }, []);

  async function earnXP() {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/progress/update`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ xpEarned: 10 }),
      },
    );
    const data = await res.json();
    setProgress(data);
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5">
      <h2 className="text-2xl font-bold text-center text-indigo-700">
        Your Dashboard
      </h2>
      <p className="text-center text-gray-500">
        Earn XP by completing lessons daily!
      </p>

      {/* 🔥 Show progress */}
      {progress && (
        <div className="bg-indigo-50 p-4 rounded-xl shadow-sm text-center">
          <p>
            XP: <b>{progress.xp}</b>
          </p>
          <p>
            🔥 Streak: <b>{progress.streak}</b> days
          </p>
          <p>
            🏅 Badges:{" "}
            {progress.badges?.length ? progress.badges.join(", ") : "None yet"}
          </p>
          <button
            onClick={earnXP}
            className="mt-3 bg-violet-600 text-white px-4 py-2 rounded-full hover:scale-105 transition"
          >
            +10 XP
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
