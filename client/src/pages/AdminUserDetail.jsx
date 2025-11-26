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
     XP MOMENTUM SCORE (Acceleration)
  ──────────────────────────────── */
  function getMomentumScore() {
    if (!xpAll || xpAll.length < 14)
      return { score: 0, label: "Not Enough Data", color: "bg-gray-400" };

    // XP values sorted by date
    const values = xpAll.map((x) => x.xp);
    if (values.length < 14)
      return { score: 0, label: "Not Enough Data", color: "bg-gray-400" };

    const last7 = values.slice(-7);
    const prev7 = values.slice(-14, -7);

    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

    const avgLast = avg(last7);
    const avgPrev = avg(prev7);

    const momentum = avgLast - avgPrev; // raw delta

    // Normalize into a 0 – 100 scale
    let score = Math.min(100, Math.max(0, momentum * 2 + 50));

    if (score >= 75)
      return { score, label: "Accelerating Fast", color: "bg-green-600" };
    if (score >= 55)
      return { score, label: "Increasing", color: "bg-blue-500" };
    if (score >= 40)
      return { score, label: "Flat / Stable", color: "bg-gray-500" };
    return { score, label: "Declining", color: "bg-red-600" };
  }

  const momentum = getMomentumScore();
  /* ───────────────────────────────
     LEARNING FATIGUE DETECTION
     Detect burnout: falling XP, reduced activity
  ──────────────────────────────── */
  function getFatigueStatus() {
    if (!xpAll || xpAll.length < 14)
      return { level: "none", msg: "Not enough data", color: "bg-gray-400" };

    const values = xpAll.map((d) => d.xp);
    const last7 = values.slice(-7);
    const prev7 = values.slice(-14, -7);

    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

    const lastAvg = avg(last7);
    const prevAvg = avg(prev7);

    // detect drop
    const drop = prevAvg - lastAvg;

    // count active days
    const activeDaysLast7 = last7.filter((v) => v > 0).length;
    const activeDaysPrev7 = prev7.filter((v) => v > 0).length;

    let fatigueScore = 0;

    if (drop > 0) fatigueScore += drop * 2;
    if (activeDaysPrev7 > activeDaysLast7)
      fatigueScore += (activeDaysPrev7 - activeDaysLast7) * 8;

    if (fatigueScore >= 80)
      return {
        level: "high",
        msg: "⚠️ Severe learning fatigue detected — XP & activity dropping sharply.",
        color: "bg-red-600",
      };

    if (fatigueScore >= 45)
      return {
        level: "medium",
        msg: "⚠️ Moderate fatigue — XP trend slipping.",
        color: "bg-yellow-500",
      };

    if (fatigueScore >= 15)
      return {
        level: "low",
        msg: "Mild fatigue — Slight downward trend.",
        color: "bg-blue-500",
      };

    return {
      level: "none",
      msg: "💚 No signs of learning fatigue.",
      color: "bg-green-600",
    };
  }

  const fatigue = getFatigueStatus(); // 🔥 add this line

  /* ───────────────────────────────
     XP DIFFICULTY INDEX
     Measures how "hard" XP is earned
  ──────────────────────────────── */
  function getDifficultyIndex() {
    if (!xpAll || xpAll.length < 10)
      return { score: 0, label: "Insufficient Data", color: "bg-gray-400" };

    const values = xpAll.map((d) => d.xp);

    // Variation = see how inconsistent XP is day-to-day
    const diffs = [];
    for (let i = 1; i < values.length; i++) {
      diffs.push(Math.abs(values[i] - values[i - 1]));
    }

    const avgDiff = diffs.reduce((a, b) => a + b, 0) / (diffs.length || 1);

    // Compare to average XP
    const avgXP = values.reduce((a, b) => a + b, 0) / values.length;

    let difficulty = avgDiff - avgXP * 0.3;

    // Normalize to 0–100
    difficulty = Math.max(0, Math.min(100, difficulty));

    if (difficulty >= 70)
      return {
        score: difficulty,
        label: "High Difficulty",
        color: "bg-red-600",
      };

    if (difficulty >= 45)
      return {
        score: difficulty,
        label: "Moderate Difficulty",
        color: "bg-yellow-500",
      };

    if (difficulty >= 20)
      return {
        score: difficulty,
        label: "Mild Difficulty",
        color: "bg-blue-500",
      };

    return {
      score: difficulty,
      label: "Low Difficulty",
      color: "bg-green-600",
    };
  }

  const difficulty = getDifficultyIndex();
  const behavior = getLearningBehavior();

  /* ───────────────────────────────
     LEARNING BEHAVIOR CLASSIFIER
     Determines study type: Bursts vs Consistent vs Streaker
  ──────────────────────────────── */
  function getLearningBehavior() {
    if (!xpAll || xpAll.length < 10)
      return { label: "Not Enough Data", desc: "", color: "bg-gray-400" };

    const values = xpAll.map((d) => d.xp);

    const activeDays = values.filter((v) => v > 0).length;
    const totalDays = values.length;
    const activityRate = activeDays / totalDays; // % of days with any XP

    const bursts = [];
    for (let i = 1; i < values.length; i++) {
      bursts.push(Math.abs(values[i] - values[i - 1]));
    }
    const avgBurst = bursts.reduce((a, b) => a + b, 0) / bursts.length;

    const streak = user?.streak || 0;

    // Classification logic
    if (streak >= 10 && activityRate >= 0.7) {
      return {
        label: "Streak Learner",
        desc: "Learns daily with strong streak discipline.",
        color: "bg-green-600",
      };
    }

    if (avgBurst > 50) {
      return {
        label: "Burst Learner",
        desc: "Learns in intense bursts followed by cooldown days.",
        color: "bg-yellow-500",
      };
    }

    if (activityRate >= 0.6) {
      return {
        label: "Consistent Learner",
        desc: "Maintains a steady learning pace.",
        color: "bg-blue-500",
      };
    }

    return {
      label: "Casual Learner",
      desc: "Low activity days with occasional XP bursts.",
      color: "bg-gray-500",
    };
  }
  /* ───────────────────────────────
     XP PERSISTENCE INDEX
     Measures how long the user stays active
  ──────────────────────────────── */
  function getPersistenceIndex() {
    if (!xpAll || xpAll.length === 0)
      return { score: 0, label: "No Activity", color: "bg-gray-400" };

    const values = xpAll.map((d) => d.xp);

    // Count how many times user returns after a zero-XP day
    let restarts = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] === 0 && values[i] > 0) restarts++;
    }

    // Active-day ratio
    const activeDays = values.filter((v) => v > 0).length;
    const totalDays = values.length;
    const activeRate = activeDays / totalDays;

    // Persistence Formula:
    // Higher: more active streaks + fewer long breaks
    let score = activeRate * 70 + restarts * 3;

    score = Math.max(0, Math.min(100, score)); // clamp

    if (score >= 80)
      return {
        score,
        label: "Highly Persistent",
        color: "bg-green-600",
      };

    if (score >= 55)
      return {
        score,
        label: "Persistent",
        color: "bg-blue-500",
      };

    if (score >= 30)
      return {
        score,
        label: "Low Persistence",
        color: "bg-yellow-500",
      };

    return {
      score,
      label: "Very Low Persistence",
      color: "bg-red-600",
    };
  }

  const persistence = getPersistenceIndex();
  /* ───────────────────────────────
     XP MOMENTUM VARIABILITY SCORE
     How stable is momentum day-to-day?
  ──────────────────────────────── */
  function getMomentumVariability() {
    if (!xpAll || xpAll.length < 10)
      return { score: 0, label: "Not Enough Data", color: "bg-gray-400" };

    const values = xpAll.map((d) => d.xp);

    // Day-to-day momentum = difference between today & yesterday
    const diffs = [];
    for (let i = 1; i < values.length; i++) {
      diffs.push(values[i] - values[i - 1]);
    }

    // Variability = standard deviation of momentum
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / (diffs.length || 1);

    const variance =
      diffs.map((d) => Math.pow(d - avgDiff, 2)).reduce((a, b) => a + b, 0) /
      diffs.length;

    const stddev = Math.sqrt(variance);

    // Convert to a normalized 0–100 score (lower variability = better)
    let score = 100 - Math.min(100, stddev * 3);

    if (score >= 80)
      return {
        score,
        label: "Highly Stable Momentum",
        color: "bg-green-600",
      };

    if (score >= 60)
      return {
        score,
        label: "Stable Momentum",
        color: "bg-blue-500",
      };

    if (score >= 40)
      return {
        score,
        label: "Unstable Momentum",
        color: "bg-yellow-500",
      };

    return {
      score,
      label: "Highly Volatile Momentum",
      color: "bg-red-600",
    };
  }

  const momentumVar = getMomentumVariability();
  /* ───────────────────────────────
     XP VOLATILITY SPARKLINE DATA
     Tiny trend-line for rhythmic XP visualization
  ──────────────────────────────── */
  function getSparklineData() {
    if (!xpAll || xpAll.length < 3) return [];

    // take last 20 days for sparkline (small clean trend)
    const recent = xpAll.slice(-20);

    return recent.map((d, i) => ({
      index: i,
      xp: d.xp,
    }));
  }

  const sparkline = getSparklineData();
  /* ───────────────────────────────
     XP RETURN RATE (Comeback Score)
     Measures how quickly a user comes
     back from breaks (0 XP days)
  ───────────────────────────────── */
  function getReturnRate() {
    if (!xpAll || xpAll.length < 7)
      return { score: 0, label: "Not Enough Data", color: "bg-gray-400" };

    const values = xpAll.map((d) => d.xp);

    // Find distances between active days
    let gaps = [];
    let gapCount = 0;

    for (let i = 0; i < values.length; i++) {
      if (values[i] === 0) {
        gapCount++;
      } else {
        if (gapCount > 0) {
          gaps.push(gapCount);
          gapCount = 0;
        }
      }
    }

    if (gaps.length === 0)
      return { score: 100, label: "Daily Active", color: "bg-green-600" };

    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

    // Convert gap to score: shorter gap = better
    let score = 100 - Math.min(100, avgGap * 15); // Each off-day reduces score

    if (score >= 75)
      return { score, label: "Fast Comeback", color: "bg-green-600" };
    if (score >= 55)
      return { score, label: "Good Comeback", color: "bg-blue-500" };
    if (score >= 35)
      return { score, label: "Slow Comeback", color: "bg-yellow-500" };

    return { score, label: "Rare Comebacks", color: "bg-red-600" };
  }
  /* ───────────────────────────────
     WEEKEND WARRIOR INDEX
     Compares XP on weekends vs weekdays
  ──────────────────────────────── */
  function getWeekendWarriorIndex() {
    if (!xpAll || xpAll.length < 14)
      return { label: "Not Enough Data", score: 0, color: "bg-gray-400" };

    // xpAll is already sorted day by day
    let weekendXP = 0;
    let weekdayXP = 0;

    xpAll.forEach((entry) => {
      const date = new Date(entry.date);
      const day = date.getDay(); // 0 = Sunday, 6 = Saturday

      if (day === 0 || day === 6) weekendXP += entry.xp;
      else weekdayXP += entry.xp;
    });

    const total = weekendXP + weekdayXP;
    if (total === 0)
      return { label: "No Activity", score: 0, color: "bg-gray-400" };

    const weekendRatio = weekendXP / total;
    const score = Math.round(weekendRatio * 100);

    if (score >= 70)
      return {
        label: "Weekend Warrior",
        score,
        color: "bg-red-500",
      };

    if (score >= 55)
      return {
        label: "Weekend-Heavy Learner",
        score,
        color: "bg-yellow-500",
      };

    if (score >= 40)
      return {
        label: "Balanced Learner",
        score,
        color: "bg-blue-500",
      };

    return {
      label: "Weekday Learner",
      score,
      color: "bg-green-600",
    };
  }

  const weekendIndex = getWeekendWarriorIndex();
  /* ───────────────────────────────
     XP ENGAGEMENT DENSITY SCORE
     How densely the user earns XP
  ──────────────────────────────── */
  function getEngagementDensity() {
    if (!xpAll || xpAll.length < 10)
      return { score: 0, label: "Not Enough Data", color: "bg-gray-400" };

    const last30 = xpAll.slice(-30);
    const values = last30.map((d) => d.xp);

    const totalXP = values.reduce((a, b) => a + b, 0);
    const activeDays = values.filter((v) => v > 0).length;

    if (activeDays === 0)
      return { score: 0, label: "No Active Days", color: "bg-gray-400" };

    const density = totalXP / activeDays; // XP per active day

    // Normalize to 0–100
    let score = Math.min(100, Math.max(0, density * 1.2));

    if (score >= 80)
      return { score, label: "Elite Density", color: "bg-green-600" };

    if (score >= 60)
      return { score, label: "Strong Density", color: "bg-blue-500" };

    if (score >= 40)
      return { score, label: "Moderate Density", color: "bg-yellow-500" };

    if (score >= 20)
      return { score, label: "Low Density", color: "bg-orange-500" };

    return { score, label: "Very Low Density", color: "bg-red-600" };
  }

  const density = getEngagementDensity();
  /* ───────────────────────────────
     XP LEARNING PATTERN CLUSTERS
     (Light K-means Style Classification)
  ──────────────────────────────── */
  function getPatternCluster() {
    if (!xpAll || xpAll.length < 10)
      return { label: "Not Enough Data", desc: "", color: "bg-gray-400" };

    const values = xpAll.map((v) => v.xp);

    const avg = values.reduce((a, b) => a + b, 0) / (values.length || 1);

    const variance =
      values.map((v) => Math.pow(v - avg, 2)).reduce((a, b) => a + b, 0) /
      values.length;

    const stddev = Math.sqrt(variance);

    const maxXP = Math.max(...values);
    const minXP = Math.min(...values);

    /* LIGHT CLUSTERING LOGIC */
    if (avg > 80 && stddev < 20) {
      return {
        label: "Power Learner",
        desc: "High, steady XP — elite performance.",
        color: "bg-green-700",
      };
    }

    if (stddev > 60 && maxXP > avg * 2) {
      return {
        label: "Burst Learner",
        desc: "Large spikes followed by cooldowns.",
        color: "bg-yellow-600",
      };
    }

    if (avg < 20 && stddev < 10) {
      return {
        label: "Streak Performer",
        desc: "Consistent learner with small but steady XP.",
        color: "bg-blue-600",
      };
    }

    if (variance < 40) {
      return {
        label: "Balanced Learner",
        desc: "Stable XP trend with predictable growth.",
        color: "bg-purple-600",
      };
    }

    return {
      label: "Chaotic Learner",
      desc: "Highly unpredictable XP pattern.",
      color: "bg-red-600",
    };
  }

  const patternCluster = getPatternCluster();
  /* ───────────────────────────────
     XP CONSISTENCY TRENDLINE (30-Day)
     Visualizes daily rhythm stability
  ──────────────────────────────── */
  function getConsistencyTrend() {
    if (!xpAll || xpAll.length < 5) return [];

    // We will calculate 1 consistency score per day
    // based on: XP value + active streak streakiness + momentum
    const trend = xpAll.slice(-30).map((d, i, arr) => {
      const xp = d.xp;

      const prev = arr[i - 1]?.xp || xp;
      const delta = xp - prev;

      let score =
        xp * 0.4 + // XP weight
        Math.max(0, 40 - Math.abs(delta)) + // stability factor
        (xp > 0 ? 20 : 0); // reward active days

      score = Math.min(100, Math.max(0, score));

      return {
        date: d.date,
        score,
      };
    });

    return trend;
  }

  const consistencyTrend = getConsistencyTrend();
  /* ───────────────────────────────
     XP HABIT STRENGTH SCORE
     Determines how strong the user's learning habit is
  ──────────────────────────────── */
  function getHabitStrength() {
    if (!xpAll || xpAll.length < 14)
      return { score: 0, label: "Not Enough Data", color: "bg-gray-400" };

    const values = xpAll.map((d) => d.xp);
    const activeDays = values.filter((v) => v > 0).length;
    const totalDays = values.length;

    const activityRate = activeDays / totalDays; // % of active days
    const streak = user?.streak || 0;

    // micro-restarter score (ability to bounce back)
    let restarts = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] === 0 && values[i] > 0) restarts++;
    }

    // Habit Strength Formula (0–100)
    let score =
      activityRate * 40 + // consistency of activity
      Math.min(streak, 30) * 1.5 + // streak contribution (max 45)
      restarts * 3; // bounce-back strength

    score = Math.max(0, Math.min(100, score));

    if (score >= 80)
      return {
        score,
        label: "Unbreakable Habit",
        color: "bg-green-700",
      };

    if (score >= 60)
      return {
        score,
        label: "Strong Habit",
        color: "bg-green-500",
      };

    if (score >= 40)
      return {
        score,
        label: "Growing Habit",
        color: "bg-yellow-500",
      };

    if (score >= 20)
      return {
        score,
        label: "Weak Habit",
        color: "bg-orange-500",
      };

    return {
      score,
      label: "No Habit Yet",
      color: "bg-red-600",
    };
  }

  const habit = getHabitStrength();
  /* ───────────────────────────────
     XP MOTIVATION INDEX (AI Metric)
     Measures how motivated the user is
  ──────────────────────────────── */
  function getMotivationIndex() {
    if (!xpAll || xpAll.length < 10)
      return { score: 0, label: "Not Enough Data", color: "bg-gray-400" };

    const values = xpAll.map((d) => d.xp);

    // Recent activity measures
    const last7 = values.slice(-7);
    const prev7 = values.slice(-14, -7);

    const sum = (arr) => arr.reduce((a, b) => a + b, 0);
    const avg = (arr) => (arr.length ? sum(arr) / arr.length : 0);

    const avgLast = avg(last7);
    const avgPrev = avg(prev7);

    // XP acceleration
    const momentum = avgLast - avgPrev;

    // Activity frequency
    const activeDays = last7.filter((v) => v > 0).length;

    // Comeback ability
    let restarts = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] === 0 && values[i] > 0) restarts++;
    }

    // Streak
    const streak = user?.streak || 0;

    // SCORE FORMULA (0–100)
    let score =
      avgLast * 0.4 + // recent intensity
      momentum * 1.5 + // acceleration
      activeDays * 5 + // frequency
      restarts * 2 + // comeback
      streak * 1.2; // long-term drive

    score = Math.max(0, Math.min(100, score)); // clamp 0–100

    if (score >= 80)
      return { score, label: "Highly Motivated", color: "bg-green-600" };

    if (score >= 60) return { score, label: "Motivated", color: "bg-blue-500" };

    if (score >= 40)
      return { score, label: "Neutral Motivation", color: "bg-gray-500" };

    if (score >= 20)
      return { score, label: "Low Motivation", color: "bg-yellow-500" };

    return { score, label: "Very Low Motivation", color: "bg-red-600" };
  }

  const motivation = getMotivationIndex();
  /* ───────────────────────────────
     XP MOTIVATION STABILITY RATIO
     Measures how stable motivation
     stays across 14 days
  ──────────────────────────────── */
  function getMotivationStability() {
    if (!xpAll || xpAll.length < 14)
      return { score: 0, label: "Not Enough Data", color: "bg-gray-400" };

    const values = xpAll.map((d) => d.xp);

    const last14 = values.slice(-14);
    const avg = last14.reduce((a, b) => a + b, 0) / (last14.length || 1);

    // Stability: how often the day stays near average
    let stableDays = 0;
    last14.forEach((v) => {
      if (Math.abs(v - avg) <= avg * 0.35) stableDays++;
    });

    // Score = % of stable days
    let score = Math.round((stableDays / 14) * 100);

    if (score >= 80)
      return {
        score,
        label: "Highly Stable Motivation",
        color: "bg-green-600",
      };

    if (score >= 60)
      return {
        score,
        label: "Stable Motivation",
        color: "bg-blue-500",
      };

    if (score >= 40)
      return {
        score,
        label: "Moderately Unstable",
        color: "bg-yellow-500",
      };

    return {
      score,
      label: "Highly Unstable Motivation",
      color: "bg-red-600",
    };
  }

  const motivationStability = getMotivationStability();
  /* ───────────────────────────────
     XP LEARNING EFFICIENCY RATIO
     Measures XP earned per active day
  ──────────────────────────────── */
  function getLearningEfficiency() {
    if (!xpAll || xpAll.length < 7)
      return { score: 0, label: "Not Enough Data", color: "bg-gray-400" };

    const values = xpAll.map((d) => d.xp);

    const totalXP = values.reduce((a, b) => a + b, 0);
    const activeDays = values.filter((v) => v > 0).length;
    const totalDays = values.length;

    if (activeDays === 0)
      return { score: 0, label: "No Active Days", color: "bg-gray-400" };

    // Efficiency = XP per active day
    const efficiency = totalXP / activeDays;

    // Normalize to 0–100 score
    let score = Math.min(100, Math.max(0, efficiency * 1.1));

    if (score >= 80)
      return {
        score,
        label: "High Efficiency",
        color: "bg-green-600",
      };

    if (score >= 55)
      return {
        score,
        label: "Efficient",
        color: "bg-blue-500",
      };

    if (score >= 35)
      return {
        score,
        label: "Moderate Efficiency",
        color: "bg-yellow-500",
      };

    if (score >= 15)
      return {
        score,
        label: "Low Efficiency",
        color: "bg-orange-500",
      };

    return {
      score,
      label: "Very Low Efficiency",
      color: "bg-red-600",
    };
  }

  const efficiency = getLearningEfficiency();
  /* ───────────────────────────────
     XP RESILIENCE SCORE
     Measures how strongly the user 
     bounces back after low-XP drops
  ──────────────────────────────── */
  function getResilienceScore() {
    if (!xpAll || xpAll.length < 10)
      return { score: 0, label: "Not Enough Data", color: "bg-gray-400" };

    const values = xpAll.map((d) => d.xp);

    // Detect drops (0 XP or very low XP days)
    const drops = [];
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] <= 5 && values[i] > values[i - 1]) {
        // recovered after a drop
        drops.push(values[i] - values[i - 1]);
      }
    }

    if (drops.length === 0)
      return { score: 70, label: "Steady Performer", color: "bg-blue-500" };

    const avgBounce = drops.reduce((a, b) => a + b, 0) / drops.length;

    // Normalize to 0–100
    let score = Math.min(100, Math.max(0, avgBounce * 1.5));

    if (score >= 80)
      return {
        score,
        label: "Exceptional Resilience",
        color: "bg-green-600",
      };

    if (score >= 60)
      return {
        score,
        label: "Strong Resilience",
        color: "bg-blue-500",
      };

    if (score >= 40)
      return {
        score,
        label: "Moderate Resilience",
        color: "bg-yellow-500",
      };

    if (score >= 20)
      return {
        score,
        label: "Weak Resilience",
        color: "bg-orange-500",
      };

    return {
      score,
      label: "Very Low Resilience",
      color: "bg-red-600",
    };
  }

  const resilience = getResilienceScore();
  /* ───────────────────────────────
     XP RHYTHM INDEX
     Measures how regular the learning schedule is
  ──────────────────────────────── */
  function getRhythmIndex() {
    if (!xpAll || xpAll.length < 10)
      return { score: 0, label: "Not Enough Data", color: "bg-gray-400" };

    const values = xpAll.map((d) => d.xp);

    // collect indices of active days
    const activeIndices = [];
    values.forEach((xp, idx) => {
      if (xp > 0) activeIndices.push(idx);
    });

    if (activeIndices.length <= 1) {
      // either no activity or a single active burst
      return { score: 0, label: "No Rhythm Yet", color: "bg-red-600" };
    }

    // gaps in days between active sessions
    const gaps = [];
    for (let i = 1; i < activeIndices.length; i++) {
      gaps.push(activeIndices[i] - activeIndices[i - 1]); // number of days between active days
    }

    // if user is literally active every day, perfect rhythm
    if (gaps.every((g) => g === 1)) {
      return {
        score: 100,
        label: "Perfect Daily Rhythm",
        color: "bg-green-700",
      };
    }

    const avgGap = gaps.reduce((sum, g) => sum + g, 0) / (gaps.length || 1);

    const avg = gaps.reduce((sum, g) => sum + g, 0) / (gaps.length || 1);

    const variance =
      gaps.map((g) => Math.pow(g - avg, 2)).reduce((a, b) => a + b, 0) /
      gaps.length;

    const stddev = Math.sqrt(variance);

    // irregularity: big penalty for high stddev and gaps much > 1
    let irregularity = stddev * 25 + Math.max(0, avgGap - 1) * 20;

    // convert to 0–100 score (higher = better rhythm)
    let score = 100 - Math.min(100, irregularity);
    score = Math.max(0, Math.min(100, score));

    if (score >= 80)
      return {
        score,
        label: "Highly Rhythmic Learner",
        color: "bg-green-600",
      };

    if (score >= 60)
      return {
        score,
        label: "Stable Rhythm",
        color: "bg-blue-500",
      };

    if (score >= 40)
      return {
        score,
        label: "Irregular Rhythm",
        color: "bg-yellow-500",
      };

    return {
      score,
      label: "Chaotic Rhythm",
      color: "bg-red-600",
    };
  }

  const rhythm = getRhythmIndex();

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
        {/* Momentum Score */}
        <div
          className={`inline-block px-4 py-2 rounded-lg text-white text-sm mb-10 ml-4 ${momentum.color}`}
        >
          <span className="font-semibold">{momentum.label}</span>
          <span className="ml-2 opacity-80">(Momentum: {momentum.score}%)</span>
        </div>
        {/* Fatigue Detection */}
        <div
          className={`inline-block px-4 py-2 rounded-lg text-white text-sm mb-10 ml-4 ${fatigue.color}`}
        >
          <span className="font-semibold">
            {fatigue.level === "none" ? "No Fatigue" : "Learning Fatigue"}
          </span>
          <span className="ml-2 opacity-80">{fatigue.msg}</span>
        </div>
        {/* Difficulty Index */}
        <div
          className={`inline-block px-4 py-2 rounded-lg text-white text-sm mb-10 ml-4 ${difficulty.color}`}
        >
          <span className="font-semibold">{difficulty.label}</span>
          <span className="ml-2 opacity-80">
            (Difficulty: {difficulty.score.toFixed(0)}%)
          </span>
        </div>
        {/* Learning Behavior */}
        <div
          className={`inline-block px-4 py-2 rounded-lg text-white text-sm mb-10 ml-4 ${behavior.color}`}
        >
          <span className="font-semibold">{behavior.label}</span>
          <span className="ml-2 opacity-80">{behavior.desc}</span>
        </div>
        {/* Persistence Index */}
        <div
          className={`inline-block px-4 py-2 rounded-lg text-white text-sm mb-10 ml-4 ${persistence.color}`}
        >
          <span className="font-semibold">{persistence.label}</span>
          <span className="ml-2 opacity-80">
            (Persistence: {persistence.score.toFixed(0)}%)
          </span>
        </div>
        {/* Momentum Variability */}
        <div
          className={`inline-block px-4 py-2 rounded-lg text-white text-sm mb-10 ml-4 ${momentumVar.color}`}
        >
          <span className="font-semibold">{momentumVar.label}</span>
          <span className="ml-2 opacity-80">
            (Variability: {momentumVar.score.toFixed(0)}%)
          </span>
        </div>
        {/* Return Rate */}
        <div
          className={`inline-block px-4 py-2 rounded-lg text-white text-sm mb-10 ml-4 ${getReturnRate().color}`}
        >
          <span className="font-semibold">{getReturnRate().label}</span>
          <span className="ml-2 opacity-80">
            (Return Rate: {getReturnRate().score.toFixed(0)}%)
          </span>
        </div>
        {/* XP Volatility Sparkline */}
        <div className="inline-block bg-white px-4 py-3 rounded-lg shadow mb-10 ml-4">
          <div className="text-xs text-gray-500 mb-2">Volatility Trend</div>
          <div style={{ width: 150, height: 50 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkline}>
                <Line
                  type="monotone"
                  dataKey="xp"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* Weekend Warrior Index */}
        <div
          className={`inline-block px-4 py-2 rounded-lg text-white text-sm mb-10 ml-4 ${weekendIndex.color}`}
        >
          <span className="font-semibold">{weekendIndex.label}</span>
          <span className="ml-2 opacity-80">
            (Weekend Ratio: {weekendIndex.score}%)
          </span>
        </div>
        {/* Engagement Density Score */}
        <div
          className={`inline-block px-4 py-2 rounded-lg text-white text-sm mb-10 ml-4 ${density.color}`}
        >
          <span className="font-semibold">{density.label}</span>
          <span className="ml-2 opacity-80">
            (Density: {density.score.toFixed(0)}%)
          </span>
        </div>
        {/* Learning Pattern Cluster */}
        <div
          className={`inline-block px-4 py-2 rounded-lg text-white text-sm mb-10 ml-4 ${patternCluster.color}`}
        >
          <span className="font-semibold">{patternCluster.label}</span>
          <span className="ml-2 opacity-80">{patternCluster.desc}</span>
        </div>
        {/* Habit Strength Score */}
        <div
          className={`inline-block px-4 py-2 rounded-lg text-white text-sm mb-10 ml-4 ${habit.color}`}
        >
          <span className="font-semibold">{habit.label}</span>
          <span className="ml-2 opacity-80">
            (Habit Strength: {habit.score.toFixed(0)}%)
          </span>
        </div>
        {/* Motivation Index */}
        <div
          className={`inline-block px-4 py-2 rounded-lg text-white text-sm mb-10 ml-4 ${motivation.color}`}
        >
          <span className="font-semibold">{motivation.label}</span>
          <span className="ml-2 opacity-80">
            (Motivation: {motivation.score.toFixed(0)}%)
          </span>
        </div>
        {/* Motivation Stability Ratio */}
        <div
          className={`inline-block px-4 py-2 rounded-lg text-white text-sm mb-10 ml-4 ${motivationStability.color}`}
        >
          <span className="font-semibold">{motivationStability.label}</span>
          <span className="ml-2 opacity-80">
            (Stability: {motivationStability.score}%)
          </span>
        </div>
        {/* Learning Efficiency Ratio */}
        <div
          className={`inline-block px-4 py-2 rounded-lg text-white text-sm mb-10 ml-4 ${efficiency.color}`}
        >
          <span className="font-semibold">{efficiency.label}</span>
          <span className="ml-2 opacity-80">
            (Efficiency: {efficiency.score.toFixed(0)}%)
          </span>
        </div>
        {/* Resilience Score */}
        <div
          className={`inline-block px-4 py-2 rounded-lg text-white text-sm mb-10 ml-4 ${resilience.color}`}
        >
          <span className="font-semibold">{resilience.label}</span>
          <span className="ml-2 opacity-80">
            (Resilience: {resilience.score.toFixed(0)}%)
          </span>
        </div>
        {/* Rhythm Index */}
        <div
          className={`inline-block px-4 py-2 rounded-lg text-white text-sm mb-10 ml-4 ${rhythm.color}`}
        >
          <span className="font-semibold">{rhythm.label}</span>
          <span className="ml-2 opacity-80">
            (Rhythm: {rhythm.score.toFixed(0)}%)
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
        {/* XP Consistency Bands (AI Classification) */}
        <h2 className="text-xl font-semibold mb-3">XP Consistency Bands</h2>
        <div className="bg-white p-4 rounded-lg shadow mb-10">
          <div className="flex gap-2">
            <div
              className="flex-1 h-4 bg-green-500 rounded"
              title="High Consistency"
            ></div>
            <div
              className="flex-1 h-4 bg-blue-500 rounded"
              title="Moderate Consistency"
            ></div>
            <div
              className="flex-1 h-4 bg-yellow-500 rounded"
              title="Low Consistency"
            ></div>
            <div
              className="flex-1 h-4 bg-red-600 rounded"
              title="Very Low Consistency"
            ></div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Visual classification of user's XP stability bands.
          </p>
        </div>
        {/* ADMIN XP ADJUSTMENT PANEL */}
        <h2 className="text-xl font-semibold mb-3">Admin XP Adjustment</h2>
        <div className="bg-white p-4 rounded-lg shadow mb-10">
          <div className="flex gap-4">
            <input
              type="number"
              placeholder="XP amount"
              id="admin-xp-amount"
              className="border p-2 rounded w-40"
            />
            <input
              type="text"
              placeholder="Reason"
              id="admin-xp-reason"
              className="border p-2 rounded flex-1"
            />
          </div>

          <div className="flex gap-3 mt-4">
            <button
              className="px-4 py-2 bg-green-600 text-white rounded"
              onClick={async () => {
                const amount = document.getElementById("admin-xp-amount").value;
                const reason = document.getElementById("admin-xp-reason").value;

                const res = await fetch("/api/admin/xp-adjust", {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: id,
                    amount: parseInt(amount),
                    reason,
                  }),
                });

                const data = await res.json();
                if (data.ok) {
                  alert("XP added!");
                  loadUser();
                }
              }}
            >
              Add XP
            </button>

            <button
              className="px-4 py-2 bg-red-600 text-white rounded"
              onClick={async () => {
                const amount = document.getElementById("admin-xp-amount").value;
                const reason = document.getElementById("admin-xp-reason").value;

                const res = await fetch("/api/admin/xp-adjust", {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: id,
                    amount: parseInt(amount) * -1,
                    reason,
                  }),
                });

                const data = await res.json();
                if (data.ok) {
                  alert("XP removed!");
                  loadUser();
                }
              }}
            ></button>
          </div>
        </div>
        {/* END OF XP Consistency Bands block */}
        {/* Consistency Trendline (Past 30 Days) */}
        <h2 className="text-xl font-semibold mb-3">
          Consistency Trend (30 Days)
        </h2>
        <div
          className="bg-white p-4 rounded-lg shadow mb-10"
          style={{ height: 250 }}
        >
          {consistencyTrend.length === 0 ? (
            <p className="text-sm text-gray-500">
              Not enough XP activity to compute consistency trend.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={consistencyTrend}>
                <CartesianGrid strokeDasharray="4 4" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#6366f1"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
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
