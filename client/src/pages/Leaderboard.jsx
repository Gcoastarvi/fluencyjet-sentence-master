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

// Tiny helper: guess flag from email/domain (very lightweight)
function countryEmojiFromEmail(email = "") {
  const lower = email.toLowerCase();
  if (!lower.includes("@")) return "🌐";
  const domain = lower.split("@")[1] || "";

  if (domain.endsWith(".in")) return "🇮🇳";
  if (domain.endsWith(".uk")) return "🇬🇧";
  if (domain.endsWith(".us")) return "🇺🇸";
  if (domain.includes("gmail")) return "🇮🇳"; // your core audience
  if (domain.includes("yahoo")) return "🌐";
  return "🌐";
}

export default function Leaderboard() {
  const [period, setPeriod] = useState("daily"); // "daily" | "weekly" | "monthly"
  const [rows, setRows] = useState([]);
  const [displayRows, setDisplayRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

  const inFlight = useRef(null);

  // we use this to highlight "You"
  const currentUserId = localStorage.getItem("fj_uid");
  const currentUserEmail = localStorage.getItem("fj_email");

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

      const top = Array.isArray(data.top) ? data.top : [];
      setRows(top);

      // initialise animated rows
      const animated = top.map((r) => ({
        ...r,
        animatedXP: 0,
      }));
      setDisplayRows(animated);

      // count-up animation per row
      requestAnimationFrame(() => {
        animated.forEach((row, idx) => {
          animateXP(0, row.total_xp, (v) => {
            setDisplayRows((old) => {
              const copy = [...old];
              if (!copy[idx]) return copy;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  // max XP for thin bar scaling
  const maxXP =
    displayRows.length > 0
      ? Math.max(...displayRows.map((r) => Number(r.total_xp || 0)))
      : 0;

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h2 className="text-2xl font-bold text-center text-indigo-700">
        Leaderboard
      </h2>

      {/* Period selector */}
      <div className="flex gap-2 justify-center">
        {["daily", "weekly", "monthly"].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded-full text-sm transition ${
              period === p
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {p[0].toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Refresh + timestamp */}
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
                const userIdStr = String(r.user_id ?? "");
                const isCurrentUser =
                  (currentUserId && String(currentUserId) === userIdStr) ||
                  (!!currentUserEmail &&
                    r.email &&
                    r.email.toLowerCase() === currentUserEmail.toLowerCase());

                const name =
                  r.name ||
                  r.display_name ||
                  r.email ||
                  `User ${r.user_id ?? "?"}`;

                const initial = name.trim().charAt(0).toUpperCase() || "?";
                const flag = r.flag || countryEmojiFromEmail(r.email || "");

                const trophy =
                  i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;

                const xpValue = r.animatedXP ?? r.total_xp ?? 0;
                let barPct = maxXP > 0 ? (Number(xpValue) / maxXP) * 100 : 0;
                if (barPct > 100) barPct = 100;
                if (barPct > 0 && barPct < 8) barPct = 8; // minimum visible bar

                return (
                  <li
                    key={`${r.user_id}-${period}`}
                    className={`
                      leaderboard-row
                      flex items-center justify-between p-3 rounded-xl shadow-sm
                      bg-white relative overflow-hidden
                      transition transform hover:scale-[1.01] hover:shadow-md
                      ${isCurrentUser ? "leaderboard-self-glow border border-indigo-300" : ""}
                      ${i < 10 && !isCurrentUser ? "animate-leaderboard-glow" : ""}
                    `}
                    style={{ animationDelay: `${i * 70}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Rank circle with trophy / rank number */}
                      <span
                        className={`w-8 h-8 flex items-center justify-center rounded-full font-semibold text-sm
                          ${
                            i === 0
                              ? "bg-yellow-100 text-yellow-700"
                              : i === 1
                                ? "bg-slate-100 text-slate-700"
                                : i === 2
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-indigo-50 text-indigo-700"
                          }
                        `}
                      >
                        {trophy || i + 1}
                      </span>

                      {/* Avatar + name + xp text + XP bar */}
                      <div className="flex items-center gap-3">
                        {/* Avatar with initial */}
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center text-sm font-semibold shadow-sm">
                          {initial}
                        </div>

                        <div className="text-sm">
                          <div
                            className={`font-semibold flex items-center gap-1 ${
                              isCurrentUser ? "text-indigo-700" : ""
                            }`}
                          >
                            <span>{name}</span>
                            {isCurrentUser && (
                              <span className="text-[0.7rem] px-2 py-[1px] rounded-full bg-indigo-100 text-indigo-700 font-semibold">
                                You
                              </span>
                            )}
                            <span className="text-xs">{flag}</span>
                          </div>

                          <div className="text-gray-500 text-xs">
                            XP this {period}: {kFormat(xpValue)}
                          </div>

                          {/* Thin minimal XP bar */}
                          <div className="mt-1 w-40 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-all duration-500"
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right side: big XP number */}
                    <div className="font-bold text-indigo-700 text-lg">
                      {kFormat(xpValue)}
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
