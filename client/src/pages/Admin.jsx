// client/src/pages/Admin.jsx
import React, { useEffect, useState } from "react";
import { apiFetchWithAuth } from "@/utils/fetch";

export default function Admin() {
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetchWithAuth("/api/admin/overview");
        if (data.ok) setOverview(data.data);
      } catch (err) {
        console.error("Admin overview error", err);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Left Sidebar */}
      <aside className="w-64 bg-white shadow-md border-r">
        <div className="p-6 text-2xl font-bold text-purple-600">
          Admin Panel
        </div>

        <nav className="mt-4 space-y-2">
          <a className="block px-6 py-3 text-gray-700 font-medium bg-purple-50 rounded-md">
            Dashboard
          </a>

          <a className="block px-6 py-3 text-gray-600 hover:bg-gray-200 rounded-md cursor-pointer">
            Users (coming soon)
          </a>

          <a className="block px-6 py-3 text-gray-600 hover:bg-gray-200 rounded-md cursor-pointer">
            Quizzes (coming soon)
          </a>

          <a className="block px-6 py-3 text-gray-600 hover:bg-gray-200 rounded-md cursor-pointer">
            XP Logs (coming soon)
          </a>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-10">
        <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
        <p className="text-gray-500 mb-8">
          Overview of user activity and system stats.
        </p>

        {!overview ? (
          <div className="text-gray-500">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow">
              <div className="text-gray-500">Total Users</div>
              <div className="text-3xl font-bold">{overview.totalUsers}</div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
              <div className="text-gray-500">Total Quizzes</div>
              <div className="text-3xl font-bold">{overview.totalQuizzes}</div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
              <div className="text-gray-500">Total XP Awarded</div>
              <div className="text-3xl font-bold">{overview.totalXP}</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
