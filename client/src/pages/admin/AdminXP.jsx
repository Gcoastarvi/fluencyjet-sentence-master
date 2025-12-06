// client/src/pages/AdminXP.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "@/components/AdminSidebar";

export default function AdminXP() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/api/admin/xp", { credentials: "include" })
      .then((res) => {
        if (res.status === 403) navigate("/login");
        return res.json();
      })
      .then((data) => {
        setLogs(data.logs || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("XP logs error:", err);
        setLoading(false);
      });
  }, [navigate]);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading XP logs...
      </div>
    );

  return (
    <div className="min-h-screen flex bg-gray-100">
      <AdminSidebar />

      <main className="flex-1 p-10">
        <h1 className="text-3xl font-bold mb-6">XP Logs</h1>

        <div className="bg-white shadow rounded-lg overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-3 font-medium">User</th>
                <th className="p-3 font-medium">Email</th>
                <th className="p-3 font-medium">XP</th>
                <th className="p-3 font-medium">Reason</th>
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t">
                  <td className="p-3">{log.user?.name || "Unknown"}</td>
                  <td className="p-3">{log.user?.email || "Unknown"}</td>
                  <td className="p-3 font-semibold text-blue-700">
                    +{log.amount}
                  </td>
                  <td className="p-3">{log.reason || "N/A"}</td>
                  <td className="p-3">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3">
                    {log.user?.id && (
                      <button
                        onClick={() => navigate(`/admin/user/${log.user.id}`)}
                        className="px-3 py-1 bg-gray-200 rounded text-xs hover:bg-gray-300"
                      >
                        View User
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-500">
                    No XP logs found.
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
