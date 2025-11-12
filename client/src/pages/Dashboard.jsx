// client/src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { getUserProfile } from "../api";
import { fetchMyProgress, awardXP } from "@/lib/xpTracker";
import LessonCard from "@/components/LessonCard";
import LockBadge from "@/components/LockBadge";
import { API_BASE } from "@/lib/api";
import { startTokenWatcher } from "@/utils/tokenWatcher";
import { getDisplayName } from "@/utils/displayName";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [hasAccess] = useState(false);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [toasts, setToasts] = useState([]);

  /* 🔔 Toast utilities */
  const dismissToast = (id) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 400);
  };

  const pushToast = (msg, type = "info") => {
    const id = Date.now();
    const toast = { id, msg, type, exiting: false };

    // Auto-dismiss after 3s
    setTimeout(() => dismissToast(id), 3000);

    // Keep only latest 4
    setToasts((prev) => {
      const updated = [...prev, toast];
      return updated.slice(-4);
    });
  };

  /* ✅ Token watcher & session refresh listener */
  useEffect(() => {
    startTokenWatcher(60000);

    const handleSessionRefreshed = () =>
      pushToast("✅ Session refreshed! You’re still logged in.", "success");

    window.addEventListener("sessionRefreshed", handleSessionRefreshed);
    return () =>
      window.removeEventListener("sessionRefreshed", handleSessionRefreshed);
  }, []);

  /* ✅ Load user profile */
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

  /* ✅ Load XP Progress */
  async function loadProgress() {
    setLoading(true);
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

  /* ✅ Lessons & refresh on focus */
  useEffect(() => {
    loadProgress();
    const onFocus = () => loadProgress();
    window.addEventListener("focus", onFocus);

    fetch(`${API_BASE}/api/lessons`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((list) => setLessons(Array.isArray(list) ? list : []))
      .catch(() => {
        console.warn("No lessons API found — using fallback list");
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

  /* ✅ Simulate XP (debug) */
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
        pushToast("🎉 +50 XP added!", "success");
      }
    } catch (e) {
      console.error("Simulate XP failed:", e);
      pushToast("⚠️ XP update failed.", "error");
    }
  }

  const displayName = getDisplayName(user);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      {/* 🪄 Toast Container */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex flex-col-reverse space-y-reverse space-y-2">
        {toasts.map((t, i) => {
          const delay = Math.min(i * 80, 400);
          const typeClass =
            t.type === "error"
              ? "toast-error"
              : t.type === "warning"
                ? "toast-warning"
                : t.type === "info"
                  ? "toast-info"
                  : "toast-success";
          return (
            <div
              key={t.id}
              className={`toast ${typeClass} ${
                t.exiting ? "toast-exit" : "toast-seq-enter"
              } cursor-pointer`}
              style={{ animationDelay: `${delay}ms` }}
              onClick={() => dismissToast(t.id)}
              role="status"
              aria-live="polite"
            >
              <span className="flex items-center gap-2">
                {t.type === "error" && "❌"}
                {t.type === "warning" && "⚠️"}
                {t.type === "info" && "💬"}
                {t.type === "success" && "✅"}
                <span>{t.msg}</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* 🧭 Header */}
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
