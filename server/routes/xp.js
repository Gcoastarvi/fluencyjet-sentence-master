// server/routes/xp.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/authMiddleware.js";

const prisma = new PrismaClient();
const router = express.Router();

/* ------------------------------ time helpers ------------------------------ */
// Monday 00:00:00 UTC (start of current ISO week)
function weekStartUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  // JS: Sunday=0 … Saturday=6; we want Monday start
  const diff = (d.getUTCDay() + 6) % 7; // Monday -> 0
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}
// Month 1st 00:00:00 UTC
function monthStartUTC() {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1, 0, 0, 0, 0));
}

/* ----------------------------- event normalization ----------------------------- */
/**
 * Your DB enum now contains these **exact** values:
 *   Lowercase (legacy): 'quiz', 'streak', 'bonus', 'admin'
 *   Uppercase (granular): 'QUESTION_CORRECT', 'QUIZ_COMPLETED', 'LESSON_COMPLETED',
 *                         'DAILY_STREAK', 'BADGE_UNLOCK', 'ADMIN_ADJUST', 'GENERIC'
 *
 * We accept friendly inputs (any case) and normalize to the DB-safe value.
 */

// The exact strings that exist in the DB enum
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

// Common aliases → canonical enum value
const EVENT_ALIASES = new Map([
  // generic forms
  ["generic", "GENERIC"],
  ["default", "GENERIC"],
  ["other", "GENERIC"],

  // granular (uppercase) – allow snake & space & hyphen variations
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

  // legacy lowercase types map to themselves (keep dashboards stable)
  ["quiz", "quiz"],
  ["streak", "streak"],
  ["bonus", "bonus"],
  ["admin", "admin"],
]);

function toKey(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\s-]+/g, "_"); // normalize spaces/hyphens to underscores
}

function normalizeEventType(input) {
  // Try alias map first
  const key = toKey(input);
  const aliased = EVENT_ALIASES.get(key);
  if (aliased && DB_EVENT_TYPES.has(aliased)) return aliased;

  // If caller already passed an exact DB value, keep it
  if (DB_EVENT_TYPES.has(String(input))) return String(input);

  // If they passed an uppercase-ish granular value, try uppercase directly
  const upper = String(input || "")
    .trim()
    .toUpperCase();
  if (DB_EVENT_TYPES.has(upper)) return upper;

  // Fallback to a safe enum value that definitely exists in DB
  return "GENERIC";
}

/* ----------------------------- input validation ---------------------------- */
function parseXp(x) {
  const n = parseInt(x, 10);
  if (Number.isNaN(n)) return null;
  // guardrails
  return Math.max(-100000, Math.min(100000, n));
}

/* --------------------------------- endpoint -------------------------------- */
/**
 * POST /api/xp/log
 * Body JSON:
 * {
 *   "event_type":  one of:
 *     - legacy: "quiz" | "streak" | "bonus" | "admin"
 *     - granular: "QUESTION_CORRECT" | "QUIZ_COMPLETED" | "LESSON_COMPLETED" |
 *                 "DAILY_STREAK" | "BADGE_UNLOCK" | "ADMIN_ADJUST" | "GENERIC"
 *     - or a friendly alias like "question_correct", "badge-unlock", "generic", etc.
 *   "xp_delta":   number (positive or negative)
 *   "meta":       object (optional)
 * }
 * Auth: Bearer <jwt>
 */
router.post("/log", authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  const xpValue = parseXp(req.body?.xp_delta);
  const eventType = normalizeEventType(req.body?.event_type);
  const meta = req.body?.meta ?? {};

  if (!userId)
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  if (xpValue === null) {
    return res
      .status(400)
      .json({ ok: false, message: "xp_delta must be a number" });
  }

  const weekKey = weekStartUTC();
  const monthKey = monthStartUTC();

  try {
    // 1) Write XP + update aggregates atomically
    const [log] = await prisma.$transaction([
      prisma.xpEvent.create({
        data: {
          user_id: userId,
          event_type: eventType, // exact Prisma enum string
          xp_delta: xpValue,
          meta,
        },
      }),
      prisma.userWeeklyTotals.upsert({
        where: { user_id: userId },
        update: {
          week_key: weekKey,
          month_key: monthKey,
          week_xp: { increment: xpValue },
          month_xp: { increment: xpValue },
          updated_at: new Date(),
        },
        create: {
          user_id: userId,
          week_key: weekKey,
          month_key: monthKey,
          week_xp: xpValue,
          month_xp: xpValue,
        },
      }),
      prisma.userProgress.upsert({
        where: { user_id: userId },
        update: {
          total_xp: { increment: xpValue },
          last_activity: new Date(),
        },
        create: {
          user_id: userId,
          total_xp: xpValue,
          last_activity: new Date(),
        },
      }),
    ]);

    // 2) Lifetime XP from events
    const lifetimeAgg = await prisma.xpEvent.aggregate({
      _sum: { xp_delta: true },
      where: { user_id: userId },
    });
    const lifetimeXp = lifetimeAgg._sum.xp_delta || 0;

    // 3) Badge award (if you’ve seeded Badge table)
    const newlyEarned = await prisma.badge.findMany({
      where: {
        threshold: { lte: lifetimeXp },
        user_badges: { none: { user_id: userId } },
      },
      select: { id: true, code: true },
    });

    if (newlyEarned.length) {
      await prisma.userBadge.createMany({
        data: newlyEarned.map((b) => ({ user_id: userId, badge_id: b.id })),
        skipDuplicates: true,
      });
    }

    // 4) Return fresh totals
    const totals = await prisma.userWeeklyTotals.findUnique({
      where: { user_id: userId },
      select: {
        week_xp: true,
        month_xp: true,
        week_key: true,
        month_key: true,
        updated_at: true,
      },
    });

    return res.json({
      ok: true,
      message: "XP logged successfully",
      event: log,
      totals,
      lifetime_xp: lifetimeXp,
      badges_awarded: newlyEarned.map((b) => b.code),
    });
  } catch (err) {
    console.error("❌ XP log error:", err);
    return res
      .status(500)
      .json({
        ok: false,
        message: "Failed to log XP",
        error: String(err?.message || err),
      });
  }
});

export default router;
