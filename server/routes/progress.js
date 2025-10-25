import express from "express";
import pool from "../db/index.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * 🧠  GET /api/progress/me
 * Returns user’s total XP, streak, badges
 */
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT xp, streak, badges, last_active
       FROM user_progress
       WHERE user_id = $1`,
      [req.user.id],
    );

    if (rows.length === 0) {
      return res.json({ xp: 0, streak: 0, badges: [] });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Progress fetch failed:", err.message);
    res
      .status(500)
      .json({ message: "Could not load progress data", error: err.message });
  }
});

/**
 * ⚡ POST /api/progress/update
 * Adds XP + logs the update
 */
router.post("/update", authMiddleware, async (req, res) => {
  const { xpEarned = 0, type = "general", completedQuiz = false } = req.body;
  const userId = req.user.id;

  try {
    // Insert or update user_progress cumulatively
    const upsert = await pool.query(
      `
      INSERT INTO user_progress (user_id, xp, streak, badges, last_active)
      VALUES ($1, $2, 1, '{}', NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        xp = user_progress.xp + EXCLUDED.xp,
        streak = user_progress.streak + 1,
        last_active = NOW()
      RETURNING *;
      `,
      [userId, xpEarned],
    );

    // Log the XP event
    await pool.query(
      `INSERT INTO user_xp_log (user_id, xp, type)
       VALUES ($1, $2, $3)`,
      [userId, xpEarned, type],
    );

    res.json(upsert.rows[0]);
  } catch (err) {
    console.error("❌ XP update failed:", err.message);
    res.status(500).json({ message: "XP update failed", error: err.message });
  }
});

export default router;
