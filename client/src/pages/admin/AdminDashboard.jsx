// client/src/pages/admin/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import ProtectedAdminRoute from "../../components/ProtectedAdminRoute";
import { getAdminDashboard } from "../../api/adminApi";

function AdminDashboardInner() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setLoading(true);
        setError("");

        // adminApi.getAdminDashboard already returns the JSON payload
        const data = await getAdminDashboard();

        if (!data?.ok) {
          throw new Error(data?.message || "Dashboard response not ok");
        }

        setStats(data);
      } catch (err) {
        console.error("Failed to load admin dashboard:", err);
        setError(err?.message || "Failed to load admin dashboard data.");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "2rem" }}>
        <h2>Admin Dashboard</h2>
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "2rem" }}>
        <h2>Admin Dashboard</h2>
        <p style={{ color: "red" }}>{error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ padding: "2rem" }}>
        <h2>Admin Dashboard</h2>
        <p>No data available.</p>
      </div>
    );
  }

  const {
    totalUsers,
    activeUsers,
    totalQuizzes,
    totalLessons,
    totalXP,
    avgXPPerUser,
    dailyActiveUsers,
  } = stats;

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Admin Dashboard</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
          marginTop: "1.5rem",
        }}
      >
        <div className="admin-card">
          <h3>Total Users</h3>
          <p>{totalUsers ?? "-"}</p>
        </div>

        <div className="admin-card">
          <h3>Active Users (7 days)</h3>
          <p>{activeUsers ?? "-"}</p>
        </div>

        <div className="admin-card">
          <h3>Daily Active Users (today)</h3>
          <p>{dailyActiveUsers ?? "-"}</p>
        </div>

        <div className="admin-card">
          <h3>Total Lessons</h3>
          <p>{totalLessons ?? "-"}</p>
        </div>

        <div className="admin-card">
          <h3>Total Quizzes</h3>
          <p>{totalQuizzes ?? "-"}</p>
        </div>

        <div className="admin-card">
          <h3>Total XP Earned</h3>
          <p>{totalXP ?? "-"}</p>
        </div>

        <div className="admin-card">
          <h3>Average XP per User</h3>
          <p>{avgXPPerUser ?? "-"}</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <ProtectedAdminRoute>
      <AdminDashboardInner />
    </ProtectedAdminRoute>
  );
}
