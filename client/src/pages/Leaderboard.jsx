// client/src/pages/Leaderboard.jsx
import { useEffect, useState, useRef } from "react";
import { API_BASE } from "@/lib/api";

function kFormat(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n ?? 0);
}

export default function Leaderboard() {
  const [period, setPeriod] = useState("daily"); // "daily" | "weekly" | "monthly"
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

  // keep a reference to abort previous fetch when period changes/refresh pressed
  const inFlight = useRef(null);

  async function loadLeaderboard(p = period) {
    setLoading(true);
    setErr("");

    // abort any previous request
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    const token = localStorage.getItem("fj_token");
    if (!token) {
      setErr("Please log in to view leaderboard.");
      setRows([]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/leaderboard/${p}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      // Try to parse JSON; if HTML came back (e.g., SPA fallback), this will throw
      let data = {};
      try {
        data = await res.json();
      } catch {
        throw new Error("Invalid response from server (not JSON).");
      }

      if (res.status === 401) {
        localStorage.removeItem("fj_token");
        throw new Error("Session expired. Please log in again.");
      }
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load leaderboard");
      }

      setRows(Array.isArray(data.top) ? data.top : []);
      setUpdatedAt(new Date());
    } catch (e) {
      if (e.name === "AbortError") return; // silently ignore aborted fetches
      console.error("Leaderboard fetch failed:", e);
      setRows([]);
      setErr(e.message || "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeaderboard(period);
    // cleanup on unmount
    return () => inFlight.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            className={`px-3 py-1 rounded-full ${
              period === p ? "bg-indigo-600 text-white" : "bg-gray-100"
            }`}
          >
            {p[0].toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => loadLeaderboard()}
          disabled={loading}
          className="px-4 py-1 rounded-full bg-violet-600 text-white disabled:opacity-60"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
        {updatedAt && !loading && (
          <span className="text-xs text-gray-500">
            Updated {updatedAt.toLocaleTimeString()}
          </span>
        )}
      </div>

      {err && <p className="text-center text-red-500">{err}</p>}

      {!err && (
        <>
          {loading ? (
            <p className="text-center text-gray-500">Loading…</p>
          ) : rows.length ? (
            <ol className="space-y-2">
              {rows.map((r, i) => (
                <li
                  key={`${r.user_id ?? i}-${period}`}
                  className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 flex items-center justify-center rounded-full bg-indigo-50 text-indigo-700 font-semibold">
                      {i + 1}
                    </span>
                    <div className="text-sm">
                      <div className="font-semibold">
                        {r.email || `User ${r.user_id ?? "?"}`}
                      </div>
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
          )}
        </>
      )}
    </div>
  );
}
