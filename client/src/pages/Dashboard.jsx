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

  useEffect(() => {
    async function loadSummary() {
      try {
        const data = await apiFetch("/api/dashboard/summary");

        if (!data || data.error) {
          setError("Failed to load dashboard");
          setLoading(false);
          return;
        }

        setSummary(data);
        setLoading(false);
      } catch (err) {
        console.error("Dashboard load error", err);
        setError("Something went wrong");
        setLoading(false);
      }
    }

    loadSummary();
  }, []);

  if (loading) return <div>Loading dashboard...</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;

  return (
    <div style={{ padding: "20px", lineHeight: "1.6" }}>
      <h2>Dashboard</h2>
      <p>
        <strong>{getDisplayName()}</strong>
      </p>

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

      <h3>XP to next level</h3>
      <p>{summary.xpToNextLevel}</p>

      <h3>Next Badge</h3>
      <p>{summary.nextBadge ? summary.nextBadge.label : "No next badge"}</p>

      <h3>Pending Lessons</h3>
      <p>
        {summary.pendingLessons.length === 0
          ? "All caught up! 🎉"
          : summary.pendingLessons.join(", ")}
      </p>

      <h3>Recent Activity</h3>
      {summary.recentActivity.length === 0 ? (
        <p>No XP events yet. Try a quiz!</p>
      ) : (
        summary.recentActivity.map((e) => (
          <div key={e.id}>
            +{e.xp_delta} XP — {e.event_type}
          </div>
        ))
      )}
    </div>
  );
}
