// client/src/pages/AdminUserDetail.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import AdminSidebar from "@/components/AdminSidebar";

// Recharts
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";

export default function AdminUserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [xpEvents, setXpEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [xp7, setXp7] = useState([]);
  const [xp30, setXp30] = useState([]);
  const [xpAll, setXpAll] = useState([]);
  const [forecast, setForecast] = useState([]); // 🔮 next-7-days prediction
  const [heatmap, setHeatmap] = useState([]); // 12-month calendar grid
  const [anomalies, setAnomalies] = useState([]); // 🚨 unusual XP activity

  /* LOAD USER + XP EVENTS */
  async function loadUser() {
    try {
      const res = await fetch(`/api/admin/user/${id}`, {
        credentials: "include",
      });

      if (res.status === 403) {
        navigate("/login");
        return;
      }

      const data = await res.json();
      if (data.ok) {
        const events = data.xpEvents || [];
        setUser(data.user);
        setXpEvents(events);
        generateCharts(events);
        buildHeatmap(events);
      }
    } catch (err) {
      console.error("Admin user detail error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* ───────────────────────────────
     ADMIN ACTIONS
  ──────────────────────────────── */
  async function promote() {
    if (!window.confirm("Promote this user to admin?")) return;

    const res = await fetch("/api/admin/promote", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id }),
    });

    const data = await res.json();
    if (data.ok) {
      alert("Promoted to admin!");
      loadUser();
    }
  }

  async function demote() {
    if (!window.confirm("Remove admin rights from this user?")) return;

    const res = await fetch("/api/admin/demote", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id }),
    });

    const data = await res.json();
    if (data.ok) {
      alert("Demoted!");
      loadUser();
    }
  }

  async function deleteUser() {
    if (!window.confirm("Delete this user permanently?")) return;

    const res = await fetch("/api/admin/delete", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id }),
    });

    const data = await res.json();
    if (data.ok) {
      alert("User deleted");
      navigate("/admin/users");
    }
  }

  /* ───────────────────────────────
     XP CHART + ANALYTICS ENGINE
  ──────────────────────────────── */
  function generateCharts(events = []) {
    const now = new Date();
    const shortDate = (d) =>
      d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

    // Helper: group XP into the last N days (for 7-day / 30-day charts)
    function groupXP(days) {
      const map = {};
      for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        map[key] = { date: shortDate(d), xp: 0 };
      }

      events.forEach((e) => {
        const key = e.createdAt.slice(0, 10);
        if (map[key]) map[key].xp += e.amount;
      });

      return Object.values(map).reverse();
    }

    // All-time XP per day for this user
    const allMap = {};
    events.forEach((e) => {
      const d = new Date(e.createdAt);
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      if (!allMap[key]) {
        allMap[key] = { date: shortDate(d), xp: 0 };
      }
      allMap[key].xp += e.amount;
    });

    const xpAllData = Object.keys(allMap)
      .sort()
      .map((key) => allMap[key]);

    // Simple 7-day forecast based on last ~30 days
    function buildForecastFromAllMap(map) {
      const keys = Object.keys(map).sort(); // YYYY-MM-DD ascending
      if (!keys.length) return [];

      // Use up to last 30 days for the “model”
      const recentKeys = keys.slice(-30);
      let total = 0;
      recentKeys.forEach((k) => {
        total += map[k].xp;
      });
      const avg = total / recentKeys.length || 0;

      // Tiny trend: compare last 7 vs previous 7 days
      let trendPerDay = 0;
      if (keys.length >= 14) {
        const last7 = keys.slice(-7);
        const prev7 = keys.slice(-14, -7);
        const sum = (arr) => arr.reduce((acc, k) => acc + map[k].xp, 0);
        const avgLast7 = sum(last7) / 7;
        const avgPrev7 = sum(prev7) / 7;
        trendPerDay = (avgLast7 - avgPrev7) / 7;
      }

      const lastDate = new Date(keys[keys.length - 1]);
      const forecastArr = [];
      for (let i = 1; i <= 7; i++) {
        const d = new Date(lastDate);
        d.setDate(lastDate.getDate() + i);
        const predicted = Math.max(0, avg + trendPerDay * i);
        forecastArr.push({ date: shortDate(d), xp: Math.round(predicted) });
      }
      return forecastArr;
    }

    const forecastData = buildForecastFromAllMap(allMap);

    /* ─────────────────────────────
       ANOMALY DETECTION
       Detects unusual spikes/drops
    ────────────────────────────── */
    function detectAnomalies(map) {
      const keys = Object.keys(map).sort();
      if (keys.length < 10) return []; // Not enough data

      // Use last 14 days for anomaly detection
      const recent = keys.slice(-14);
      const last14 = recent.map((k) => map[k].xp);

      const avg = last14.reduce((a, b) => a + b, 0) / (last14.length || 1);
      const stddev = Math.sqrt(
        last14.map((x) => Math.pow(x - avg, 2)).reduce((a, b) => a + b, 0) /
          (last14.length || 1),
      );

      const thresholdHigh = avg + stddev * 2; // spike
      const thresholdLow = avg - stddev * 2; // drop

      const alerts = [];

      // Only flag last 7 days
      keys.slice(-7).forEach((k) => {
        const xp = map[k].xp;
        const date = map[k].date;

        if (xp > thresholdHigh) {
          alerts.push({
            type: "high",
            date,
            xp,
            normal: Math.round(avg),
            msg: `XP spike: ${xp} (normal: ${Math.round(avg)})`,
          });
        }

        if (xp < thresholdLow) {
          alerts.push({
            type: "low",
            date,
            xp,
            normal: Math.round(avg),
            msg: `XP unusually low: ${xp} (normal: ${Math.round(avg)})`,
          });
        }
      });

      return alerts;
    }

    const anomalyData = detectAnomalies(allMap);

    // Push everything into state
    setXp7(groupXP(7));
    setXp30(groupXP(30));
    setXpAll(xpAllData);
    setForecast(forecastData);
    setAnomalies(anomalyData);
  }

  /* ───────────────────────────────
     12-MONTH HEATMAP (GitHub-style)
  ──────────────────────────────── */
  function buildHeatmap(events = []) {
    const today = new Date();
    const map = {};

    events.forEach((e) => {
      const key = e.createdAt.slice(0, 10); // YYYY-MM-DD
      if (!map[key]) map[key] = 0;
      map[key] += e.amount;
    });

    const weeks = [];

    // 52 weeks * 7 days = 364 days ≈ 12 months
    for (let week = 0; week < 52; week++) {
      const row = [];
      for (let dow = 0; dow < 7; dow++) {
        const d = new Date();
        d.setDate(today.getDate() - (week * 7 + dow));
        const key = d.toISOString().slice(0, 10);
        row.push({ date: key, xp: map[key] || 0 });
      }
      // Oldest at top, newest at bottom
      weeks.push(row.reverse());
    }

    setHeatmap(weeks.reverse());
  }

  function heatColor(xp) {
    if (xp === 0) return "bg-gray-200";
    if (xp < 20) return "bg-green-200";
    if (xp < 50) return "bg-green-300";
    if (xp < 100) return "bg-green-400";
    return "bg-green-600";
  }

  /* CATEGORY COLOR SET */
  const CATEGORY_COLORS = [
    "#6366f1",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
  ];

  function getCategoryData() {
    if (!xpEvents || xpEvents.length === 0) return [];

    const map = {};
    xpEvents.forEach((e) => {
      const key = e.reason || "Other";
      map[key] = (map[key] || 0) + e.amount;
    });

    let arr = Object.entries(map).map(([name, value]) => ({
      name,
      value,
    }));

    // Sort desc by XP
    arr.sort((a, b) => b.value - a.value);

    // Keep top 5 + "Other"
    if (arr.length > 6) {
      const top = arr.slice(0, 5);
      const restXP = arr.slice(5).reduce((sum, i) => sum + i.value, 0);
      top.push({ name: "Other", value: restXP });
      arr = top;
    }

    return arr;
  }

  const categoryData = getCategoryData();

  /* WEEKLY SUMMARY (This week vs Last week) */
  function getWeeklySummary() {
    const now = new Date();

    // assuming Monday as start of week
    const currentWeekStart = new Date(now);
    currentWeekStart.setHours(0, 0, 0, 0);
    currentWeekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));

    const lastWeekStart = new Date(currentWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const lastWeekEnd = new Date(currentWeekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);

    let thisWeekXP = 0;
    let lastWeekXP = 0;

    xpEvents.forEach((e) => {
      const d = new Date(e.createdAt);
      if (d >= currentWeekStart) thisWeekXP += e.amount;
      else if (d >= lastWeekStart && d <= lastWeekEnd) lastWeekXP += e.amount;
    });

    return [
      { name: "Last Week", xp: lastWeekXP },
      { name: "This Week", xp: thisWeekXP },
    ];
  }

  const weeklySummary = getWeeklySummary();

  /* HOURLY DISTRIBUTION (24-hour) */
  function getHourlyDistribution() {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      xp: 0,
    }));

    xpEvents.forEach((e) => {
      const h = new Date(e.createdAt).getHours();
      hours[h].xp += e.amount;
    });

    return hours;
  }

  const hourlyData = getHourlyDistribution();

  /* CONSISTENCY SCORE (AI-style badge) */
  function getConsistencyScore() {
    if (!xpEvents || xpEvents.length === 0)
      return { score: 0, label: "No Activity", color: "bg-gray-400" };

    const now = new Date();
    let xp7Total = 0;
    let xp30Total = 0;
    const activeDays14 = new Set();

    xpEvents.forEach((e) => {
      const d = new Date(e.createdAt);
      const diff = (now - d) / (1000 * 60 * 60 * 24);

      if (diff <= 7) xp7Total += e.amount;
      if (diff <= 30) xp30Total += e.amount;
      if (diff <= 14) activeDays14.add(d.toISOString().slice(0, 10));
    });

    const streak = user?.streak || 0;

    const score =
      xp7Total * 0.4 + xp30Total * 0.2 + activeDays14.size * 10 + streak * 5;

    if (score >= 400)
      return { score, label: "Excellent", color: "bg-green-600" };
    if (score >= 250) return { score, label: "Strong", color: "bg-yellow-500" };
    if (score >= 120) return { score, label: "Good", color: "bg-blue-500" };

    return { score, label: "Needs Improvement", color: "bg-red-500" };
  }

  const consistency = getConsistencyScore();
  /* ───────────────────────────────
     XP STABILITY INDEX (AI Metric)
  ──────────────────────────────── */
  function getStabilityIndex() {
    if (!xpAll || xpAll.length < 2)
      return { score: 0, label: "Not Enough Data", color: "bg-gray-400" };

    const values = xpAll.map((x) => x.xp);
    const avg = values.reduce((a, b) => a + b, 0) / (values.length || 1);

    // Variance
    const variance =
      values.map((v) => Math.pow(v - avg, 2)).reduce((a, b) => a + b, 0) /
      values.length;

    const stddev = Math.sqrt(variance);

    // Stability = 1 - (stddev / (avg + 1)) → normalized 0 to 1
    let stability = 1 - stddev / (avg + 1);
    stability = Math.max(0, Math.min(1, stability)); // clamp 0–1

    const score = Math.round(stability * 100);

    if (score >= 85)
      return { score, label: "Highly Stable", color: "bg-green-600" };
    if (score >= 60)
      return { score, label: "Moderately Stable", color: "bg-blue-500" };
    if (score >= 40)
      return { score, label: "Inconsistent", color: "bg-yellow-500" };

    return { score, label: "Very Unstable", color: "bg-red-600" };
  }

  const stability = getStabilityIndex();

  /* ───────────────────────────────
     LOADING / 404 STATES
  ──────────────────────────────── */
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading user details...
      </div>
    );

  if (!user)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>User not found.</p>
      </div>
    );

  /* ───────────────────────────────
     RENDER
  ──────────────────────────────── */
  return (
    <div className="min-h-screen flex bg-gray-100">
      <AdminSidebar />

      <main className="flex-1 p-10">
        {/* Breadcrumb */}
        <div className="text-sm text-gray-500 mb-4">
          <Link to="/admin" className="hover:underline">
            Admin
          </Link>{" "}
          /{" "}
          <Link to="/admin/users" className="hover:underline">
            Users
          </Link>{" "}
          / <span className="font-medium">{user.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">{user.name}</h1>
            <p className="text-gray-600">{user.email}</p>

            {user.isAdmin && (
              <div className="mt-2 px-3 py-1 bg-purple-100 text-purple-600 rounded text-xs inline-block">
                Admin
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            {!user.isAdmin && (
              <button
                onClick={promote}
                className="px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
              >
                Promote to Admin
              </button>
            )}

            {user.isAdmin && (
              <button
                onClick={demote}
                className="px-4 py-2 bg-orange-600 text-white text-sm rounded hover:bg-orange-700"
              >
                Demote Admin
              </button>
            )}

            <button
              onClick={deleteUser}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700"
            >
              Delete User
            </button>
          </div>
        </div>

        {/* Anomaly Warnings */}
        {anomalies.length > 0 ? (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded mb-8">
            <h2 className="text-lg font-semibold mb-2">Unusual XP Activity</h2>
            {anomalies.map((a, i) => (
              <div key={i} className="text-sm text-gray-700 mb-1">
                {a.type === "high" ? "🔥" : "⚠️"} <strong>{a.date}:</strong>{" "}
                {a.msg}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded mb-8">
            <p className="text-sm text-gray-700">
              ✅ No unusual XP patterns detected this week.
            </p>
          </div>
        )}

        {/* XP Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-xs text-gray-500">Total XP</div>
            <div className="text-2xl font-bold">{user.xpTotal}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-xs text-gray-500">Weekly XP</div>
            <div className="text-2xl font-bold">{user.xpWeekly}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-xs text-gray-500">Monthly XP</div>
            <div className="text-2xl font-bold">{user.xpMonthly}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-xs text-gray-500">Streak</div>
            <div className="text-2xl font-bold">{user.streak}</div>
          </div>
        </div>

        {/* Consistency Score Badge */}
        <div
          className={`inline-block px-4 py-2 rounded-lg text-white text-sm mb-10 ${consistency.color}`}
        >
          <span className="font-semibold">{consistency.label}</span>
          <span className="ml-2 opacity-80">
            (Score: {Math.round(consistency.score)})
          </span>
        </div>
        {/* Stability Index */}
        <div
          className={`inline-block px-4 py-2 rounded-lg text-white text-sm mb-10 ml-4 ${stability.color}`}
        >
          <span className="font-semibold">{stability.label}</span>
          <span className="ml-2 opacity-80">
            (Stability: {stability.score}%)
          </span>
        </div>

        {/* XP Last 7 Days */}
        <h2 className="text-xl font-semibold mb-3">XP Last 7 Days</h2>
        <div
          className="bg-white p-4 rounded-lg shadow mb-10"
          style={{ height: 250 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={xp7}>
              <CartesianGrid strokeDasharray="4 4" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="xp"
                stroke="#7e3af2"
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* XP Last 30 Days */}
        <h2 className="text-xl font-semibold mb-3">XP Last 30 Days</h2>
        <div
          className="bg-white p-4 rounded-lg shadow mb-10"
          style={{ height: 250 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={xp30}>
              <CartesianGrid strokeDasharray="4 4" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="xp"
                stroke="#7e3af2"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* XP All-Time */}
        <h2 className="text-xl font-semibold mb-3">XP — All Time</h2>
        <div
          className="bg-white p-4 rounded-lg shadow mb-10"
          style={{ height: 250 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={xpAll}>
              <CartesianGrid strokeDasharray="4 4" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="xp"
                stroke="#10b981"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* XP Forecast — Next 7 Days */}
        <h2 className="text-xl font-semibold mb-3">
          XP Forecast — Next 7 Days
          <span className="ml-2 text-xs font-normal text-gray-400">
            (experimental)
          </span>
        </h2>
        <div
          className="bg-white p-4 rounded-lg shadow mb-10"
          style={{ height: 250 }}
        >
          {forecast.length === 0 ? (
            <p className="text-sm text-gray-500">
              Not enough XP history to generate a forecast yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecast}>
                <CartesianGrid strokeDasharray="4 4" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="xp"
                  stroke="#f97316"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* XP by Category */}
        <h2 className="text-xl font-semibold mb-3">XP by Category</h2>
        <div
          className="bg-white p-4 rounded-lg shadow mb-10"
          style={{ height: 260 }}
        >
          {categoryData.length === 0 ? (
            <p className="text-sm text-gray-500">
              No XP categories to display yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  cx="40%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {categoryData.map((entry, idx) => (
                    <Cell
                      key={`cell-${idx}`}
                      fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  wrapperStyle={{ fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* This Week vs Last Week */}
        <h2 className="text-xl font-semibold mb-3">
          XP: This Week vs Last Week
        </h2>
        <div
          className="bg-white p-4 rounded-lg shadow mb-10"
          style={{ height: 260 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklySummary}>
              <CartesianGrid strokeDasharray="4 4" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="xp" fill="#6366f1" barSize={60} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* XP by Time of Day */}
        <h2 className="text-xl font-semibold mb-3">
          XP by Time of Day (24-Hour)
        </h2>
        <div
          className="bg-white p-4 rounded-lg shadow mb-10"
          style={{ height: 260 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyData}>
              <CartesianGrid strokeDasharray="4 4" />
              <XAxis dataKey="hour" interval={2} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="xp" fill="#f59e0b" barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Heatmap (Past 12 Months) */}
        <h2 className="text-xl font-semibold mb-3">
          XP Heatmap (Past 12 Months)
        </h2>
        <div className="bg-white p-4 rounded-lg shadow mb-10 overflow-x-auto">
          <div className="flex gap-1">
            {heatmap.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((day, di) => (
                  <div
                    key={di}
                    className={`w-4 h-4 rounded-sm ${heatColor(day.xp)}`}
                    title={`${day.date} — ${day.xp} XP`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Recent XP Events */}
        <h2 className="text-lg font-semibold mb-3">Recent XP Events</h2>
        <div className="bg-white shadow rounded-lg overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3">XP</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {xpEvents.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="p-3 font-semibold text-blue-700">
                    +{e.amount}
                  </td>
                  <td className="p-3">{e.reason}</td>
                  <td className="p-3">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}

              {xpEvents.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-gray-500">
                    No XP history yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
