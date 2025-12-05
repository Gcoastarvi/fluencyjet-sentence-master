import React, { useEffect, useState } from "react";
import API from "../api/apiClient";
import ProtectedAdminRoute from "../components/ProtectedAdminRoute";

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const token = localStorage.getItem("adminToken");

        const res = await API.get("/api/admin/analytics", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.data.ok) {
          setData(res.data);
        } else {
          console.error("Failed to load analytics:", res.data);
        }
      } catch (err) {
        console.error("Admin dashboard error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-lg font-semibold text-gray-600">
        Loading Admin Dashboard…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-red-600 text-lg">
        Failed to load dashboard. Check backend logs.
      </div>
    );
  }

  const { summary } = data;

  return (
    <ProtectedAdminRoute>
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-purple-700">
          Admin Dashboard
        </h1>

        {/* SUMMARY TILES */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

          {/* Total Users */}
          <div className="shadow-md rounded-xl p-6 bg-white border-l-4 border-purple-500">
            <h2 className="text-xl font-semibold mb-1">Total Users</h2>
            <p className="text-4xl font-bold text-purple-700">
              {summary.totalUsers}
            </p>
          </div>

          {/* Lessons */}
          <div className="shadow-md rounded-xl p-6 bg-white border-l-4 border-green-500">
            <h2 className="text-xl font-semibold mb-1">Lessons</h2>
            <p className="text-4xl font-bold text-green-600">
              {summary.totalLessons}
            </p>
          </div>

          {/* Quizzes */}
          <div className="shadow-md rounded-xl p-6 bg-white border-l-4 border-blue-500">
            <h2 className="text-xl font-semibold mb-1">Quizzes</h2>
            <p className="text-4xl font-bold text-blue-600">
              {summary.totalQuizzes}
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

          <a
            href="/admin/users"
            className="bg-gray-700 text-white px-6 py-3 rounded-lg shadow hover:bg-gray-800 transition"
          >
            View Users
          </a>
        </div>
      </div>
    </ProtectedAdminRoute>
  );
};

export default AdminDashboard;
