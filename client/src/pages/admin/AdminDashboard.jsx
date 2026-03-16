// client/src/pages/admin/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import ProtectedAdminRoute from "../../components/ProtectedAdminRoute";
import { getAdminDashboard } from "../../api/adminApi";

import UserTableSearch from "../../components/UserTableSearch";

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 🎯 SUPER-SAFE LOGIC: We calculate this directly every render
  const safeLessons = Array.isArray(lessons) ? lessons : [];
  const filteredLessons = safeLessons.filter((lesson) => {
    const search = (searchTerm || "").toLowerCase();
    return (
      lesson?.tamil_sentence?.toLowerCase().includes(search) ||
      lesson?.english_mastery_goal?.toLowerCase().includes(search) ||
      lesson?.level?.toLowerCase().includes(search)
    );
  });

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

  useEffect(() => {
    async function loadLessons() {
      try {
        // Assuming you have this helper in adminApi.js
        const data = await getAdminLessons();
        if (data?.ok) {
          setLessons(data.lessons || []);
        }
      } catch (err) {
        console.error("Failed to fetch lessons:", err);
      }
    }
    loadLessons();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this lesson?")) return;

    try {
      const res = await deleteLesson(id);
      if (res.ok) {
        // 🎯 Refresh the list automatically after deletion
        setLessons((prev) => prev.filter((lesson) => lesson.id !== id));
        alert("Lesson deleted successfully!");
      }
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete lesson.");
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      // 🎯 We'll use the 'upsert' route we organized earlier
      const res = await api.post("admin/lessons/upsert", formData);
      if (res.data.ok) {
        alert(`Success! Imported ${res.data.count} lessons.`);
        fetchDashboard(); // Refresh your stats cards automatically
      }
    } catch (err) {
      alert("Import failed. Check CSV format.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (
      !window.confirm("🚨 CEO WARNING: This will delete ALL lessons. Proceed?")
    )
      return;
    try {
      // We'll create a new 'bulk-delete' route or simply loop deletes
      const res = await api.delete("admin/lessons/clear-all");
      if (res.data.ok) {
        setLessons([]);
        alert("Database wiped clean. Ready for a fresh import!");
      }
    } catch (err) {
      alert("Clear failed. Please check backend logs.");
    }
  };

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {/* Card 1: Total Masters (Users) */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                👥
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Total Masters
              </p>
            </div>
            <h2 className="text-4xl font-black text-slate-900">
              {stats?.users ?? "-"}
            </h2>
          </div>

          {/* Card 4: Total Lessons */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
                📚
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Total Lessons
              </p>
            </div>
            <h2 className="text-4xl font-black text-slate-900 text-emerald-500">
              {stats?.lessons ?? "-"}
            </h2>
          </div>
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

      <div className="mt-8 bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
  <h3 className="text-xl font-bold text-slate-800 mb-6">Curriculum Overview</h3>

  <div className="overflow-x-auto">
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="border-b border-slate-50">
          <th className="py-4 px-4 text-slate-400 font-medium">Level</th>
          <th className="py-4 px-4 text-slate-400 font-medium">
            Tamil Sentence
          </th>
          <th className="py-4 px-4 text-slate-400 font-medium">English Goal</th>
          <th className="py-4 px-4 text-slate-400 font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {filteredLessons.length > 0 ? (
          filteredLessons.map((lesson) => (
            <tr
              key={lesson.id}
              className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
            >
              <td className="py-4 px-4 font-bold text-indigo-600">
                {lesson.level}
              </td>
              <td className="py-4 px-4 text-slate-700">
                {lesson.tamil_sentence}
              </td>
              <td className="py-4 px-4 text-slate-600 italic">
                "{lesson.english_mastery_goal}"
              </td>
              <td className="py-4 px-4">
                <button className="text-rose-500 hover:text-rose-700 font-medium">
                  Delete
                </button>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan="4" className="py-10 text-center text-slate-400">
              No lessons found. Use Bulk Import to start!
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
      </div>

      {/* 📤 Bulk Import Section */}
      <div className="mt-10 p-8 bg-indigo-900 rounded-[3rem] text-white shadow-xl shadow-indigo-200">
  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
    <div>
      <h3 className="text-2xl font-black mb-2">Master Curriculum Upload</h3>
      <p className="text-indigo-200 text-sm">
        Upload your .csv file to populate {120 + 150} total master sentences.
      </p>
    </div>
    <div className="flex gap-4">
      <input
        type="file"
        id="csvUpload"
        className="hidden"
        accept=".csv"
        onChange={handleFileUpload}
      />
      <label
        htmlFor="csvUpload"
        className="bg-white text-indigo-900 px-8 py-4 rounded-2xl font-black cursor-pointer hover:scale-105 transition-transform"
      >
        Select CSV File
      </label>
    </div>
  </div>
      </div>

      <button
        onClick={handleClearAll}
        className="border-2 border-rose-500 text-rose-500 px-6 py-4 rounded-2xl font-black hover:bg-rose-50 transition-all"
      >
        Clear All Lessons
      </button>
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
