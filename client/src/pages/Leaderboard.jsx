// client/src/pages/Leaderboard.jsx
import { useEffect, useState, useRef } from "react";
import { API_BASE } from "@/lib/api";

function kFormat(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n ?? 0);
}

// Smooth XP count-up animation
function animateXP(start, end, setter, duration = 600) {
  const startTime = performance.now();
  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const value = Math.floor(start + (end - start) * progress);
    setter(value);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

export default function Leaderboard() {
  const [period, setPeriod] = useState("daily");
  const [rows, setRows] = useState([]);
  const [displayRows, setDisplayRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

  const inFlight = useRef(null);

  const currentUserId = localStorage.getItem("fj_uid");

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
      setDisplayRows([]);
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

      setRows(data.top || []);

      // Animate XP-up effect
      const animated = data.top.map((r) => ({
        ...r,
        animatedXP: 0,
      }));
      setDisplayRows(animated);

      // start count-up per row
      requestAnimationFrame(() => {
        animated.forEach((row, idx) => {
          animateXP(0, row.total_xp, (v) => {
            setDisplayRows((old) => {
              const copy = [...old];
              copy[idx] = { ...copy[idx], animatedXP: v };
              return copy;
            });
          });
        });
      });

      setUpdatedAt(new Date());
    } catch (e) {
      if (e.name === "AbortError") return;
      console.error("Leaderboard fetch failed:", e);
      setRows([]);
      setDisplayRows([]);
      setErr(e.message || "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeaderboard(period);
    return () => inFlight.current?.abort();
    // eslint-disable-next-line
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
            className={`px-3 py-1 rounded-full transition ${
              period === p
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-gray-100 hover:bg-gray-200"
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
          className="px-4 py-1 rounded-full bg-violet-600 text-white disabled:opacity-60 hover:scale-105 transition"
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
              {displayRows.map((r, i) => {
                const isCurrentUser =
                  String(r.user_id) === String(currentUserId);

                // Rank trophy icons
                const trophy =
                  i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;

                return (
                  <li
                    key={`${r.user_id}-${period}`}
                    className={`
                      flex items-center justify-between p-3 rounded-xl shadow-sm
                      bg-white relative overflow-hidden
                      transition transform hover:scale-[1.01]
                      animate-fade-in
                      ${isCurrentUser ? "bg-indigo-50 border border-indigo-300" : ""}
                      ${i < 10 && !isCurrentUser ? "animate-leaderboard-glow" : ""}
                    `}
                    style={{
                      animationDelay: `${i * 80}ms`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-8 h-8 flex items-center justify-center rounded-full font-semibold
                          ${
                            i < 3
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-indigo-50 text-indigo-700"
                          }
                        `}
                      >
                        {trophy || i + 1}
                      </span>

                      <div className="text-sm">
                        <div
                          className={`font-semibold ${
                            isCurrentUser ? "text-indigo-700" : ""
                          }`}
                        >
                          {r.email || `User ${r.user_id}`}
                          {isCurrentUser && " (You)"}
                        </div>
                        <div className="text-gray-500">
                          XP this {period}: {kFormat(r.animatedXP)}
                        </div>
                      </div>
                    </div>

                    <div className="font-bold text-indigo-700 text-lg">
                      {kFormat(r.animatedXP)}
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
