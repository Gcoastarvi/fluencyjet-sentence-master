// client/src/pages/admin/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import ProtectedAdminRoute from "../../components/ProtectedAdminRoute";
import { getAdminDashboard } from "../../api/adminApi";

import UserTableSearch from "../../components/UserTableSearch";

function AdminDashboard() {
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

  {
    /* 📢 Global Broadcast Tool */
  }
  <div className="mt-8 p-8 bg-indigo-900 rounded-[3rem] text-white shadow-2xl shadow-indigo-200">
    <h3 className="text-xl font-black uppercase tracking-tighter mb-4">
      Global Broadcast
    </h3>
    <div className="flex gap-4">
      <input
        type="text"
        id="bulkMsg"
        placeholder="Type a message for all students..."
        className="flex-grow p-4 rounded-2xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 font-bold focus:ring-2 focus:ring-white"
      />
      <button
        onClick={async () => {
          const msg = document.getElementById("bulkMsg").value;
          // api.post('/api/admin/dashboard/bulk-message', { message: msg });
          alert("Broadcast Sent! 🚀");
        }}
        className="px-8 py-4 bg-white text-indigo-900 font-black rounded-2xl hover:bg-indigo-50 transition-all active:scale-95"
      >
        Send to All
      </button>
    </div>
  </div>;

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10">
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">
            Command Center
          </h2>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em] mt-2">
            Platform Overview & Insights
          </p>
        </header>

        {/* 📊 Admin KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatCard
            label="Total Masters"
            value={totalUsers}
            icon="👥"
            color="bg-indigo-50"
            text="text-indigo-600"
          />
          <StatCard
            label="Active Users"
            value={activeUsers}
            icon="🔥"
            color="bg-rose-50"
            text="text-rose-600"
          />
          <StatCard
            label="Avg. Rating"
            value={`${stats.avgRating?.toFixed(1) || "0.0"} / 5`}
            icon="⭐"
            color="bg-amber-50"
            text="text-amber-600"
          />
          <StatCard
            label="Total Lessons"
            value={totalLessons}
            icon="📚"
            color="bg-emerald-50"
            text="text-emerald-600"
          />
        </div>

        {/* ⭐ Feedback & Detailed Metrics Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-2 bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl">
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-8">
              User Table Search
            </h3>
            {/* 🎯 USER TABLE SEARCH GOES HERE */}
            <UserTableSearch />
          </div>

          <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl flex flex-col justify-center text-center">
            <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-4">
              Engagement Score
            </p>
            <p className="text-6xl font-black text-slate-900 mb-2">
              {avgXPPerUser?.toFixed(0) || 0}
            </p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-tight leading-none">
              Avg XP / Student
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// 🛡️ Helper Component for beautiful cards
function StatCard({ label, value, icon, color, text }) {
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
      <div
        className={`h-12 w-12 ${color} rounded-2xl flex items-center justify-center text-2xl mb-6`}
      >
        {icon}
      </div>
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-2">
        {label}
      </p>
      <p
        className={`text-3xl font-black ${text} tracking-tighter leading-none`}
      >
        {value ?? "-"}
      </p>
    </div>
  );
}

export default AdminDashboard;
