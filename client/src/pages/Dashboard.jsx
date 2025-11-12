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
  // 🔁 Add a toast with automatic type detection + color/icon
  // 🚀 Smart toast queue (auto-trims to last 4 messages)
  // 🌊 Smart toast queue with cascading exit animation
  const pushToast = (msg, type = "info") => {
    const id = Date.now();
    const toast = { id, msg, type, exiting: false, timer: null };

    // 🔹 Auto-detect type if not provided
    const lower = msg.toLowerCase();
    if (!type) {
      if (lower.includes("success") || lower.includes("saved"))
        type = "success";
      else if (lower.includes("error") || lower.includes("fail"))
        type = "error";
      else if (lower.includes("warn") || lower.includes("expire"))
        type = "warning";
      else type = "info";
    }

    // ✅ Maintain only last 4 visible
    setToasts((prev) => {
      const updated = [...prev];

      // If more than 4 → cascade exit the oldest
      if (updated.length >= 4) {
        updated.forEach((t, i) => {
          // add staggered delay (0.1s per index)
          setTimeout(() => {
            setToasts((p) =>
              p.map((x) => (x.id === t.id ? { ...x, exiting: true } : x)),
            );
            setTimeout(() => {
              setToasts((p) => p.filter((x) => x.id !== t.id));
            }, 400);
          }, i * 100); // wave timing (100ms apart)
        });
      }

      return [...updated, toast];
    });

    // Auto-dismiss after 3s
    toast.timer = setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
      );
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 400);
    }, 3000);
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
      {/* ✅ Toast container (Duolingo style, colored + icon) */}
      {/* ✅ Toast container (click-to-dismiss + colors + animation) */}
      {/* ✅ Toast container (pause on hover + click to dismiss) */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex flex-col-reverse space-y-reverse space-y-2">
        {toasts.map((t, i) => {
          const isLeaving = leavingIds.has(t.id);
          const delay = Math.min(i * 80, 400); // your existing stagger
          const typeClass =
            t.type === "error"
              ? "toast-error"
              : t.type === "warning"
                ? "toast-warning"
                : t.type === "info"
                  ? "toast-info"
                  : "toast-success"; // default to success

          return (
            <div
              key={t.id}
              className={`toast ${typeClass} ${isLeaving ? "toast-exit" : "toast-seq-enter"} cursor-pointer`}
              style={{ animationDelay: `${delay}ms` }}
              onMouseEnter={() => pauseToast(t.id)} // if you added hover-pause
              onMouseLeave={() => resumeToast(t.id)} // if you added hover-pause
              onClick={() => dismissToast(t.id)} // click to dismiss
              role="status"
              aria-live="polite"
            >
              {/* 🎉 Confetti only for success toasts */}
              {t.type === "success" && (
                <div className="toast-confetti" aria-hidden="true">
                  {Array.from({ length: 12 }).map((_, k) => {
                    // distribute to both sides with small variance
                    const spread = (k - 5.5) * 6; // -33 .. +33 px
                    const rot = (k % 2 ? 18 : -14) + k; // slight spin variety
                    const delay = k * 20; // ripple emission
                    const isBar = k % 4 === 0; // a few bars
                    return (
                      <span
                        key={k}
                        className={`sparkle ${isBar ? "bar" : ""}`}
                        style={{
                          "--dx": `${spread}px`,
                          "--rot": `${rot}deg`,
                          "--delay": `${delay}ms`,
                        }}
                      />
                    );
                  })}
                </div>
              )}

              {/* your existing icon + message */}
              <span className="flex items-center gap-2">
                {t.type === "error" && "❌"}
                {t.type === "warning" && "⚠️"}
                {t.type === "info" && "💬"}
                {t.type === "success" && "✅"}
                <span>{t.message}</span>
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        import {getDisplayName} from "@/utils/displayName"; // ...
        <h2 className="text-2xl font-bold text-indigo-700">
          {`Welcome, ${getDisplayName(user)} 🎉`}
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
