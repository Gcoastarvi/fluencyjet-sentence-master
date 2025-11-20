// client/src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { apiFetch } from "../utils/fetch";
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

  // -----------------------
  // 🟦 Load Summary
  // -----------------------
  useEffect(() => {
    async function loadSummary() {
      try {
        setLoading(true);
        setError("");

        // 🔥 Correct: token-based custom fetch wrapper
        const data = await apiFetch("/api/dashboard/summary", {
          method: "GET",
        });

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
        console.error("Dashboard Load Error:", err);
        setError("Could not load live data. Showing defaults.");
      } finally {
        setLoading(false);
      }
    }

    loadSummary();
  }, []);

  // -----------------------
  // 🟦 UI
  // -----------------------
  return (
    <div style={{ padding: "20px" }}>
      <h2>Dashboard</h2>

      {error && <p style={{ color: "red", marginBottom: "10px" }}>{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <h3>{getDisplayName()}</h3>

          <div style={{ marginTop: "20px" }}>
            <h4>Today's XP</h4>
            <p>{summary.todayXP}</p>

            <h4>Yesterday</h4>
            <p>{summary.yesterdayXP}</p>

            <h4>This Week</h4>
            <p>{summary.weeklyXP}</p>

            <h4>Last Week</h4>
            <p>{summary.lastWeekXP}</p>

            <h4>Total XP</h4>
            <p>{summary.totalXP}</p>

            <h4>Level</h4>
            <p>{summary.level}</p>

            <h4>XP to next level</h4>
            <p>{summary.xpToNextLevel}</p>

            <h4>Next Badge</h4>
            <p>{summary.nextBadge || "No next badge"}</p>

            <h4>Pending Lessons</h4>
            {summary.pendingLessons.length > 0 ? (
              <ul>
                {summary.pendingLessons.map((lesson) => (
                  <li key={lesson.id}>{lesson.title}</li>
                ))}
              </ul>
            ) : (
              <p>All caught up! 🎉</p>
            )}

            <h4>Recent Activity</h4>
            {summary.recentActivity.length > 0 ? (
              <ul>
                {summary.recentActivity.map((event) => (
                  <li key={event.id}>
                    {event.event_type} — {event.xp_delta} XP on{" "}
                    {new Date(event.created_at).toLocaleString()}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No XP events yet. Try a quiz!</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
