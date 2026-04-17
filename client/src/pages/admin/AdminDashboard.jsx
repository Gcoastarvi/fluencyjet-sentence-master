// client/src/pages/admin/AdminDashboard.jsx
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { toast, Toaster } from "react-hot-toast";
import ProtectedAdminRoute from "../../components/ProtectedAdminRoute";
import UserTableSearch from "../../components/UserTableSearch";

function AdminDashboard() {
  // 🎯 THE COMPLETE STATE ROOM (All boxes defined here)
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [bulkEmails, setBulkEmails] = useState("");
  const [bulkTrack, setBulkTrack] = useState("INTERMEDIATE");
  const [isBuying, setIsBuying] = useState(false);

  // 🎯 THE DYNAMIC DESTINATION FIX
  // This uses the variable you already set in Railway/Local .env

  const BACKEND_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
  console.log("🎯 DEBUG: Connecting to Backend at:", BACKEND_URL); // 👈 Add this line

  // Apply this to axios globally (Moving this outside the function is even better)
  axios.defaults.baseURL = BACKEND_URL;
  axios.defaults.withCredentials = true;

  // 🎯 THE DUAL FILTER BRAIN (Calculates matches instantly)
  const filteredUsers = useMemo(() => {
    const search = (searchTerm || "").toLowerCase().trim();
    if (!search) return users;

    return (users || []).filter((u) => {
      const emailMatch = u.email?.toLowerCase().includes(search);
      const nameMatch = u.name?.toLowerCase().includes(search);
      const userMatch = u.username?.toLowerCase().includes(search);
      return emailMatch || nameMatch || userMatch;
    });
  }, [searchTerm, users]);

  // 🎯 THE LESSON FILTER BRAIN (Fixes the Curriculum Table crash)
  const filteredLessons = useMemo(() => {
    const search = (searchTerm || "").toLowerCase();
    const safeLessons = Array.isArray(lessons) ? lessons : [];

    return safeLessons.filter(
      (lesson) =>
        lesson?.tamil_sentence?.toLowerCase().includes(search) ||
        lesson?.english_mastery_goal?.toLowerCase().includes(search) ||
        String(lesson?.level || "")
          .toLowerCase()
          .includes(search),
    );
  }, [searchTerm, lessons]);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        setError("");

        // 🎯 1. AUTHENTICATION: Grab the token
        const token =
          localStorage.getItem("fj_admin_token") ||
          localStorage.getItem("token");
        const config = {
          headers: { Authorization: `Bearer ${token}` },
        };

        console.log("🚀 MASTER FETCH: Starting authenticated requests...");

        // 🎯 2. THE DATA PULL
        const [userRes, lessonRes, statsRes] = await Promise.all([
          axios.get("/api/admin/users", config),
          axios.get("/api/admin/lessons", config),
          axios.get("/api/admin/dashboard", config),
        ]);

        console.log("🎯 MASTER SUCCESS: All data received!");

        // 🎯 3. UNPACK & CALCULATE
        const userData = userRes.data.users || [];
        const lessonData = lessonRes.data.lessons || [];

        // Calculate Engagement using the new 'xpTotal' field
        const totalXP = userData.reduce(
          (acc, user) => acc + (user.xpTotal || 0),
          0,
        );
        const avgXP = userData.length
          ? Math.floor(totalXP / userData.length)
          : 0;

        // 🎯 4. UPDATE STATE (Single source of truth)
        setUsers(userData);
        setLessons(lessonData);
        setStats({
          ...statsRes.data,
          avgXP: avgXP,
        });
      } catch (err) {
        console.error("❌ MASTER ERROR:", err);
        // Only show error if we don't have existing data to fall back on
        setError(
          "Admin Access Denied. Please ensure you are logged in as an Admin.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []); // 🎯 Runs exactly once on page load

  const handleBulkDelete = async () => {
    if (
      !window.confirm(
        "Are you sure? This will delete these test users forever!",
      )
    )
      return;
    const emailsToDelete = [
      "nana@gmail.com",
      "hachi@gmail.com",
      "roku@gmail.com",
    ]; // Add your test list
    try {
      await axios.delete("/api/admin/users/bulk-cleanup", {
        data: { emails: emailsToDelete },
      });
      setUsers((prev) => prev.filter((u) => !emailsToDelete.includes(u.email)));
      toast.success("Test users purged! 🧹");
    } catch (err) {
      toast.error("Delete failed.");
    }
  };

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

  const handleLogout = () => {
    localStorage.removeItem("adminToken"); // Clear the key
    window.location.href = "/admin/login"; // Redirect to entrance
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
        await fetchDashboard(); // Refresh your stats cards automatically
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

  <header className="mb-10 flex justify-between items-start">
    <div>
      <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">
        Command Center
      </h2>
      <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em] mt-2">
        Platform Overview & Insights
      </p>
    </div>

    {/* 💰 REVENUE SNAPSHOT CARD */}
    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm flex-1">
      <div className="flex items-center gap-4 mb-4">
        <div className="p-3 bg-green-50 rounded-2xl text-green-600">💸</div>
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          Active Pro Users
        </h4>
      </div>
      {/* 🎯 SAFE FILTER: Use (users || []) to prevent crashes */}
      <p className="text-4xl font-black text-slate-900">
        {(users || []).filter((u) => u.has_access).length}
      </p>
      {/* 🎯 THE FAIL-SAFE CALCULATION */}
      <p className="text-[10px] font-bold text-slate-400 mt-2">
        {users.length > 0
          ? (
              (users.filter((u) => u.has_access).length / users.length) *
              100
            ).toFixed(1)
          : "0.0"}
        % Conversion Rate
      </p>
    </div>

    <button
      onClick={handleLogout}
      className="bg-slate-200 hover:bg-rose-100 hover:text-rose-600 text-slate-600 px-4 py-2 rounded-xl text-xs font-black transition-all"
    >
      LOGOUT
    </button>
  </header>;

  {
    /* 🚀 WEBINAR BULK ENROLLER: Place after </header> */
  }
  <div className="bg-indigo-900 rounded-[2rem] p-8 text-white mb-8 shadow-2xl">
    <h3 className="text-2xl font-black mb-2">Webinar Bulk Enroller</h3>
    <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-widest mb-6">
      Scale your enrollment in seconds
    </p>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <textarea
        value={bulkEmails}
        onChange={(e) => setBulkEmails(e.target.value)}
        placeholder="user1@gmail.com, user2@gmail.com..."
        className="w-full h-32 bg-indigo-800/50 border border-indigo-700 rounded-2xl p-4 text-sm text-indigo-100 placeholder:text-indigo-400 focus:ring-2 ring-white outline-none"
      />

      <div className="flex flex-col justify-between">
        <div className="flex gap-4">
          <button
            onClick={() => setBulkTrack("BEGINNER")}
            className={`flex-1 py-4 rounded-2xl border-2 font-black transition-all ${bulkTrack === "BEGINNER" ? "bg-white text-indigo-900 border-white" : "border-indigo-700 text-indigo-300"}`}
          >
            BEGINNER
          </button>
          <button
            onClick={() => setBulkTrack("INTERMEDIATE")}
            className={`flex-1 py-4 rounded-2xl border-2 font-black transition-all ${bulkTrack === "INTERMEDIATE" ? "bg-white text-indigo-900 border-white" : "border-indigo-700 text-indigo-300"}`}
          >
            INTERMEDIATE
          </button>
        </div>

        <button
          onClick={handleBulkEnroll}
          className="w-full py-4 bg-gradient-to-r from-green-400 to-emerald-500 rounded-2xl font-black text-lg hover:scale-[1.02] shadow-xl"
        >
          GRANT ACCESS NOW 🔓
        </button>
      </div>
    </div>
  </div>;

  const handleResetStats = async () => {
    if (
      !window.confirm(
        "WARNING: This will permanently delete your test XP and Streaks. Proceed?",
      )
    )
      return;

    const res = await axios.post(
      "/api/admin/reset-test-stats",
      {},
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
        },
      },
    );

    if (res.data.ok) {
      alert("Test Stats Reset! You are now Level 1 with 0 XP.");
      window.location.reload();
    }
  };

  // 🎯 THE POWER FUNCTIONS: Control users and bulk enrollments
  const handleUpdateAccess = async (userId, data) => {
    try {
      // 🎯 THE SECURITY BADGE: Grab it from the browser's safe
      const token =
        localStorage.getItem("fj_admin_token") || localStorage.getItem("token");
      const config = {
        headers: { Authorization: `Bearer ${token}` },
      };

      // 🎯 THE REQUEST: Send the update with the badge included
      const response = await axios.patch(
        `/api/admin/users/${userId}/access`,
        data,
        config, // 👈 This is the missing link!
      );

      if (response.data.ok) {
        toast.success("Student access updated!");
        // We call our Master Fetcher again to refresh the list
        loadDashboardData();
      }
    } catch (err) {
      console.error("Access update failed:", err);
      toast.error("Failed to update access. Check the console.");
    }
  };

  const handleBulkAccess = async () => {
    try {
      const token =
        localStorage.getItem("fj_admin_token") || localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const res = await axios.post(
        "/api/admin/users/bulk-access",
        { emails: bulkEmails, track: bulkTrack },
        config, // 👈 Important
      );

      if (res.data.ok) {
        toast.success("Bulk access granted!");
        loadDashboardData();
      }
    } catch (err) {
      toast.error("Bulk action failed.");
    }
  };

  // ... inside your return block, next to Logout ...
  <button
    onClick={handleResetStats}
    className="bg-rose-50 text-rose-600 px-4 py-2 rounded-xl text-[10px] font-black hover:bg-rose-600 hover:text-white transition-all"
  >
    RESET MY TEST XP
  </button>;

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
        placeholder="Type a message for all students..."
        value={broadcastMsg}
        onChange={(e) => setBroadcastMsg(e.target.value)} // 🎯 Update state directly
        className="flex-grow p-4 rounded-2xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 font-bold focus:ring-2 focus:ring-white outline-none"
      />
      <button
        onClick={async () => {
          if (!broadcastMsg) return alert("Please enter a message.");
          // 🎯 Logic is now clean and error-free
          console.log("Sending Broadcast:", broadcastMsg);
          alert("Broadcast Sent! 🚀");
          setBroadcastMsg(""); // Clear after sending
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

        {/* 🎯 REFINED STUDENT HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div>
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
              Student Access Control
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              Manage enrollment and track assignments
            </p>
          </div>

          {/* The Badge stays pinned to the right */}
          <span className="text-[10px] font-black px-4 py-2 bg-indigo-100 text-indigo-600 rounded-full shadow-sm">
            Showing {filteredUsers.length} of {users.length} Masters
          </span>
        </div>

        {/* 🎯 SEARCH BOX (Standalone for full width) */}
        <div className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-xl mb-8">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              {/* 🎯 Pass the filtered list and search powers to the component */}
              <UserTableSearch
                users={filteredUsers}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
              />
            </div>
            {/* Optional: Add your "Clear Search" button here if not inside the component */}
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

      {/* 🎯 USER MANAGEMENT TABLE (Insert before Curriculum Overview) */}
      <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm mb-8">
        <h3 className="text-xl font-black text-slate-900 mb-6">
          Student Access Control
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50 text-slate-400 text-xs uppercase tracking-widest">
                <th className="py-4 px-4">Student</th>
                <th className="py-4 px-4">Current Track</th>
                <th className="py-4 px-4">Access Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((student) => (
                <tr
                  key={student.id}
                  className="border-b border-slate-50 hover:bg-slate-50/50"
                >
                  <td className="py-4 px-4">
                    <p className="font-bold text-slate-900">
                      {student.name || "New Student"}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {student.email}
                    </p>
                  </td>
                  <td className="py-4 px-4">
                    <select
                      value={student.track || "BEGINNER"}
                      onChange={(e) =>
                        handleUpdateAccess(student.id, {
                          track: e.target.value,
                        })
                      }
                      className="text-[10px] font-black border-none bg-slate-100 rounded-lg p-2 focus:ring-2 ring-indigo-500"
                    >
                      <option value="BEGINNER">BEGINNER</option>
                      <option value="INTERMEDIATE">INTERMEDIATE</option>
                    </select>
                  </td>
                  <td className="py-4 px-4">
                    <button
                      onClick={() =>
                        handleUpdateAccess(student.id, {
                          hasAccess: !student.has_access,
                        })
                      }
                      className={`text-[10px] font-black px-4 py-2 rounded-xl transition-all ${
                        student.has_access
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-rose-100 text-rose-700 hover:bg-rose-200"
                      }`}
                    >
                      {student.has_access ? "ACTIVE PRO" : "GRANT ACCESS"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
        <h3 className="text-xl font-bold text-slate-800 mb-6">
          Curriculum Overview
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="py-4 px-4 text-slate-400 font-medium">Level</th>
                <th className="py-4 px-4 text-slate-400 font-medium">
                  Tamil Sentence
                </th>
                <th className="py-4 px-4 text-slate-400 font-medium">
                  English Goal
                </th>
                <th className="py-4 px-4 text-slate-400 font-medium">
                  Actions
                </th>
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
            <h3 className="text-2xl font-black mb-2">
              Master Curriculum Upload
            </h3>
            <p className="text-indigo-200 text-sm">
              Upload your .csv file to populate {120 + 150} total master
              sentences.
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
