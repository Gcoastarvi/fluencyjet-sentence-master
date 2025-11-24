// client/src/pages/AdminUserDetail.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import AdminSidebar from "@/components/AdminSidebar";

export default function AdminUserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [xpEvents, setXpEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
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
        }
      } catch (err) {
        console.error("Admin user detail error:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading user details...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4">User not found.</p>
          <button
            onClick={() => navigate("/admin")}
            className="px-4 py-2 bg-purple-600 text-white rounded-md"
          >
            Back to Admin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-100">
      <AdminSidebar />

      <main className="flex-1 p-10">
        {/* Header / Breadcrumb */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-sm text-gray-500 mb-1">
              <Link to="/admin" className="hover:underline">
                Admin
              </Link>{" "}
              / <span className="font-medium">User Detail</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">
              {user.name || "Unnamed User"}
            </h1>
            <p className="text-gray-600 text-sm">{user.email}</p>
          </div>

          <div className="flex gap-2">
            {user.isAdmin && (
              <span className="px-3 py-1 text-xs rounded-full bg-purple-100 text-purple-700 font-semibold">
                Admin
              </span>
            )}
          </div>
        </div>

        {/* XP Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-xs text-gray-500">Total XP</div>
            <div className="text-2xl font-semibold">{user.xpTotal ?? 0}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-xs text-gray-500">Weekly XP</div>
            <div className="text-2xl font-semibold">{user.xpWeekly ?? 0}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-xs text-gray-500">Monthly XP</div>
            <div className="text-2xl font-semibold">{user.xpMonthly ?? 0}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-xs text-gray-500">Streak</div>
            <div className="text-2xl font-semibold">{user.streak ?? 0}</div>
          </div>
        </div>

        {/* Meta info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-xs text-gray-500">Joined</div>
            <div className="text-sm font-medium">
              {new Date(user.createdAt).toLocaleString()}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-xs text-gray-500">Last Active</div>
            <div className="text-sm font-medium">
              {user.lastActiveAt
                ? new Date(user.lastActiveAt).toLocaleString()
                : "No activity yet"}
            </div>
          </div>
        </div>

        {/* XP Events Table */}
        <h2 className="text-lg font-semibold mb-3">Recent XP Events</h2>

        <div className="bg-white shadow rounded-lg overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-3 font-medium">XP</th>
                <th className="p-3 font-medium">Reason</th>
                <th className="p-3 font-medium">Date</th>
              </tr>
            </thead>

            <tbody>
              {xpEvents.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="p-3 font-semibold text-blue-700">
                    +{e.amount}
                  </td>
                  <td className="p-3">{e.reason || "N/A"}</td>
                  <td className="p-3">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}

              {xpEvents.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-gray-500">
                    No XP history for this user yet.
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
