import express from "express";
import pool from "../db/index.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// 🧠 Get current progress
router.get("/", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await pool.query(
      "SELECT xp, streak, last_active, badges FROM user_progress WHERE user_id=$1",
      [userId],
    );
    if (result.rows.length === 0) {
      const init = await pool.query(
        "INSERT INTO user_progress (user_id, xp, streak, last_active, badges) VALUES ($1,0,0,NOW(),'{}') RETURNING *",
        [userId],
      );
      return res.json(init.rows[0]);
    }
    res.json(result.rows[0]);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch progress", error: err.message });
  }
});

// 🏆 Update XP and streak
router.post("/update", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { xpEarned } = req.body;
  try {
    const result = await pool.query(
      "SELECT * FROM user_progress WHERE user_id=$1",
      [userId],
    );
    const progress = result.rows[0];
    const today = new Date().toISOString().slice(0, 10);
    let streak = progress.streak;
    let xp = progress.xp + xpEarned;

    // 🔥 streak logic
    const last = progress.last_active
      ? progress.last_active.toISOString().slice(0, 10)
      : null;
    if (last === today)
      streak = progress.streak; // same day → no change
    else {
      const diff = (new Date(today) - new Date(last)) / (1000 * 60 * 60 * 24);
      streak = diff === 1 ? progress.streak + 1 : 1;
    }

    // 🎖 badge logic
    const badges = progress.badges || [];
    if (xp >= 100 && !badges.includes("100XP")) badges.push("100XP");
    if (streak >= 3 && !badges.includes("3DAY")) badges.push("3DAY");

    const update = await pool.query(
      "UPDATE user_progress SET xp=$1, streak=$2, last_active=$3, badges=$4 WHERE user_id=$5 RETURNING *",
      [xp, streak, today, badges, userId],
    );

    res.json(update.rows[0]);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to update progress", error: err.message });
  }
});

export default router;
