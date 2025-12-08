import React, { useEffect, useState } from "react";
import { adminApi } from "../../api/apiClient";
import ProtectedAdminRoute from "../../components/ProtectedAdminRoute";

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updateLoading, setUpdateLoading] = useState(null);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("fj_admin_token");

      const res = await API.get("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.ok) {
        setUsers(res.data.users);
      } else {
        console.error("Failed to load users:", res.data);
      }
    } catch (err) {
      console.error("Admin Users fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Toggle has_access
  const handleToggleAccess = async (userId, currentAccess) => {
    try {
      setUpdateLoading(userId);

      const token = localStorage.getItem("fj_admin_token");

      const res = await API.patch(
        `/api/admin/users/${userId}/access`,
        { has_access: !currentAccess },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (res.data.ok) {
        // Update table immediately
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? res.data.user : u)),
        );
      } else {
        alert("Failed to update access");
      }
    } catch (err) {
      console.error("Access update error:", err);
      alert("Error updating access");
    } finally {
      setUpdateLoading(null);
    }
  };

  // Change tier_level
  const handleTierChange = async (userId, newTier) => {
    try {
      setUpdateLoading(userId);

      const token = localStorage.getItem("fj_admin_token");

      const res = await API.patch(
        `/api/admin/users/${userId}/access`,
        { tier_level: newTier },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (res.data.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? res.data.user : u)),
        );
      } else {
        alert("Failed to update tier");
      }
    } catch (err) {
      console.error("Tier update error:", err);
      alert("Error updating tier");
    } finally {
      setUpdateLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-lg font-semibold text-gray-600">
        Loading users…
      </div>
    );
  }

  return (
    <ProtectedAdminRoute>
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-purple-700">
          Users Management
        </h1>

        {users.length === 0 && (
          <div className="text-gray-500 text-lg">No users found.</div>
        )}

        {users.length > 0 && (
          <div className="overflow-x-auto shadow-md rounded-xl">
            <table className="min-w-full bg-white">
              <thead className="bg-purple-600 text-white">
                <tr>
                  <th className="py-3 px-4 text-left">Name</th>
                  <th className="py-3 px-4 text-left">Email</th>
                  <th className="py-3 px-4 text-left">Tier</th>
                  <th className="py-3 px-4 text-left">Admin</th>
                  <th className="py-3 px-4 text-center">Access</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>

              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b hover:bg-gray-100 transition"
                  >
                    <td className="py-3 px-4">{u.name || "—"}</td>
                    <td className="py-3 px-4">{u.email}</td>

                    {/* Tier Level Dropdown */}
                    <td className="py-3 px-4">
                      <select
                        value={u.tier_level}
                        disabled={updateLoading === u.id}
                        onChange={(e) => handleTierChange(u.id, e.target.value)}
                        className="border p-1 rounded"
                      >
                        <option value="free">Free</option>
                        <option value="basic">Basic</option>
                        <option value="pro">Pro</option>
                        <option value="premium">Premium</option>
                      </select>
                    </td>

                    {/* Admin Badge */}
                    <td className="py-3 px-4">
                      {u.isAdmin ? (
                        <span className="text-green-600 font-bold">Admin</span>
                      ) : (
                        <span className="text-gray-500">User</span>
                      )}
                    </td>

                    {/* Access Toggle */}
                    <td className="text-center">
                      <button
                        disabled={updateLoading === u.id}
                        onClick={() => handleToggleAccess(u.id, u.has_access)}
                        className={`px-3 py-1 rounded-lg text-white ${
                          u.has_access
                            ? "bg-green-600 hover:bg-green-700"
                            : "bg-red-600 hover:bg-red-700"
                        }`}
                      >
                        {u.has_access ? "Active" : "Blocked"}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="text-center">
                      <a
                        href={`/admin/users/${u.id}`}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                      >
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ProtectedAdminRoute>
  );
};

export default AdminUsers;
