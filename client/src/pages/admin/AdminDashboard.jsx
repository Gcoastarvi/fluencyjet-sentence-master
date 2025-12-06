import React, { useEffect, useState } from "react";
import API from "../../api/apiClient";
import ProtectedAdminRoute from "../../components/ProtectedAdminRoute";

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("adminToken");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await API.get("/api/admin/analytics", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.ok) setData(res.data);
      } catch (err) {
        console.error("Failed to load analytics:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div className="p-6">Loading dashboard...</div>;

  return (
    <ProtectedAdminRoute>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-purple-700 mb-4">
          Admin Dashboard
        </h1>

        <div className="space-y-4">
          <div className="p-4 bg-white shadow rounded">
            <h2 className="text-lg font-semibold">Total Users</h2>
            <p className="text-2xl">{data?.totalUsers}</p>
          </div>

          <div className="p-4 bg-white shadow rounded">
            <h2 className="text-lg font-semibold">Total Lessons</h2>
            <p className="text-2xl">{data?.totalLessons}</p>
          </div>

          <div className="p-4 bg-white shadow rounded">
            <h2 className="text-lg font-semibold">Total Quizzes</h2>
            <p className="text-2xl">{data?.totalQuizzes}</p>
          </div>
        </div>
      </div>
    </ProtectedAdminRoute>
  );
};

export default AdminDashboard;
