// server/routes/progress.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();
const prisma = new PrismaClient();

/* ----------------------------- time helpers ----------------------------- */
function weekKeyUTC(d = new Date()) {
  const dt = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const day = dt.getUTCDay();
  const diff = (day + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - diff);
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
}
function monthKeyUTC(d = new Date()) {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
}

/**
 * 🧠 GET /api/progress/me
 */
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const wk = weekKeyUTC();
    const mk = monthKeyUTC();

    let progress = await prisma.userProgress.findUnique({
      where: { user_id: userId },
    });
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

    const updates = {};
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
        data: {
          ...(updates.week_key ? { week_key: new Date(updates.week_key) } : {}),
          ...(updates.month_key ? { month_key: new Date(updates.month_key) } : {}),
          ...(updates.week_xp !== undefined ? { week_xp: updates.week_xp } : {}),
          ...(updates.month_xp !== undefined ? { month_xp: updates.month_xp } : {}),
        },
      });
    }

    const weeklyTop = await prisma.userWeeklyTotals.findMany({
      where: { week_key: wk },
      orderBy: { week_xp: "desc" },
      take: 10,
      select: { user_id: true, week_xp: true, updated_at: true },
    });

    return res.json({ ok: true, progress, weeklyTop });
  } catch (err) {
    console.error("❌ /api/progress/me error:", err);
    return res.status(500).json({
      ok: false,
      message: "Could not load progress data",
      error: err.message,
    });
  }
});

/**
 * 🧾 GET /api/progress/history
 * Returns last N XP events (default 20)
 */
router.get("/history", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);

    const events = await prisma.xpEvent.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: limit,
      select: {
        id: true,
        event_type: true,
        xp_delta: true,
        created_at: true,
        meta: true,
      },
    });

    return res.json({ ok: true, count: events.length, events });
  } catch (err) {
    console.error("❌ /api/progress/history error:", err);
    res.status(500).json({
      ok: false,
      message: "Could not load XP history",
      error: err.message,
    });
  }
});

/**
 * ⚠️ POST /api/progress/update (deprecated)
 */
router.post("/update", authMiddleware, (_req, res) => {
  return res.status(410).json({
    ok: false,
    message: "Deprecated endpoint. Use POST /api/xp/log instead.",
  });
});

export default router;
