import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "@/components/AdminSidebar";

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Filters & sorting
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all"); // all | admins | users
  const [activeFilter, setActiveFilter] = useState("all"); // all | active
  const [xpSort, setXpSort] = useState("none"); // none | high | low

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
     DELETE USER (Permanent)
  ───────────────────────────────── */
  async function deleteUser(userId) {
    if (!window.confirm("Are you absolutely sure? This cannot be undone."))
      return;

    try {
      const res = await fetch("/api/admin/delete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();

      if (data.ok) {
        alert("User deleted!");
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      } else {
        alert(data.message || "Failed to delete user");
      }
    } catch (err) {
      console.error("Delete error:", err);
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
     FILTER + SORT (client-side)
  ───────────────────────────────── */
  let filteredUsers = users;

  // Search by name or email
  if (search.trim()) {
    const term = search.toLowerCase();
    filteredUsers = filteredUsers.filter((u) => {
      const name = (u.name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  }

  // Role filter: admins / users / all
  if (roleFilter === "admins") {
    filteredUsers = filteredUsers.filter((u) => u.isAdmin);
  } else if (roleFilter === "users") {
    filteredUsers = filteredUsers.filter((u) => !u.isAdmin);
  }

  // Active filter: only users with lastActiveAt
  if (activeFilter === "active") {
    filteredUsers = filteredUsers.filter((u) => u.lastActiveAt);
  }

  // XP sort
  if (xpSort !== "none") {
    filteredUsers = [...filteredUsers].sort((a, b) => {
      const xpA = a.xpTotal ?? 0;
      const xpB = b.xpTotal ?? 0;
      if (xpSort === "high") return xpB - xpA; // high to low
      if (xpSort === "low") return xpA - xpB; // low to high
      return 0;
    });
  }

  /* ───────────────────────────────
     UI
  ───────────────────────────────── */
  return (
    <div className="min-h-screen flex bg-gray-100">
      <AdminSidebar />

      <main className="flex-1 p-10">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

        {/* Stats (from full users, not filtered) */}
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

        {/* Filters */}
        <div className="bg-white shadow-md rounded-lg p-4 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search by name or email..."
              className="w-full sm:w-64 px-3 py-2 border rounded-md text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="px-3 py-2 border rounded-md text-sm"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="admins">Admins only</option>
              <option value="users">Users only</option>
            </select>

            <select
              className="px-3 py-2 border rounded-md text-sm"
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
            >
              <option value="all">All Activity</option>
              <option value="active">Active (has activity)</option>
            </select>
          </div>

          <div>
            <select
              className="px-3 py-2 border rounded-md text-sm"
              value={xpSort}
              onChange={(e) => setXpSort(e.target.value)}
            >
              <option value="none">XP: No sort</option>
              <option value="high">XP: High → Low</option>
              <option value="low">XP: Low → High</option>
            </select>
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
                <th className="p-3 font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-3">{u.name}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">{u.xpTotal ?? 0}</td>
                  <td className="p-3">{u.streak ?? 0}</td>
                  <td className="p-3">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>

                  <td className="p-3 flex flex-wrap gap-2">
                    {u.isAdmin ? (
                      <button
                        onClick={() => demoteUser(u.id)}
                        className="px-3 py-1 bg-orange-600 text-white rounded text-xs hover:bg-orange-700"
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

                    <button
                      onClick={() => deleteUser(u.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {filteredUsers.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-gray-500" colSpan={6}>
                    No users match your filters.
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
