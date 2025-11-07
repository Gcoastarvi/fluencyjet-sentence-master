// server/routes/progress.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();
const prisma = new PrismaClient();

/* ------------------------------- time helpers ------------------------------ */
// Monday 00:00:00 UTC (start of current ISO week)
function weekStartUTC(d = new Date()) {
  const dt = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const diff = (dt.getUTCDay() + 6) % 7; // Monday -> 0
  dt.setUTCDate(dt.getUTCDate() - diff);
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
}
// Month 1st 00:00:00 UTC
function monthStartUTC(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

/* ------------------------- small helpers reused below ---------------------- */
function parseAmount(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  return Math.max(-100000, Math.min(100000, Math.trunc(n)));
}

const DB_EVENT_TYPES = new Set([
  "quiz",
  "streak",
  "bonus",
  "admin",
  "QUESTION_CORRECT",
  "QUIZ_COMPLETED",
  "LESSON_COMPLETED",
  "DAILY_STREAK",
  "BADGE_UNLOCK",
  "ADMIN_ADJUST",
  "GENERIC",
]);

const EVENT_ALIASES = new Map([
  ["generic", "GENERIC"],
  ["default", "GENERIC"],
  ["other", "GENERIC"],

  ["question_correct", "QUESTION_CORRECT"],
  ["question-correct", "QUESTION_CORRECT"],
  ["question correct", "QUESTION_CORRECT"],

  ["quiz_completed", "QUIZ_COMPLETED"],
  ["quiz-completed", "QUIZ_COMPLETED"],
  ["quiz completed", "QUIZ_COMPLETED"],

  ["lesson_completed", "LESSON_COMPLETED"],
  ["lesson-completed", "LESSON_COMPLETED"],
  ["lesson completed", "LESSON_COMPLETED"],

  ["daily_streak", "DAILY_STREAK"],
  ["daily-streak", "DAILY_STREAK"],
  ["daily streak", "DAILY_STREAK"],

  ["badge_unlock", "BADGE_UNLOCK"],
  ["badge-unlock", "BADGE_UNLOCK"],
  ["badge unlock", "BADGE_UNLOCK"],

  ["admin_adjust", "ADMIN_ADJUST"],
  ["admin-adjust", "ADMIN_ADJUST"],
  ["admin adjust", "ADMIN_ADJUST"],

  ["quiz", "quiz"],
  ["streak", "streak"],
  ["bonus", "bonus"],
  ["admin", "admin"],
]);

const toKey = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\s-]+/g, "_");

function normalizeEventType(input) {
  const alias = EVENT_ALIASES.get(toKey(input));
  if (alias && DB_EVENT_TYPES.has(alias)) return alias;

  const exact = String(input || "");
  if (DB_EVENT_TYPES.has(exact)) return exact;

  const upper = exact.trim().toUpperCase();
  if (DB_EVENT_TYPES.has(upper)) return upper;

  return "GENERIC";
}

/**
 * Ensure a UserProgress row exists (do NOT set week/month keys on create;
 * your DB defaults fill them). Optionally roll week/month if keys are stale.
 */
async function ensureProgressWithRollovers(tx, userId) {
  const wkNow = weekStartUTC();
  const mkNow = monthStartUTC();

  let progress = await tx.userProgress.findUnique({
    where: { user_id: userId },
  });

  if (!progress) {
    progress = await tx.userProgress.create({
      data: {
        user_id: userId,
        // DB defaults supply week_key & month_key
        week_xp: 0,
        month_xp: 0,
        lifetime_xp: 0,
        total_xp: 0,
        badges_awarded: 0,
        last_activity: new Date(),
      },
    });
  }

  // Rollovers: if stored keys mismatch current UTC week/month → reset bucket(s)
  const updates = {};
  if (
    !progress.week_key ||
    weekStartUTC(progress.week_key).getTime() !== wkNow.getTime()
  ) {
    updates.week_key = wkNow;
    updates.week_xp = 0;
  }
  if (
    !progress.month_key ||
    monthStartUTC(progress.month_key).getTime() !== mkNow.getTime()
  ) {
    updates.month_key = mkNow;
    updates.month_xp = 0;
  }

  if (Object.keys(updates).length) {
    progress = await tx.userProgress.update({
      where: { user_id: userId },
      data: {
        ...(updates.week_key ? { week_key: updates.week_key } : {}),
        ...(updates.month_key ? { month_key: updates.month_key } : {}),
        ...(updates.week_xp !== undefined ? { week_xp: updates.week_xp } : {}),
        ...(updates.month_xp !== undefined
          ? { month_xp: updates.month_xp }
          : {}),
        last_activity: new Date(),
      },
    });
  }

  return progress;
}

/* ---------------------------------- routes --------------------------------- */
/**
 * 🧠 GET /api/progress/me
 * Returns current progress (with rollover applied) + top weekly leaderboard (10).
 */
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const wk = weekStartUTC();

    const { progress, weeklyTop } = await prisma.$transaction(async (tx) => {
      const p = await ensureProgressWithRollovers(tx, userId);

      const top = await tx.userWeeklyTotals.findMany({
        where: { week_key: wk },
        orderBy: { week_xp: "desc" },
        take: 10,
        select: { user_id: true, week_xp: true, updated_at: true },
      });

      return { progress: p, weeklyTop: top };
    });

    return res.json({ ok: true, progress, weeklyTop });
  } catch (err) {
    console.error("❌ /api/progress/me error:", err);
    return res.status(500).json({
      ok: false,
      message: "Could not load progress data",
      error: String(err?.message || err),
    });
  }
});

/**
 * 📊 GET /api/progress/summary
 * Returns: progress (after rollover), user's weekly totals row, badges, last 10 events, top 10 weekly.
 */
router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const wk = weekStartUTC();

    const data = await prisma.$transaction(async (tx) => {
      const p = await ensureProgressWithRollovers(tx, userId);

      // make sure the weekly totals row exists, but don't create if you don't want to
      const weekly = await tx.userWeeklyTotals.upsert({
        where: { user_id: userId },
        update: {},
        create: {
          user_id: userId,
          week_key: wk,
          month_key: monthStartUTC(),
          week_xp: 0,
          month_xp: 0,
        },
        select: {
          user_id: true,
          week_key: true,
          week_xp: true,
          month_key: true,
          month_xp: true,
          updated_at: true,
        },
      });

      const badges = await tx.userBadge.findMany({
        where: { user_id: userId },
        orderBy: { awarded_at: "desc" },
        take: 50,
        select: {
          awarded_at: true,
          badge: { select: { code: true, name: true, threshold: true } },
        },
      });

      const events = await tx.xpEvent.findMany({
        where: { user_id: userId },
        orderBy: { created_at: "desc" },
        take: 10,
        select: {
          id: true,
          event_type: true,
          xp_delta: true,
          meta: true,
          created_at: true,
        },
      });

      const top = await tx.userWeeklyTotals.findMany({
        where: { week_key: wk },
        orderBy: { week_xp: "desc" },
        take: 10,
        select: { user_id: true, week_xp: true, updated_at: true },
      });

      return { progress: p, weekly, badges, events, weeklyTop: top };
    });

    return res.json({ ok: true, ...data });
  } catch (err) {
    console.error("❌ /api/progress/summary error:", err);
    return res.status(500).json({
      ok: false,
      message: "Could not load progress summary",
      error: String(err?.message || err),
    });
  }
});

/**
 * 🧾 GET /api/progress/history?limit=20
 * Recent XP events for the user.
 */
router.get("/history", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.max(
      1,
      Math.min(100, parseInt(req.query.limit || "20", 10)),
    );

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
      error: String(err?.message || err),
    });
  }
});

/**
 * 💾 POST /api/progress/save
 * Thin wrapper around the XP logic (same as POST /api/xp/award).
 * Body: { amount: number, event?: string, meta?: object }
 */
router.post("/save", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const amount = parseAmount(req.body?.amount);
    if (amount === null || amount === 0) {
      return res
        .status(400)
        .json({ ok: false, message: "amount must be a non-zero number" });
    }
    const eventType = normalizeEventType(req.body?.event || "GENERIC");
    const meta = req.body?.meta ?? undefined;

    const wk = weekStartUTC();
    const mk = monthStartUTC();

    const result = await prisma.$transaction(async (tx) => {
      // ensure progress and roll if needed
      await ensureProgressWithRollovers(tx, userId);

      // write event
      const ev = await tx.xpEvent.create({
        data: {
          user_id: userId,
          event_type: eventType,
          xp_delta: amount,
          meta,
        },
      });

      // weekly aggregates
      await tx.userWeeklyTotals.upsert({
        where: { user_id: userId },
        update: {
          week_key: wk,
          month_key: mk,
          week_xp: { increment: amount },
          month_xp: { increment: amount },
          updated_at: new Date(),
        },
        create: {
          user_id: userId,
          week_key: wk,
          month_key: mk,
          week_xp: amount,
          month_xp: amount,
        },
      });

      // progress aggregates
      const prog = await tx.userProgress.upsert({
        where: { user_id: userId },
        create: {
          user_id: userId,
          // DB defaults for week_key/month_key
          week_xp: amount,
          month_xp: amount,
          lifetime_xp: amount,
          total_xp: amount,
          last_activity: new Date(),
        },
        update: {
          week_xp: { increment: amount },
          month_xp: { increment: amount },
          lifetime_xp: { increment: amount },
          total_xp: { increment: amount },
          last_activity: new Date(),
        },
      });

      return { ev, prog };
    });

    return res.json({
      ok: true,
      message: "Progress saved / XP awarded",
      event: result.ev,
      progress: {
        week_xp: result.prog.week_xp,
        month_xp: result.prog.month_xp,
        lifetime_xp: result.prog.lifetime_xp,
        total_xp: result.prog.total_xp ?? result.prog.lifetime_xp,
        week_key: result.prog.week_key,
        month_key: result.prog.month_key,
        last_activity: result.prog.last_activity,
      },
    });
  } catch (err) {
    console.error("❌ /api/progress/save error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to save progress",
      error: String(err?.message || err),
    });
  }
});

/**
 * ⚠️ POST /api/progress/update (deprecated)
 */
router.post("/update", authMiddleware, (_req, res) => {
  return res.status(410).json({
    ok: false,
    message:
      "Deprecated endpoint. Use POST /api/xp/award or POST /api/progress/save.",
  });
});

export default router;
