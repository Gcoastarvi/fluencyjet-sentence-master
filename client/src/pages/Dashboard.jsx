// client/src/pages/Dashboard.jsx
import { useEffect, useState } from "react";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState({
    todayXP: 0,
    yesterdayXP: 0,
    weeklyXP: 0,
    lastWeekXP: 0,
    totalXP: 0,
    level: 1,
    xpToNextLevel: 0,
    nextBadge: null, // { label, min_xp } or null
    pendingLessons: [], // [{ id, title, completed }]
    recentActivity: [], // [{ id, xp_delta, event_type, created_at, meta }]
  });

  useEffect(() => {
    async function loadSummary() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/dashboard/summary", {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        // Defensive mapping so even if some fields are missing,
        // the dashboard still works instead of crashing.
        setSummary({
          todayXP: data.todayXP ?? 0,
          yesterdayXP: data.yesterdayXP ?? 0,
          weeklyXP: data.weeklyXP ?? 0,
          lastWeekXP: data.lastWeekXP ?? 0,
          totalXP: data.totalXP ?? 0,
          level: data.level ?? 1,
          xpToNextLevel: data.xpToNextLevel ?? 0,
          nextBadge: data.nextBadge ?? null,
          pendingLessons: Array.isArray(data.pendingLessons)
            ? data.pendingLessons
            : [],
          recentActivity: Array.isArray(data.recentActivity)
            ? data.recentActivity
            : [],
        });
      } catch (err) {
        console.error("Dashboard fetch failed:", err);
        // ❗ IMPORTANT: don't throw again – just show safe fallback
        setError("Could not load live data. Showing defaults.");
      } finally {
        setLoading(false);
      }
    }

    loadSummary();
  }, []);

  const {
    todayXP,
    yesterdayXP,
    weeklyXP,
    lastWeekXP,
    totalXP,
    level,
    xpToNextLevel,
    nextBadge,
    pendingLessons,
    recentActivity,
  } = summary;

  return (
    <main className="page">
      <h1>Dashboard</h1>

      {loading && <p>Loading dashboard…</p>}

      {!loading && (
        <>
          {error && (
            <p style={{ color: "#d9534f", marginBottom: "1rem" }}>{error}</p>
          )}

          {/* Top stats row */}
          <section className="card-row">
            <div className="card">
              <h3>Today&apos;s XP</h3>
              <p>{todayXP}</p>
            </div>
            <div className="card">
              <h3>Yesterday</h3>
              <p>{yesterdayXP}</p>
            </div>
            <div className="card">
              <h3>This Week</h3>
              <p>{weeklyXP}</p>
            </div>
            <div className="card">
              <h3>Last Week</h3>
              <p>{lastWeekXP}</p>
            </div>
          </section>

          {/* Level + Badge */}
          <section className="card-row">
            <div className="card">
              <h3>Total XP</h3>
              <p>{totalXP}</p>
            </div>
            <div className="card">
              <h3>Level</h3>
              <p>{level}</p>
              <small>XP to next level: {xpToNextLevel}</small>
            </div>
            <div className="card">
              <h3>Next Badge</h3>
              {nextBadge ? (
                <>
                  <p>{nextBadge.label}</p>
                  <small>Unlock at {nextBadge.min_xp} XP</small>
                </>
              ) : (
                <p>No next badge</p>
              )}
            </div>
          </section>

          {/* Pending lessons */}
          <section className="card">
            <h2>Pending Lessons</h2>
            {pendingLessons.length === 0 ? (
              <p>All caught up! 🎉</p>
            ) : (
              <ul>
                {pendingLessons.map((lesson) => (
                  <li key={lesson.id}>
                    {lesson.title}{" "}
                    {lesson.completed ? "(Completed)" : "(Pending)"}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent XP activity */}
          <section className="card">
            <h2>Recent Activity</h2>
            {recentActivity.length === 0 ? (
              <p>No XP events yet. Try a quiz!</p>
            ) : (
              <ul>
                {recentActivity.map((e) => (
                  <li key={e.id}>
                    <strong>{e.event_type}</strong> – {e.xp_delta} XP on{" "}
                    {new Date(e.created_at).toLocaleString()}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
