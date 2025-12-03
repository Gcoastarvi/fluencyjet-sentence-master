import React, { useEffect, useState } from "react";
import {
  getAllUsers,
  resetUserXP,
  resetUserStreak,
  toggleBanUser,
} from "../api/adminApi";
import ProtectedAdminRoute from "../components/ProtectedAdminRoute";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadUsers() {
    setLoading(true);
    const res = await getAllUsers();
    if (res.data.ok) setUsers(res.data.users);
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleResetXP(id) {
    await resetUserXP(id);
    loadUsers();
  }

  async function handleResetStreak(id) {
    await resetUserStreak(id);
    loadUsers();
  }

  async function handleToggleBan(id) {
    await toggleBanUser(id);
    loadUsers();
  }

  if (loading) return <div className="p-6">Loading users...</div>;

  return (
    <ProtectedAdminRoute>
      <div className="p-6">
        <h1 className="text-xl font-bold mb-4">👤 User Management</h1>

        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-200 text-left">
              <th className="p-2">Email</th>
              <th className="p-2">XP</th>
              <th className="p-2">Streak</th>
              <th className="p-2">Status</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>

          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b">
                <td className="p-2">{u.email}</td>
                <td className="p-2">{u.xp}</td>
                <td className="p-2">{u.streak}</td>
                <td className="p-2">
                  {u.isBanned ? (
                    <span className="text-red-600 font-semibold">Banned</span>
                  ) : (
                    <span className="text-green-700 font-semibold">Active</span>
                  )}
                </td>

                <td className="p-2 space-x-2">
                  <button
                    onClick={() => handleResetXP(u.id)}
                    className="px-2 py-1 bg-blue-600 text-white rounded"
                  >
                    Reset XP
                  </button>

                  <button
                    onClick={() => handleResetStreak(u.id)}
                    className="px-2 py-1 bg-orange-600 text-white rounded"
                  >
                    Reset Streak
                  </button>

                  <button
                    onClick={() => handleToggleBan(u.id)}
                    className={`px-2 py-1 text-white rounded ${
                      u.isBanned ? "bg-green-600" : "bg-red-600"
                    }`}
                  >
                    {u.isBanned ? "Unban" : "Ban"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ProtectedAdminRoute>
  );
}
