// client/src/pages/Leaderboard.jsx
import { useEffect, useState, useRef } from "react";
import { API_BASE } from "@/lib/api";

function kFormat(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n ?? 0);
}

function periodLabel(p) {
  if (p === "daily") return "today";
  if (p === "weekly") return "this week";
  if (p === "monthly") return "this month";
  return p;
}

export default function Leaderboard() {
  const [period, setPeriod] = useState("daily"); // daily | weekly | monthly
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [you, setYou] = useState(null);
  const [rankBump, setRankBump] = useState(false);

  const inFlight = useRef(null);
  const prevRankRef = useRef(null);

  async function loadLeaderboard(p = period) {
    setLoading(true);
    setErr("");

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    const token = localStorage.getItem("fj_token");
    if (!token) {
      setErr("Please log in to view leaderboard.");
      setRows([]);
      setYou(null);
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
        throw new Error("Invalid response from server (not JSON).");
      }

      if (res.status === 401) {
        localStorage.removeItem("fj_token");
        throw new Error("Session expired. Please log in again.");
      }
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load leaderboard");
      }

      const top = Array.isArray(data.top) ? data.top : [];
      setRows(top);
      setUpdatedAt(new Date());

      const youInfo = data.you || null;
      setYou(youInfo);

      // rank improvement animation
      if (youInfo?.rank && prevRankRef.current) {
        if (youInfo.rank < prevRankRef.current) {
          setRankBump(true);
          setTimeout(() => setRankBump(false), 1500);
        }
      }
      prevRankRef.current = youInfo?.rank ?? null;
    } catch (e) {
      if (e.name === "AbortError") return;
      console.error("Leaderboard fetch failed:", e);
      setRows([]);
      setYou(null);
      setErr(e.message || "Failed to load leaderboard");
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
      <h2 className="text-2xl font-bold text-center text-indigo-700">
        Leaderboard
      </h2>
      <p className="text-center text-xs text-gray-500 mb-1">
        XP earned {periodLabel(period)} – higher XP = higher rank.
      </p>

      <div className="flex gap-2 justify-center">
        {["daily", "weekly", "monthly"].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              period === p
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-gray-100 text-gray-700"
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
          className="px-4 py-1 rounded-full bg-violet-600 text-white text-sm font-semibold disabled:opacity-60"
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
          {/* YOU bar – Option A: highlighted bar at top */}
          {you && (
            <div
              className={`mt-2 mb-2 rounded-2xl px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg flex items-center justify-between transition-transform ${
                rankBump ? "scale-[1.02]" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase tracking-wide bg-white/20 px-2 py-1 rounded-full">
                  YOU
                </span>
                <div>
                  <div className="text-sm font-semibold">
                    {you.email || "You"}
                  </div>
                  <div className="text-xs text-indigo-100">
                    Rank{" "}
                    <span className="font-bold">
                      {you.rank != null ? `#${you.rank}` : "—"}
                    </span>{" "}
                    • {kFormat(you.xp || 0)} XP {periodLabel(period)}
                  </div>
                </div>
              </div>
              {you.badge && (
                <div className="text-xs bg-white/20 rounded-full px-3 py-1 flex items-center gap-1">
                  <span>🏅</span>
                  <span className="font-medium">{you.badge.label}</span>
                </div>
              )}
            </div>
          )}

          {loading ? (
            <p className="text-center text-gray-500">Loading…</p>
          ) : rows.length ? (
            <ol className="space-y-2">
              {rows.map((r, i) => (
                <li
                  key={`${r.user_id ?? i}-${period}`}
                  className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm border border-violet-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 flex items-center justify-center rounded-full bg-indigo-50 text-indigo-700 font-semibold text-sm">
                      {r.rank ?? i + 1}
                    </span>
                    <div className="text-sm">
                      <div className="font-semibold">
                        {r.email || r.username || `User ${r.user_id ?? "?"}`}
                      </div>
                      <div className="text-gray-500 text-xs">
                        XP {periodLabel(period)}: {kFormat(r.total_xp)}
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
