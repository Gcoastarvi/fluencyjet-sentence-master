import { useEffect, useState } from "react";

function kFormat(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n ?? 0);
}

export default function Leaderboard() {
  const [period, setPeriod] = useState("weekly"); // "daily" | "weekly" | "monthly"
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const token = localStorage.getItem("fj_token");

  // 🎯 Fetch leaderboard from backend
  async function loadLeaderboard() {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/leaderboard/${period}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(data.top || []);
    } catch (err) {
      console.error("Leaderboard fetch failed:", err);
      setError("Failed to load leaderboard. Please try again later.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeaderboard();
  }, [period, token]);

  // 🏅 Highlight styles for top ranks
  function rankStyle(i) {
    if (i === 0) return "bg-yellow-100 border border-yellow-300";
    if (i === 1) return "bg-gray-100 border border-gray-300";
    if (i === 2) return "bg-orange-100 border border-orange-300";
    return "bg-white";
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h2 className="text-2xl font-bold text-center text-indigo-700">
        Leaderboard
      </h2>

      {/* Period buttons */}
      <div className="flex gap-2 justify-center">
        {["daily", "weekly", "monthly"].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-1 rounded-full text-sm font-medium transition ${
              period === p
                ? "bg-indigo-600 text-white shadow"
                : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            {p[0].toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Loading or Error */}
      {loading && (
        <p className="text-center text-gray-400 italic">
          Loading leaderboard...
        </p>
      )}
      {error && <p className="text-center text-red-500 font-medium">{error}</p>}

      {/* Leaderboard list */}
      {!loading && !error && (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li
              key={r.user_id || i}
              className={`flex items-center justify-between rounded-xl p-3 shadow-sm transition ${rankStyle(
                i,
              )}`}
            >
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 flex items-center justify-center rounded-full bg-indigo-50 text-indigo-700 font-semibold">
                  {i + 1}
                </span>
                <div className="text-sm">
                  <div className="font-semibold text-gray-800">
                    {r.email || "Anonymous"}
                  </div>
                  <div className="text-gray-500 text-xs">
                    XP this {period}: {kFormat(r.total_xp)}
                  </div>
                </div>
              </div>
              <div className="font-bold text-indigo-700 text-sm">
                {kFormat(r.total_xp)}
              </div>
            </li>
          ))}

          {rows.length === 0 && (
            <p className="text-center text-gray-500">
              No entries yet — be the first! 🚀
            </p>
          )}
        </ol>
      )}

      {/* Refresh button */}
      {!loading && (
        <div className="text-center mt-4">
          <button
            onClick={loadLeaderboard}
            className="bg-violet-600 text-white text-sm px-4 py-1.5 rounded-full hover:scale-105 transition"
          >
            Refresh 🔄
          </button>
        </div>
      )}
    </div>
  );
}
