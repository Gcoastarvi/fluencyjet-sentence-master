import { useEffect, useState } from "react";
import { apiFetchWithAuth } from "../utils/fetch";
import { useNavigate } from "react-router-dom";

export default function Admin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const res = await apiFetchWithAuth("/api/admin/users");
      if (res.ok) setUsers(res.users || []);
      else navigate("/login");
    } catch {
      navigate("/login");
    }
  }

  async function loadLeaderboardDebug() {
    try {
      const res = await apiFetchWithAuth(
        "/api/admin/leaderboard-debug?period=weekly",
      );
      if (res.ok) setRows(res.rows || []);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>

      {/* Tabs */}
      <div className="flex gap-3 mb-6">
        <button
          className={`px-4 py-2 rounded-lg ${tab === "users" ? "bg-indigo-600 text-white" : "bg-gray-200"}`}
          onClick={() => setTab("users")}
        >
          Users
        </button>
        <button
          className={`px-4 py-2 rounded-lg ${tab === "leaderboard" ? "bg-indigo-600 text-white" : "bg-gray-200"}`}
          onClick={() => {
            setTab("leaderboard");
            loadLeaderboardDebug();
          }}
        >
          Leaderboard Debug
        </button>
      </div>

      {/* USERS TAB */}
      {tab === "users" && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">All Users</h2>

          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="py-2">ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>XP</th>
                <th>Level</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b">
                  <td className="py-2">{u.id}</td>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.xp}</td>
                  <td>{u.level}</td>
                  <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* LEADERBOARD DEBUG TAB */}
      {tab === "leaderboard" && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">
            Leaderboard Debug (Full Rows)
          </h2>

          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="py-2">User</th>
                <th>Email</th>
                <th>Rank</th>
                <th>XP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx} className="border-b">
                  <td className="py-2">{r.user?.name}</td>
                  <td>{r.user?.email}</td>
                  <td>{r.rank}</td>
                  <td>{r.xp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
