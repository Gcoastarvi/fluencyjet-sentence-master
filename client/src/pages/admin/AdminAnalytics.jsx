import { useEffect, useState } from "react";
import { adminApi } from "../../api/apiClient";

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const res = await api.get("/admin/analytics/summary");
        setData(res.data);
      } catch (err) {
        console.error("Failed to load analytics", err);
        setError("Failed to load analytics");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Admin Analytics</h1>
        <p className="text-gray-600">Loading analytics…</p>
      </div>
    );
  }

  if (error || !data?.ok) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Admin Analytics</h1>
        <p className="text-red-600 mb-2">
          {error || data?.message || "Something went wrong."}
        </p>
      </div>
    );
  }

  const { metrics, topUsers, recentEvents } = data;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin Analytics</h1>
        <span className="text-sm text-gray-500">
          XP + users + activity overview
        </span>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="Total Users" value={metrics.userCount} />
        <MetricCard label="Total Lessons" value={metrics.lessonCount} />
        <MetricCard label="Total XP (UserProgress)" value={metrics.totalXp} />
        <MetricCard label="Total XP Events" value={metrics.xpEventCount} />
        <MetricCard label="Total Quizzes" value={metrics.quizCount} />
      </div>

      {/* Top users */}
      <section>
        <h2 className="text-xl font-semibold mb-3">Top Users by XP</h2>
        {(!topUsers || topUsers.length === 0) && (
          <p className="text-gray-500 text-sm">No XP data yet.</p>
        )}
        {topUsers && topUsers.length > 0 && (
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">User</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-right">XP</th>
                </tr>
              </thead>
              <tbody>
                {topUsers.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-3 py-2">{u.name || "(no name)"}</td>
                    <td className="px-3 py-2">{u.email}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {u.xp}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent XP events */}
      <section>
        <h2 className="text-xl font-semibold mb-3">Recent XP Events</h2>
        {(!recentEvents || recentEvents.length === 0) && (
          <p className="text-gray-500 text-sm">No events recorded yet.</p>
        )}
        {recentEvents && recentEvents.length > 0 && (
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">User</th>
                  <th className="px-3 py-2 text-right">XP Δ</th>
                  <th className="px-3 py-2 text-left">When</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((ev) => (
                  <tr key={ev.id} className="border-t">
                    <td className="px-3 py-2">{ev.type}</td>
                    <td className="px-3 py-2">{ev.userEmail || "—"}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {ev.xp}
                    </td>
                    <td className="px-3 py-2">
                      {new Date(ev.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}
