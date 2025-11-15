// client/src/pages/Leaderboard.jsx
import { useEffect, useState, useRef } from "react";
import { apiRequest } from "@/hooks/useApi";
import { API_BASE } from "@/lib/api";

// Format XP (1.2K, 3.4M etc.)
function kFormat(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n ?? 0);
}

// XP subtitle helper
function subtitle(period) {
  switch (period) {
    case "daily":
      return "XP earned today";
    case "weekly":
      return "XP earned this week";
    case "monthly":
      return "XP earned this month";
    default:
      return "XP ranking";
  }
}

export default function Leaderboard() {
  const [period, setPeriod] = useState("daily");
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

  const inFlight = useRef(null);

  async function loadLeaderboard(p = period) {
    setLoading(true);
    setErr("");

    // abort previous fetch if exists
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    // SUPER SAFE TOKEN CHECK
    const token =
      window.localStorage?.getItem("fj_token") ||
      window.sessionStorage?.getItem("fj_token") ||
      null;

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

      let data = {};
      try {
        data = await res.json();
      } catch {
        throw new Error("Invalid server response.");
      }

      if (res.status === 401) {
        localStorage.removeItem("fj_token");
        sessionStorage.removeItem("fj_token");
        throw new Error("Session expired. Please log in again.");
      }

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load leaderboard");
      }

      setRows(Array.isArray(data.top) ? data.top : []);
      setUpdatedAt(new Date());
    } catch (e) {
      if (e.name === "AbortError") return;
      console.error("Leaderboard fetch failed:", e);
      setErr(e.message || "Failed to load leaderboard");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeaderboard(period);
    return () => inFlight.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      {/* PAGE TITLE */}
      <h2 className="text-2xl font-bold text-center text-indigo-700">
        Leaderboard
      </h2>

      {/* SUBTITLE */}
      <p className="text-center text-gray-500 text-sm -mt-2">
        {subtitle(period)}
      </p>

      {/* PERIOD BUTTONS */}
      <div
        className="flex gap-2 justify-center"
        title="Daily = today's XP, Weekly = last 7 days XP, Monthly = calendar-month XP"
      >
        {["daily", "weekly", "monthly"].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded-full transition-all duration-200 ${
              period === p
                ? "bg-indigo-600 text-white shadow-md scale-105"
                : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            {p[0].toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* REFRESH + TIME */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => loadLeaderboard()}
          disabled={loading}
          className="px-4 py-1 rounded-full bg-violet-600 text-white disabled:opacity-60 hover:scale-105 transition-all"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>

        {updatedAt && !loading && (
          <span className="text-xs text-gray-500">
            Updated {updatedAt.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* ERRORS */}
      {err && <p className="text-center text-red-500">{err}</p>}

      {!err && (
        <>
          {loading ? (
            <p className="text-center text-gray-500 animate-pulse">
              Loading leaderboard…
            </p>
          ) : rows.length ? (
            <ol className="space-y-2">
              {rows.map((r, i) => {
                const isTop3 = i < 3;
                const ringColors = [
                  "ring-yellow-400",
                  "ring-gray-400",
                  "ring-amber-700",
                ];

                return (
                  <li
                    key={`${r.user_id}-${period}`}
                    className={`flex items-center justify-between bg-white rounded-xl p-3 shadow-sm border relative overflow-hidden
                                transition-all duration-300 animate-fade-in-up ${
                                  isTop3
                                    ? `ring-2 ${ringColors[i]} shadow-xl scale-[1.02]`
                                    : "hover:scale-[1.01]"
                                }`}
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Rank bubble */}
                      <span
                        className={`w-7 h-7 flex items-center justify-center rounded-full font-semibold ${
                          isTop3
                            ? "bg-indigo-600 text-white"
                            : "bg-indigo-50 text-indigo-700"
                        }`}
                      >
                        {i + 1}
                      </span>

                      <div className="text-sm">
                        <div className="font-semibold">
                          {r.email || `User ${r.user_id}`}
                        </div>
                        <div className="text-gray-500">
                          XP this {period}: {kFormat(r.total_xp)}
                        </div>
                      </div>
                    </div>

                    <div className="font-bold text-indigo-700 text-lg">
                      {kFormat(r.total_xp)}
                    </div>
                  </li>
                );
              })}
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
