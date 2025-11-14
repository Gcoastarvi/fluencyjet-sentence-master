// client/src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "@/hooks/useApi.js";

export default function Dashboard() {
  const api = useApi();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  async function loadSummary() {
    try {
      setLoading(true);
      const data = await api.get("/dashboard/summary");
      setSummary(data.summary);
      setLoading(false);
    } catch (err) {
      console.error("Dashboard load error:", err);
      setError("Failed to load dashboard");
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSummary();
  }, []);

  if (loading)
    return (
      <div className="text-center mt-20 text-indigo-600 text-xl">
        Loading dashboard…
      </div>
    );

  if (error)
    return (
      <div className="text-center mt-20 text-red-600 text-xl">{error}</div>
    );

  const stats = summary || {};
  const {
    total_xp = 0,
    week_xp = 0,
    month_xp = 0,
    streak = 0,
    last_activity,
    level,
    next_level_xp,
    xp_to_next,
    week_graph = [],
  } = stats;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6 mt-6">
      <h1 className="text-3xl font-bold text-indigo-700 text-center">
        Your Dashboard
      </h1>

      {/* XP Overview */}
      <div className="bg-white shadow-md p-5 rounded-xl space-y-3">
        <h2 className="text-xl font-semibold text-gray-800">XP Overview</h2>

        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="bg-indigo-50 p-3 rounded-lg">
            <p className="text-sm text-gray-500">Total XP</p>
            <p className="text-2xl font-bold text-indigo-700">{total_xp}</p>
          </div>

          <div className="bg-indigo-50 p-3 rounded-lg">
            <p className="text-sm text-gray-500">Weekly XP</p>
            <p className="text-2xl font-bold text-indigo-700">{week_xp}</p>
          </div>

          <div className="bg-indigo-50 p-3 rounded-lg">
            <p className="text-sm text-gray-500">Monthly XP</p>
            <p className="text-2xl font-bold text-indigo-700">{month_xp}</p>
          </div>

          <div className="bg-indigo-50 p-3 rounded-lg">
            <p className="text-sm text-gray-500">Streak</p>
            <p className="text-2xl font-bold text-indigo-700">{streak} 🔥</p>
          </div>
        </div>

        {/* XP Progress */}
        <div>
          <p className="text-sm text-gray-600 mt-2">
            Level {level} — {xp_to_next} XP to next level
          </p>
          <div className="w-full bg-gray-200 h-3 rounded-full mt-1">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all"
              style={{
                width: `${Math.min((total_xp / next_level_xp) * 100, 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Weekly XP Graph */}
      <div className="bg-white shadow p-5 rounded-xl">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Weekly Progress
        </h2>

        <div className="flex items-end gap-3 justify-between h-32">
          {week_graph.map((xp, i) => (
            <div key={i} className="flex flex-col items-center w-full">
              <div
                className="bg-indigo-500 w-6 rounded-t"
                style={{ height: `${Math.min(xp, 150)}px` }}
              ></div>
              <p className="text-xs mt-1 text-gray-600">
                {["M", "T", "W", "T", "F", "S", "S"][i]}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="text-center space-y-3">
        <Link
          to="/typing-quiz"
          className="bg-indigo-600 text-white py-2 px-4 rounded-full inline-block hover:scale-105 transition"
        >
          Continue Typing Quiz
        </Link>

        <br />

        <Link
          to="/lessons"
          className="bg-violet-600 text-white py-2 px-4 rounded-full inline-block hover:scale-105 transition"
        >
          View Lessons
        </Link>
      </div>

      <p className="text-center text-gray-400 text-xs">
        Last activity: {new Date(last_activity).toLocaleString()}
      </p>
    </div>
  );
}
