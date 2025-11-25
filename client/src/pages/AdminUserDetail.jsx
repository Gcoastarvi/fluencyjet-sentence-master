// client/src/pages/AdminUserDetail.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import AdminSidebar from "@/components/AdminSidebar";

// Recharts
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

export default function AdminUserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [xpEvents, setXpEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [xp7, setXp7] = useState([]);
  const [xp30, setXp30] = useState([]);
  const [xpAll, setXpAll] = useState([]);

  /* ───────────────────────────────
     LOAD USER
  ───────────────────────────────── */
  async function loadUser() {
    try {
      const res = await fetch(`/api/admin/user/${id}`, {
        credentials: "include",
      });

      if (res.status === 403) {
        navigate("/login");
        return;
      }

      const data = await res.json();
      if (data.ok) {
        setUser(data.user);
        setXpEvents(data.xpEvents || []);
        generateCharts(data.xpEvents || []);
      }
    } catch (err) {
      console.error("Admin user detail error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUser();
  }, [id]);

  /* ───────────────────────────────
     ADMIN ACTIONS
  ───────────────────────────────── */
  async function promote() {
    if (!window.confirm("Promote this user to admin?")) return;

    const res = await fetch("/api/admin/promote", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id }),
    });

    const data = await res.json();
    if (data.ok) {
      alert("Promoted to admin!");
      loadUser();
    }
  }

  async function demote() {
    if (!window.confirm("Remove admin rights from this user?")) return;

    const res = await fetch("/api/admin/demote", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id }),
    });

    const data = await res.json();
    if (data.ok) {
      alert("Demoted!");
      loadUser();
    }
  }

  async function deleteUser() {
    if (!window.confirm("Delete this user permanently?")) return;

    const res = await fetch("/api/admin/delete", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id }),
    });

    const data = await res.json();
    if (data.ok) {
      alert("User deleted");
      navigate("/admin/users");
    }
  }

  /* ───────────────────────────────
     CHART DATA GENERATION
  ───────────────────────────────── */
  function generateCharts(events) {
    const now = new Date();
    const shortDate = (d) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    // Reusable function for 7-day / 30-day charts
    function groupXP(days) {
      const map = {};

      for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        map[key] = { date: shortDate(d), xp: 0 };
      }

      events.forEach((e) => {
        const key = e.createdAt.slice(0, 10);
        if (map[key]) map[key].xp += e.amount;
      });

      return Object.values(map).reverse();
    }

    /* 🔥 ALL-TIME XP CHART */
    const allMap = {};
    events.forEach((e) => {
      const key = e.createdAt.slice(0, 10);
      const d = new Date(key);
      if (!allMap[key]) {
        allMap[key] = { date: shortDate(d), xp: 0 };
      }
      allMap[key].xp += e.amount;
    });

    const xpAllData = Object.values(allMap).sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    );

    setXpAll(xpAllData);
    setXp7(groupXP(7));
    setXp30(groupXP(30));
  }

  /* ───────────────────────────────
     LOADING STATE
  ───────────────────────────────── */
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading user details...
      </div>
    );

  if (!user)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>User not found.</p>
      </div>
    );

  /* ───────────────────────────────
     PAGE RENDER
  ───────────────────────────────── */
  return (
    <div className="min-h-screen flex bg-gray-100">
      <AdminSidebar />

      <main className="flex-1 p-10">
        {/* Breadcrumb */}
        <div className="text-sm text-gray-500 mb-4">
          <Link to="/admin" className="hover:underline">
            Admin
          </Link>{" "}
          /{" "}
          <Link to="/admin/users" className="hover:underline">
            Users
          </Link>{" "}
          / <span className="font-medium">{user.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">{user.name}</h1>
            <p className="text-gray-600">{user.email}</p>

            {user.isAdmin && (
              <div className="mt-2 px-3 py-1 bg-purple-100 text-purple-600 rounded text-xs inline-block">
                Admin
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            {!user.isAdmin && (
              <button
                onClick={promote}
                className="px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
              >
                Promote to Admin
              </button>
            )}

            {user.isAdmin && (
              <button
                onClick={demote}
                className="px-4 py-2 bg-orange-600 text-white text-sm rounded hover:bg-orange-700"
              >
                Demote Admin
              </button>
            )}

            <button
              onClick={deleteUser}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700"
            >
              Delete User
            </button>
          </div>
        </div>

        {/* XP Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-xs text-gray-500">Total XP</div>
            <div className="text-2xl font-bold">{user.xpTotal}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-xs text-gray-500">Weekly XP</div>
            <div className="text-2xl font-bold">{user.xpWeekly}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-xs text-gray-500">Monthly XP</div>
            <div className="text-2xl font-bold">{user.xpMonthly}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-xs text-gray-500">Streak</div>
            <div className="text-2xl font-bold">{user.streak}</div>
          </div>
        </div>

        {/* XP Last 7 Days */}
        <h2 className="text-xl font-semibold mb-3">XP Last 7 Days</h2>
        <div
          className="bg-white p-4 rounded-lg shadow mb-10"
          style={{ height: 250 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={xp7}>
              <CartesianGrid strokeDasharray="4 4" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="xp"
                stroke="#7e3af2"
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* XP Last 30 Days */}
        <h2 className="text-xl font-semibold mb-3">XP Last 30 Days</h2>
        <div
          className="bg-white p-4 rounded-lg shadow mb-10"
          style={{ height: 250 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={xp30}>
              <CartesianGrid strokeDasharray="4 4" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="xp"
                stroke="#7e3af2"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* XP All-Time */}
        <h2 className="text-xl font-semibold mb-3">XP — All Time</h2>
        <div
          className="bg-white p-4 rounded-lg shadow mb-10"
          style={{ height: 250 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={xpAll}>
              <CartesianGrid strokeDasharray="4 4" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="xp"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* XP Events */}
        <h2 className="text-lg font-semibold mb-3">Recent XP Events</h2>
        <div className="bg-white shadow rounded-lg overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3">XP</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {xpEvents.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="p-3 font-semibold text-blue-700">
                    +{e.amount}
                  </td>
                  <td className="p-3">{e.reason}</td>
                  <td className="p-3">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}

              {xpEvents.length === 0 && (
                <tr>
                  <td colSpan="3" className="p-4 text-center text-gray-500">
                    No XP history yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
