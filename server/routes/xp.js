// server/routes/xp.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/authMiddleware.js";

const prisma = new PrismaClient();
const router = express.Router();

/* ------------------------------ time helpers ------------------------------ */
// Monday 00:00:00 UTC (start of current ISO week)
function weekStartUTC(d = new Date()) {
  const dt = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  // JS: Sunday=0 … Saturday=6; we want Monday=1
  const diff = (dt.getUTCDay() + 6) % 7; // Monday -> 0
  dt.setUTCDate(dt.getUTCDate() - diff);
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
}
// Month 1st 00:00:00 UTC
function monthStartUTC(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

/* ----------------------------- event normalization ----------------------------- */
/**
 * Your DB enum contains these **exact** values:
 *   Lowercase (legacy): 'quiz', 'streak', 'bonus', 'admin'
 *   Uppercase (granular): 'QUESTION_CORRECT', 'QUIZ_COMPLETED', 'LESSON_COMPLETED',
 *                         'DAILY_STREAK', 'BADGE_UNLOCK', 'ADMIN_ADJUST', 'GENERIC'
 */
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

// Friendly aliases → canonical enum value
const EVENT_ALIASES = new Map([
  // generic
  ["generic", "GENERIC"],
  ["default", "GENERIC"],
  ["other", "GENERIC"],

  // granular (snake, hyphen, space)
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

  // legacy lowercase passthroughs
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
    .replace(/[\s-]+/g, "_"); // spaces/hyphens → underscores

function normalizeEventType(input) {
  const key = EVENT_ALIASES.get(toKey(input));
  if (key && DB_EVENT_TYPES.has(key)) return key;

  const exact = String(input || "");
  if (DB_EVENT_TYPES.has(exact)) return exact;

  const upper = exact.trim().toUpperCase();
  if (DB_EVENT_TYPES.has(upper)) return upper;

  return "GENERIC";
}

/* ----------------------------- input validation ---------------------------- */
function parseAmount(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  // guardrails
  return Math.max(-100000, Math.min(100000, Math.trunc(n)));
}

/* ----------------------------- internal helpers ---------------------------- */
/**
 * Ensures a UserProgress row exists for a user. We DO NOT set week/month keys
 * on create; your DB defaults populate them.
 */
async function ensureProgress(tx, userId) {
  let p = await tx.userProgress.findUnique({ where: { user_id: userId } });
  if (!p) {
    p = await tx.userProgress.create({
      data: {
        user_id: userId,
        // week_key/month_key default in DB; don't set them here
        week_xp: 0,
        month_xp: 0,
        lifetime_xp: 0,
        total_xp: 0,
        badges_awarded: 0,
        last_activity: new Date(),
      },
    });
  }
  return p;
}

/**
 * Writes an XP event and updates aggregates in one transaction.
 * Updates:
 *   - XpEvent (append)
 *   - UserWeeklyTotals (upsert + increment week/month)
 *   - UserProgress (upsert + increment week/month/lifetime/total)
 */
async function writeXp(tx, userId, amount, eventType, meta) {
  const wk = weekStartUTC();
  const mk = monthStartUTC();

  const event = await tx.xpEvent.create({
    data: { user_id: userId, event_type: eventType, xp_delta: amount, meta },
  });

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

  await tx.userProgress.upsert({
    where: { user_id: userId },
    create: {
      user_id: userId,
      // let DB set week_key/month_key
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

  return event;
}

/* --------------------------------- endpoints -------------------------------- */

/**
 * GET /api/xp/balance
 * Returns the user's current XP counters.
 */
router.get("/balance", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // ensure a progress row so first-time users don't 404
    const progress = await prisma.$transaction(async (tx) => {
      await ensureProgress(tx, userId);
      return tx.userProgress.findUnique({ where: { user_id: userId } });
    });

    return res.json({
      ok: true,
      balance: {
        week_xp: progress.week_xp,
        month_xp: progress.month_xp,
        lifetime_xp: progress.lifetime_xp,
        total_xp: progress.total_xp ?? progress.lifetime_xp,
        week_key: progress.week_key,
        month_key: progress.month_key,
        last_activity: progress.last_activity,
      },
    });
  } catch (err) {
    console.error("xp/balance error:", err);
    return res
      .status(500)
      .json({
        ok: false,
        message: "Failed to load XP balance",
        error: String(err?.message || err),
      });
  }
});

/**
 * POST /api/xp/award
 * Body: { amount: number, event?: string, meta?: object }
 */
router.post("/award", authMiddleware, async (req, res) => {
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

    const result = await prisma.$transaction(async (tx) => {
      await ensureProgress(tx, userId);
      const ev = await writeXp(tx, userId, amount, eventType, meta);
      const prog = await tx.userProgress.findUnique({
        where: { user_id: userId },
      });
      return { ev, prog };
    });

    return res.json({
      ok: true,
      message: "XP awarded",
      event: result.ev,
      balance: {
        week_xp: result.prog.week_xp,
        month_xp: result.prog.month_xp,
        lifetime_xp: result.prog.lifetime_xp,
        total_xp: result.prog.total_xp ?? result.prog.lifetime_xp,
      },
    });
  } catch (err) {
    console.error("xp/award error:", err);
    return res
      .status(500)
      .json({
        ok: false,
        message: "Failed to award XP",
        error: String(err?.message || err),
      });
  }
});

/**
 * POST /api/xp/add
 * Body: { amount: number, reason?: string, meta?: object }
 * Admin-style adjust; default event = ADMIN_ADJUST (can be negative).
 */
router.post("/add", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const amount = parseAmount(req.body?.amount);
    if (amount === null || amount === 0) {
      return res
        .status(400)
        .json({ ok: false, message: "amount must be a non-zero number" });
    }
    const eventType = normalizeEventType(req.body?.reason || "ADMIN_ADJUST");
    const meta = req.body?.meta ?? undefined;

    const result = await prisma.$transaction(async (tx) => {
      await ensureProgress(tx, userId);
      await writeXp(tx, userId, amount, eventType, meta);
      return tx.userProgress.findUnique({ where: { user_id: userId } });
    });

    return res.json({
      ok: true,
      balance: {
        week_xp: result.week_xp,
        month_xp: result.month_xp,
        lifetime_xp: result.lifetime_xp,
        total_xp: result.total_xp ?? result.lifetime_xp,
      },
    });
  } catch (err) {
    console.error("xp/add error:", err);
    return res
      .status(500)
      .json({
        ok: false,
        message: "Failed to add XP",
        error: String(err?.message || err),
      });
  }
});

/**
 * POST /api/xp/log   (compat layer for your existing tests)
 * Body: { event_type: string, xp_delta: number, meta?: object }
 * Internally delegates to the same logic as /award.
 */
router.post("/log", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const xpValue = parseAmount(req.body?.xp_delta);
    if (xpValue === null || xpValue === 0) {
      return res
        .status(400)
        .json({ ok: false, message: "xp_delta must be a non-zero number" });
    }
    const eventType = normalizeEventType(req.body?.event_type || "GENERIC");
    const meta = req.body?.meta ?? undefined;

    const result = await prisma.$transaction(async (tx) => {
      await ensureProgress(tx, userId);
      const ev = await writeXp(tx, userId, xpValue, eventType, meta);
      const prog = await tx.userProgress.findUnique({
        where: { user_id: userId },
      });
      return { ev, prog };
    });

    return res.json({
      ok: true,
      message: "XP logged successfully",
      event: result.ev,
      balance: {
        week_xp: result.prog.week_xp,
        month_xp: result.prog.month_xp,
        lifetime_xp: result.prog.lifetime_xp,
        total_xp: result.prog.total_xp ?? result.prog.lifetime_xp,
      },
    });
  } catch (err) {
    console.error("xp/log error:", err);
    return res
      .status(500)
      .json({
        ok: false,
        message: "Failed to log XP",
        error: String(err?.message || err),
      });
  }
});

/**
 * GET /api/xp/events?limit=50
 * Quick inspector for recent events of the authenticated user.
 */
router.get("/events", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
    const items = await prisma.xpEvent.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: limit,
    });
    res.json({ ok: true, events: items });
  } catch (err) {
    console.error("xp/events error:", err);
    res
      .status(500)
      .json({
        ok: false,
        message: "Failed to load events",
        error: String(err?.message || err),
      });
  }
});

export default router;
