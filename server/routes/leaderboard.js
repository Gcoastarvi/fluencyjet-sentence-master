import express from "express";
import pool from "../db/index.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// Utility: date range helpers
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// Format: returns [{ user_id, email, total_xp }]
async function topSince(sinceISO, limit = 20) {
  const { rows } = await pool.query(
    `
    SELECT u.id as user_id, u.email, SUM(l.xp)::int AS total_xp
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

// Weekly leaderboard (last 7 days)
router.get("/weekly", authMiddleware, async (req, res) => {
  try {
    const since = daysAgo(7);
    const top = await topSince(since, 50);
    res.json({ since, period: "weekly", top });
  } catch (e) {
    res.status(500).json({ message: "Failed to load weekly leaderboard" });
  }
});

// Daily and Monthly if you want quickly:
router.get("/daily", authMiddleware, async (req, res) => {
  try {
    const since = daysAgo(1);
    const top = await topSince(since, 50);
    res.json({ since, period: "daily", top });
  } catch (e) {
    res.status(500).json({ message: "Failed to load daily leaderboard" });
  }
});

router.get("/monthly", authMiddleware, async (req, res) => {
  try {
    const since = daysAgo(30);
    const top = await topSince(since, 50);
    res.json({ since, period: "monthly", top });
  } catch (e) {
    res.status(500).json({ message: "Failed to load monthly leaderboard" });
  }
});

export default router;
