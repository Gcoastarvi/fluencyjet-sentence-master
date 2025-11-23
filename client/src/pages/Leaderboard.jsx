import React, { useEffect, useState } from "react";
import { apiFetchWithAuth } from "../utils/fetch";

export default function Leaderboard() {
  const [period, setPeriod] = useState("weekly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [you, setYou] = useState(null);
  const [top, setTop] = useState([]);

  // Map UI buttons → backend query values
  const PERIOD_MAP = {
    today: "today",
    weekly: "weekly",
    monthly: "monthly",
    all: "all",
  };

  async function loadLeaderboard() {
    setLoading(true);
    setError("");

    try {
      const p = PERIOD_MAP[period] ?? "weekly";

      const res = await apiFetchWithAuth(`/api/leaderboard?period=${p}`, {
        method: "GET",
      });

      if (!res || !res.ok) {
        setError(res?.message || "Failed to load leaderboard");
        setLoading(false);
        return;
      }

      setRows(res.rows || []);
      setYou(res.you || null);
      setTop(res.top || []);
      setError("");
    } catch (e) {
      console.error("Leaderboard fetch error:", e);
      setError("Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeaderboard();
  }, [period]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <h1 className="text-3xl font-extrabold text-gray-900">
        FluencyJet Leaderboard
      </h1>
      <p className="text-gray-600 mt-1">
        See how you stack up against other learners this {period}.
      </p>

      {/* Period Switcher */}
      <div className="flex gap-3 mt-6">
        {["today", "weekly", "monthly", "all"].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-all 
              ${
                period === p
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                  : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
          >
            {p === "all"
              ? "All Time"
              : p === "weekly"
                ? "This Week"
                : p === "today"
                  ? "Today"
                  : "This Month"}
          </button>
        ))}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mt-6 bg-red-100 text-red-700 p-4 rounded-lg font-medium">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="mt-8 text-gray-600 text-lg font-medium">
          Loading leaderboard…
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          {/* Top Learners */}
          <section className="mt-10 bg-white p-6 rounded-2xl shadow-sm border">
            <h2 className="text-xl font-bold text-gray-900">Top Learners</h2>
            <p className="text-gray-500 mt-1">
              The most active learners this {period}.
            </p>

            {rows.length === 0 ? (
              <p className="mt-4 text-gray-600">
                No XP data yet. Complete your first quiz to appear on the
                leaderboard!
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {rows.map((r) => (
                  <li
                    key={r.userId}
                    className="flex justify-between items-center bg-gray-50 p-3 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-indigo-600">
                        #{r.rank}
                      </span>
                      <span className="font-medium text-gray-900">
                        {r.name}
                      </span>
                    </div>
                    <span className="text-gray-700 font-semibold">
                      {r.xp} XP
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Your Position */}
          <section className="mt-10 bg-white p-6 rounded-2xl shadow-sm border">
            <h2 className="text-xl font-bold text-gray-900">Your Position</h2>
            <p className="text-gray-500 mt-1">
              Track how you're progressing on the leaderboard.
            </p>

            {!you ? (
              <p className="mt-4 text-gray-600">
                You're not ranked yet for this period. Complete a quiz to join
                the leaderboard!
              </p>
            ) : (
              <div className="mt-4 bg-indigo-50 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-indigo-600 font-bold">
                    #{you.rank ?? "?"}
                  </span>
                  <span className="font-medium">{you.name}</span>
                </div>
                <span className="text-indigo-700 font-semibold">
                  {you.xp} XP {period === "weekly" ? "this week" : ""}
                </span>
              </div>
            )}
          </section>

          {/* Top Performers */}
          <section className="mt-10 mb-12 bg-white p-6 rounded-2xl shadow-sm border">
            <h2 className="text-xl font-bold text-gray-900">Top Performers</h2>
            <p className="text-gray-500 mt-1">
              Spotlight on the strongest performers this {period}.
            </p>

            {top.length === 0 ? (
              <p className="mt-4 text-gray-600">
                Top performers will appear here once learners earn XP.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                {top.map((t) => (
                  <div
                    key={t.userId}
                    className="bg-indigo-50 p-4 rounded-xl shadow-sm border border-indigo-100"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-700">
                        #{t.rank}
                      </span>
                      <span className="font-semibold text-gray-800">
                        {t.xp} XP
                      </span>
                    </div>
                    <p className="mt-2 text-gray-800 font-medium">{t.name}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
