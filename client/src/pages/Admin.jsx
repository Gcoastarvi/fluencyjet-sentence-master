import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "@/components/AdminSidebar";

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  /* ───────────────────────────────
     PROMOTE
  ───────────────────────────────── */
  async function promoteUser(userId) {
    if (!window.confirm("Promote this user to admin?")) return;

    try {
      const res = await fetch("/api/admin/promote", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();

      if (data.ok) {
        alert("User promoted!");
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, isAdmin: true } : u)),
        );
      } else {
        alert(data.message || "Failed to promote");
      }
    } catch (err) {
      console.error("Promote error:", err);
    }
  }

  /* ───────────────────────────────
     DEMOTE
  ───────────────────────────────── */
  async function demoteUser(userId) {
    if (!window.confirm("Remove admin rights from this user?")) return;

    try {
      const res = await fetch("/api/admin/demote", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();

      if (data.ok) {
        alert("User demoted!");
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, isAdmin: false } : u)),
        );
      } else {
        alert(data.message || "Demotion failed");
      }
    } catch (err) {
      console.error("Demote error:", err);
    }
  }

  /* ───────────────────────────────
     LOAD USERS
  ───────────────────────────────── */
  useEffect(() => {
    fetch("/api/admin/users", { credentials: "include" })
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

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading admin dashboard...
      </div>
    );

  /* ───────────────────────────────
     UI
  ───────────────────────────────── */
  return (
    <div className="min-h-screen flex bg-gray-100">
      <AdminSidebar />

      <main className="flex-1 p-10">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="p-4 bg-white shadow rounded-lg">
            <h3 className="text-sm text-gray-500">Total Users</h3>
            <p className="text-2xl font-semibold">{users.length}</p>
          </div>

          <div className="p-4 bg-white shadow rounded-lg">
            <h3 className="text-sm text-gray-500">Active Today</h3>
            <p className="text-2xl font-semibold">
              {users.filter((u) => u.lastActiveAt).length}
            </p>
          </div>

          <div className="p-4 bg-white shadow rounded-lg">
            <h3 className="text-sm text-gray-500">Admins</h3>
            <p className="text-2xl font-semibold">
              {users.filter((u) => u.isAdmin).length}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white shadow-md rounded-lg overflow-auto">
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
                      <button
                        onClick={() => demoteUser(u.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                      >
                        Demote
                      </button>
                    ) : (
                      <button
                        onClick={() => promoteUser(u.id)}
                        className="px-3 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700"
                      >
                        Promote
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
