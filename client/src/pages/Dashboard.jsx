// client/src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import customFetch from "../utils/fetch";
import { getDisplayName } from "../utils/displayName";

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
    nextBadge: null,
    pendingLessons: [],
    recentActivity: [],
  });

  useEffect(() => {
    async function loadSummary() {
      try {
        setLoading(true);
        setError("");

        // ⭐ FIXED: use customFetch so Authorization header is ALWAYS sent
        const res = await customFetch("/api/dashboard/summary");

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        // ⭐ Defensive: avoid crashing if fields missing
        setSummary({
          todayXP: data.todayXP ?? 0,
          yesterdayXP: data.yesterdayXP ?? 0,
          weeklyXP: data.weeklyXP ?? 0,
          lastWeekXP: data.lastWeekXP ?? 0,
          totalXP: data.totalXP ?? 0,
          level: data.level ?? 1,
          xpToNextLevel: data.xpToNextLevel ?? 0,
          nextBadge: data.nextBadge ?? null,
          pendingLessons: data.pendingLessons ?? [],
          recentActivity: data.recentActivity ?? [],
        });
      } catch (err) {
        console.error("Dashboard summary error:", err);
        setError("Could not load live data. Showing defaults.");
      } finally {
        setLoading(false);
      }
    }

    loadSummary();
  }, []);

  return (
    <div className="dashboard-container" style={{ padding: "20px" }}>
      <h2>Dashboard</h2>

      {error && <p style={{ color: "red", marginBottom: "20px" }}>{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <h3>Today's XP</h3>
          <p>{summary.todayXP}</p>

          <h3>Yesterday</h3>
          <p>{summary.yesterdayXP}</p>

          <h3>This Week</h3>
          <p>{summary.weeklyXP}</p>

          <h3>Last Week</h3>
          <p>{summary.lastWeekXP}</p>

          <h3>Total XP</h3>
          <p>{summary.totalXP}</p>

          <h3>Level</h3>
          <p>{summary.level}</p>

          <h4>XP to next level: {summary.xpToNextLevel}</h4>

          <h3>Next Badge</h3>
          <p>{summary.nextBadge ? summary.nextBadge : "No next badge"}</p>

          <h3>Pending Lessons</h3>
          {summary.pendingLessons.length === 0 ? (
            <p>All caught up! 🎉</p>
          ) : (
            <ul>
              {summary.pendingLessons.map((lesson) => (
                <li key={lesson.id}>{lesson.title}</li>
              ))}
            </ul>
          )}

          <h3>Recent Activity</h3>
          {summary.recentActivity.length === 0 ? (
            <p>No XP events yet. Try a quiz!</p>
          ) : (
            <ul>
              {summary.recentActivity.map((ev) => (
                <li key={ev.id}>
                  {ev.event_type} → +{ev.xp_delta} XP on{" "}
                  {new Date(ev.created_at).toLocaleString()}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
