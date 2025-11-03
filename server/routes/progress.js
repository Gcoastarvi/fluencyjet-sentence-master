// server/routes/progress.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();
const prisma = new PrismaClient();

/* ----------------------------- time helpers ----------------------------- */
// Monday 00:00 UTC (matches what /api/xp/log returns)
function weekKeyUTC(d = new Date()) {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = dt.getUTCDay();           // 0..6 Sun..Sat
  const diff = (day + 6) % 7;           // make Monday = 0
  dt.setUTCDate(dt.getUTCDate() - diff);
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
}
// First of month 00:00 UTC
function monthKeyUTC(d = new Date()) {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
}

/**
 * 🧠 GET /api/progress/me
 * Returns the user’s progress. Ensures a row exists and rolls week/month keys forward if stale.
 */
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const wk = weekKeyUTC();
    const mk = monthKeyUTC();

    // Ensure a progress row exists
    let progress = await prisma.userProgress.findUnique({ where: { user_id: userId } });
    if (!progress) {
      progress = await prisma.userProgress.create({
        data: {
          user_id: userId,
          week_key: wk,
          month_key: mk,
          week_xp: 0,
          month_xp: 0,
          lifetime_xp: 0,
          badges_awarded: 0,
        },
      });
    }

    // Roll forward week/month buckets if keys are stale
    const updates: any = {};
    if (!progress.week_key || progress.week_key.getTime() !== wk.getTime()) {
      updates.week_key = wk;
      updates.week_xp = 0;
    }
    if (!progress.month_key || progress.month_key.getTime() !== mk.getTime()) {
      updates.month_key = mk;
      updates.month_xp = 0;
    }
    if (Object.keys(updates).length) {
      progress = await prisma.userProgress.update({
        where: { user_id: userId },
        data: updates,
      });
    }

    // Optional: top-10 snapshot for dashboard
    const weeklyTop = await prisma.userWeeklyTotals.findMany({
      where: { week_key: wk },
      orderBy: { week_xp: "desc" },
      take: 10,
      select: { user_id: true, week_xp: true, updated_at: true },
    });

    return res.json({ ok: true, progress, weeklyTop });
  } catch (err) {
    console.error("❌ /api/progress/me error:", err);
    return res.status(500).json({ ok: false, message: "Could not load progress data", error: err.message });
  }
});

/**
 * ⚠️ POST /api/progress/update  (deprecated)
 * We now use POST /api/xp/log as the single source of truth for XP writes.
 * Keep this route for backward compatibility; it forwards a helpful message.
 */
router.post("/update", authMiddleware, (_req, res) => {
  return res.status(410).json({
    ok: false,
    message: "Deprecated endpoint. Use POST /api/xp/log to record XP events.",
  });
});

export default router;
