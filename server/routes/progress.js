// ...top imports unchanged
router.post("/update", authMiddleware, async (req, res) => {
  try {
    const { id } = req.user;
    const {
      xpEarned, // optional override
      type, // "typing" | "dragdrop" | "cloze" | "bonus"
      completedQuiz, // bool → +300 if true
      dailyBonus, // bool → +200 if true
    } = req.body;

    // base by type
    let baseXP = 100;
    if (type === "typing") baseXP = 150;
    if (type === "dragdrop") baseXP = 100;
    if (type === "cloze") baseXP = 80;

    let award = typeof xpEarned === "number" ? xpEarned : baseXP;
    if (completedQuiz) award += 300;
    if (dailyBonus) award += 200;

    // get current progress
    const { rows } = await pool.query(
      "SELECT xp, streak, last_active, badges FROM user_progress WHERE user_id=$1",
      [id],
    );

    const today = new Date().toISOString().split("T")[0];
    let xp = 0,
      streak = 0,
      badges = [];

    if (rows.length) {
      ({ xp, streak, badges } = rows[0]);
      const lastActive = rows[0].last_active
        ? new Date(rows[0].last_active)
        : null;
      if (lastActive) {
        const diff = (new Date(today) - lastActive) / (1000 * 3600 * 24);
        if (diff === 1) streak += 1;
        else if (diff > 1) streak = 1;
      } else {
        streak = 1;
      }
    } else {
      // create a row if missing
      streak = 1;
      badges = [];
    }

    xp += award;

    // badges (scaled for larger numbers)
    if (xp >= 1000 && !badges.includes("Rising Star"))
      badges.push("Rising Star");
    if (streak >= 3 && !badges.includes("3-Day Streak"))
      badges.push("3-Day Streak");
    if (streak >= 7 && !badges.includes("Weekly Winner"))
      badges.push("Weekly Winner");
    if (xp >= 10000 && !badges.includes("XP Master")) badges.push("XP Master");

    // upsert progress
    const updated = await pool.query(
      `INSERT INTO user_progress (user_id, xp, streak, last_active, badges)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id)
       DO UPDATE SET xp=$2, streak=$3, last_active=$4, badges=$5
       RETURNING *`,
      [id, xp, streak, today, badges],
    );

    // log the event for leaderboards
    await pool.query(
      "INSERT INTO user_xp_log (user_id, xp, source) VALUES ($1,$2,$3)",
      [id, award, type || "bonus"],
    );

    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "XP update failed", error: err.message });
  }
});
