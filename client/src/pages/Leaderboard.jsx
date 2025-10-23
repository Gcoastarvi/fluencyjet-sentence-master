import { useEffect, useState } from "react";

function kFormat(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

export default function Leaderboard() {
  const [period, setPeriod] = useState("weekly"); // "daily" | "weekly" | "monthly"
  const [rows, setRows] = useState([]);
  const token = localStorage.getItem("fj_token");

  useEffect(() => {
    async function load() {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/leaderboard/${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setRows(data.top || []);
    }
    if (token) load();
  }, [period, token]);

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h2 className="text-2xl font-bold text-center text-indigo-700">Leaderboard</h2>

      <div className="flex gap-2 justify-center">
        {["daily","weekly","monthly"].map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded-full ${period===p ? "bg-indigo-600 text-white" : "bg-gray-100"}`}
          >
            {p[0].toUpperCase()+p.slice(1)}
          </button>
        ))}
      </div>

      <ol className="space-y-2">
        {rows.map((r, i) => (
          <li
            key={r.user_id}
            className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 flex items-center justify-center rounded-full bg-indigo-50 text-indigo-700 font-semibold">
                {i + 1}
              </span>
              <div className="text-sm">
                <div className="font-semibold">{r.email}</div>
                <div className="text-gray-500">XP this {period}: {kFormat(r.total_xp)}</div>
              </div>
            </div>
            <div className="font-bold text-indigo-700">{kFormat(r.total_xp)}</div>
          </li>
        ))}
        {rows.length === 0 && (
          <p className="text-center text-gray-500">No entries yet — be the first! 🚀</p>
        )}
      </ol>
    </div>
  );
}
