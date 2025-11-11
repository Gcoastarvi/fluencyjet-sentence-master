// client/src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { getUserProfile } from "../api";
import { fetchMyProgress, awardXP } from "@/lib/xpTracker";
import LessonCard from "@/components/LessonCard";
import LockBadge from "@/components/LockBadge";
import { API_BASE } from "@/lib/api";
import { startTokenWatcher } from "@/utils/tokenWatcher";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [hasAccess] = useState(false);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  // 🧩 Multi-toast system
  const [toasts, setToasts] = useState([]);

  // 🔁 Add a toast safely (auto remove after 3s with exit animation)
  const pushToast = (msg) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, exiting: false }]);

    // Start exit animation at 2.7s
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
      );
    }, 2700);

    // Fully remove after 3.1s (gives time for exit animation)
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3100);
  };

  // ✅ Session refresh listener
  useEffect(() => {
    function handleSessionRefreshed() {
      pushToast("✅ Session refreshed! You’re still logged in.");
    }
    window.addEventListener("sessionRefreshed", handleSessionRefreshed);
    return () =>
      window.removeEventListener("sessionRefreshed", handleSessionRefreshed);
  }, []);

  // ✅ Token watcher
  useEffect(() => {
    startTokenWatcher(60000);
  }, []);

  // ✅ Load user profile
  useEffect(() => {
    async function loadUserProfile() {
      try {
        const res = await getUserProfile();
        if (res?.data?.user) setUser(res.data.user);
        else if (res?.data?.name) setUser(res.data);
        else setErr("Please login to view your dashboard.");
      } catch (e) {
        console.error("Failed to load profile:", e);
        setErr("Unable to fetch user profile. Please log in again.");
      }
    }
    loadUserProfile();
  }, []);

  // ✅ Load XP Progress
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

  // ✅ Lessons & refresh on focus
  useEffect(() => {
    loadProgress();
    const onFocus = () => loadProgress();
    window.addEventListener("focus", onFocus);

    fetch(`${API_BASE}/api/lessons`)
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error("No lessons API")),
      )
      .then((list) => setLessons(Array.isArray(list) ? list : []))
      .catch(() => {
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

    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // ✅ Simulate XP (Debug)
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
        pushToast("🎉 +50 XP added!");
      }
    } catch (e) {
      console.error("Simulate XP failed:", e);
      pushToast("⚠️ XP update failed.");
    }
  }

  const displayName =
    user?.name || localStorage.getItem("userName") || "Learner";

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      {/* ✅ Toast stack container */}
      {/* ✅ Toast stack container with staggered animation */}
      {/* ✅ Toast stack container with staggered animation and smooth exit */}
      {/* ✅ Toast stack container (newest at bottom, like Duolingo/Discord) */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex flex-col-reverse space-y-reverse space-y-2">
        {toasts.map((t, i) => (
          <div
            key={t.id}
            className={`bg-gray-900 text-white px-4 py-2 rounded-xl shadow-lg ${
              t.exiting ? "toast-exit" : "toast-seq-enter"
            }`}
            style={{
              animationDelay: !t.exiting ? `${i * 0.15}s` : "0s",
            }}
          >
            {t.msg}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-indigo-700">
          {`Welcome, ${displayName} 🎉`}
        </h2>
        <button
          onClick={loadProgress}
          className="text-sm bg-indigo-600 text-white px-3 py-1 rounded-full hover:opacity-90"
        >
          Refresh
        </button>
      </div>

      <p className="text-center text-gray-500">
        Earn XP by completing lessons daily!
      </p>

      {loading && <p className="text-center text-gray-500">Loading...</p>}
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
