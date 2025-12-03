import React, { useEffect, useState } from "react";
import API from "../api/apiClient";
import ProtectedAdminRoute from "../components/ProtectedAdminRoute";

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalLessons: 0,
    totalQuizzes: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem("adminToken");

        const res = await API.get("/api/admin/dashboard", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.data.ok) {
          setStats(res.data);
        }
      } catch (err) {
        console.error("Failed to load admin stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading)
    return (
      <div className="p-6 text-lg font-semibold text-gray-600">
        Loading Admin Dashboard…
      </div>
    );

  return (
    <ProtectedAdminRoute>
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-purple-700">
          Admin Dashboard
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Total Users */}
          <div className="shadow-md rounded-xl p-6 bg-white border-l-4 border-purple-500">
            <h2 className="text-xl font-semibold mb-2">Total Users</h2>
            <p className="text-4xl font-bold text-purple-700">
              {stats.totalUsers}
            </p>
          </div>

          {/* Total Lessons */}
          <div className="shadow-md rounded-xl p-6 bg-white border-l-4 border-green-500">
            <h2 className="text-xl font-semibold mb-2">Lessons</h2>
            <p className="text-4xl font-bold text-green-600">
              {stats.totalLessons}
            </p>
          </div>

          {/* Total Quizzes */}
          <div className="shadow-md rounded-xl p-6 bg-white border-l-4 border-blue-500">
            <h2 className="text-xl font-semibold mb-2">Quizzes</h2>
            <p className="text-4xl font-bold text-blue-600">
              {stats.totalQuizzes}
            </p>
          </div>
        </div>

        {/* NAVIGATION BUTTONS */}
        <div className="mt-10 flex gap-6">
          <a
            href="/admin/lessons"
            className="bg-purple-600 text-white px-6 py-3 rounded-lg shadow hover:bg-purple-700 transition"
          >
            Manage Lessons
          </a>

          <a
            href="/admin/quizzes"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow hover:bg-blue-700 transition"
          >
            Manage Quizzes
          </a>
        </div>
      </div>
    </ProtectedAdminRoute>
  );
};

export default AdminDashboard;
