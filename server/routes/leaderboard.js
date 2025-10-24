// server/routes/leaderboard.js
import express from "express";
import pool from "../db/index.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// 🧩 Utility: date range helpers
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// 📊 Query top XP earners since a given date
async function topSince(sinceISO, limit = 20) {
  const { rows } = await pool.query(
    `
    SELECT u.id AS user_id, u.email, COALESCE(SUM(l.xp), 0)::int AS total_xp
    FROM user_xp_log l
    JOIN users u ON u.id = l.user_id
    WHERE l.created_at >= $1
    GROUP BY u.id, u.email
    ORDER BY total_xp DESC
    LIMIT $2
    `,
    [sinceISO, limit],
  );
  return rows;
}

// 🏆 Weekly Leaderboard
router.get("/weekly", authMiddleware, async (req, res) => {
  try {
    const since = daysAgo(7);
    const top = await topSince(since, 50);
    res.json({ since, period: "weekly", top });
  } catch (e) {
    console.error("❌ Weekly leaderboard error:", e);
    res.status(500).json({ message: "Failed to load weekly leaderboard" });
  }
});

// 🕐 Daily Leaderboard
router.get("/daily", authMiddleware, async (req, res) => {
  try {
    const since = daysAgo(1);
    const top = await topSince(since, 50);
    res.json({ since, period: "daily", top });
  } catch (e) {
    console.error("❌ Daily leaderboard error:", e);
    res.status(500).json({ message: "Failed to load daily leaderboard" });
  }
});

// 📅 Monthly Leaderboard
router.get("/monthly", authMiddleware, async (req, res) => {
  try {
    const since = daysAgo(30);
    const top = await topSince(since, 50);
    res.json({ since, period: "monthly", top });
  } catch (e) {
    console.error("❌ Monthly leaderboard error:", e);
    res.status(500).json({ message: "Failed to load monthly leaderboard" });
  }
});

export default router;
