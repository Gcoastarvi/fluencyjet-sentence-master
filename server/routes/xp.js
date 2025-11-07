// server/routes/xp.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/authMiddleware.js";

const prisma = new PrismaClient();
const router = express.Router();

/* ----------------------------- TIME HELPERS ----------------------------- */
function weekStartUTC(d = new Date()) {
  const dt = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const diff = (dt.getUTCDay() + 6) % 7; // Monday start
  dt.setUTCDate(dt.getUTCDate() - diff);
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
}
function monthStartUTC(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

/* ----------------------------- NORMALIZATION ---------------------------- */
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

function toKey(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}
function normalizeEventType(input) {
  const alias = EVENT_ALIASES.get(toKey(input));
  if (alias && DB_EVENT_TYPES.has(alias)) return alias;
  const upper = String(input || "")
    .trim()
    .toUpperCase();
  if (DB_EVENT_TYPES.has(upper)) return upper;
  return "GENERIC";
}
function parseAmount(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  return Math.max(-100000, Math.min(100000, Math.trunc(n)));
}

/* ----------------------------- SAFE HELPERS ----------------------------- */
async function ensureProgress(tx, userId) {
  let p = await tx.userProgress.findUnique({ where: { user_id: userId } });
  if (!p) {
    p = await tx.userProgress.create({
      data: {
        user_id: userId,
        total_xp: 0,
        last_activity: new Date(),
      },
    });
  }
  return p;
}

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
      total_xp: amount,
      last_activity: new Date(),
    },
    update: {
      total_xp: { increment: amount },
      last_activity: new Date(),
    },
  });

  return event;
}

/* ----------------------------- ROUTES ----------------------------- */

// 🧾 GET /api/xp/balance
router.get("/balance", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

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

    const lifetimeAgg = await prisma.xpEvent.aggregate({
      _sum: { xp_delta: true },
      where: { user_id: userId },
    });

    res.json({
      ok: true,
      balance: {
        week_xp: totals?.week_xp ?? 0,
        month_xp: totals?.month_xp ?? 0,
        lifetime_xp: lifetimeAgg._sum.xp_delta || 0,
        week_key: totals?.week_key ?? weekStartUTC(),
        month_key: totals?.month_key ?? monthStartUTC(),
      },
    });
  } catch (err) {
    console.error("❌ xp/balance error:", err);
    res.status(500).json({
      ok: false,
      message: "Failed to load XP balance",
      error: String(err?.message || err),
    });
  }
});

// 🧠 POST /api/xp/award
router.post("/award", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const amount = parseAmount(req.body?.amount);
    if (amount === null || amount === 0)
      return res
        .status(400)
        .json({ ok: false, message: "amount must be a non-zero number" });

    const eventType = normalizeEventType(req.body?.event);
    const meta = req.body?.meta ?? {};

    const { event, progress } = await prisma.$transaction(async (tx) => {
      await ensureProgress(tx, userId);
      const ev = await writeXp(tx, userId, amount, eventType, meta);
      const prog = await tx.userProgress.findUnique({
        where: { user_id: userId },
      });
      return { event: ev, progress: prog };
    });

    res.json({
      ok: true,
      message: "XP awarded successfully",
      event,
      balance: {
        total_xp: progress.total_xp,
      },
    });
  } catch (err) {
    console.error("❌ xp/award error:", err);
    res.status(500).json({
      ok: false,
      message: "Failed to award XP",
      error: String(err?.message || err),
    });
  }
});

// 🧱 POST /api/xp/log (alias)
router.post("/log", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const xpValue = parseAmount(req.body?.xp_delta);
    if (xpValue === null || xpValue === 0)
      return res
        .status(400)
        .json({ ok: false, message: "xp_delta must be a non-zero number" });

    const eventType = normalizeEventType(req.body?.event_type);
    const meta = req.body?.meta ?? {};

    const { event, progress } = await prisma.$transaction(async (tx) => {
      await ensureProgress(tx, userId);
      const ev = await writeXp(tx, userId, xpValue, eventType, meta);
      const prog = await tx.userProgress.findUnique({
        where: { user_id: userId },
      });
      return { event: ev, progress: prog };
    });

    res.json({
      ok: true,
      message: "XP logged",
      event,
      balance: { total_xp: progress.total_xp },
    });
  } catch (err) {
    console.error("❌ xp/log error:", err);
    res.status(500).json({
      ok: false,
      message: "Failed to log XP",
      error: String(err?.message || err),
    });
  }
});

// 📜 GET /api/xp/events
router.get("/events", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
    const events = await prisma.xpEvent.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: limit,
    });
    res.json({ ok: true, events });
  } catch (err) {
    console.error("❌ xp/events error:", err);
    res.status(500).json({
      ok: false,
      message: "Failed to load events",
      error: String(err?.message || err),
    });
  }
});

export default router;
