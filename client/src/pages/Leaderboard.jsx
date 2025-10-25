import { useEffect, useState } from "react";
import { fetchLeaderboard } from "@/lib/xpTracker";

function kFormat(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

export default function Leaderboard() {
  const [period, setPeriod] = useState("daily"); // daily | weekly | monthly
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const data = await fetchLeaderboard(period);
        setRows(data.top || []);
      } catch (e) {
        setErr(e.message || "Failed to load leaderboard");
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [period]);

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h2 className="text-2xl font-bold text-center text-indigo-700">
        Leaderboard
      </h2>

      <div className="flex gap-2 justify-center">
        {["daily", "weekly", "monthly"].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded-full ${period === p ? "bg-indigo-600 text-white" : "bg-gray-100"}`}
          >
            {p[0].toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {loading && <p className="text-center text-gray-500">Loading…</p>}
      {err && <p className="text-center text-red-500">{err}</p>}

      {!loading &&
        !err &&
        (rows.length ? (
          <ol className="space-y-2">
            {rows.map((r, i) => (
              <li
                key={`${r.user_id}-${i}`}
                className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 flex items-center justify-center rounded-full bg-indigo-50 text-indigo-700 font-semibold">
                    {i + 1}
                  </span>
                  <div className="text-sm">
                    <div className="font-semibold">{r.email}</div>
                    <div className="text-gray-500">
                      XP this {period}: {kFormat(r.total_xp)}
                    </div>
                  </div>
                </div>
                <div className="font-bold text-indigo-700">
                  {kFormat(r.total_xp)}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-center text-gray-500">
            No entries yet — be the first! 🚀
          </p>
        ))}
    </div>
  );
}
