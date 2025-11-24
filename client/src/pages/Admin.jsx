import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/api/admin/users", {
      credentials: "include",
    })
      .then((res) => {
        if (res.status === 403) navigate("/login");
        return res.json();
      })
      .then((data) => {
        setUsers(data.users || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Admin fetch error:", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-6">Loading admin dashboard...</div>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-white shadow rounded">
          <h3 className="text-sm text-gray-500">Total Users</h3>
          <p className="text-2xl font-semibold">{users.length}</p>
        </div>

        <div className="p-4 bg-white shadow rounded">
          <h3 className="text-sm text-gray-500">Active Today</h3>
          <p className="text-2xl font-semibold">
            {users.filter((u) => u.lastActiveAt).length}
          </p>
        </div>

        <div className="p-4 bg-white shadow rounded">
          <h3 className="text-sm text-gray-500">Admins</h3>
          <p className="text-2xl font-semibold">
            {users.filter((u) => u.isAdmin).length}
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white shadow rounded overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">XP</th>
              <th className="p-3 font-medium">Streak</th>
              <th className="p-3 font-medium">Joined</th>
              <th className="p-3 font-medium">Admin</th>
            </tr>
          </thead>

          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-3">{u.name}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3">{u.xpTotal ?? 0}</td>
                <td className="p-3">{u.streak ?? 0}</td>
                <td className="p-3">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="p-3">
                  {u.isAdmin ? (
                    <span className="text-green-600 font-medium">Admin</span>
                  ) : (
                    <span className="text-gray-500">User</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
