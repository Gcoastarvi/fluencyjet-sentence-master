// server/routes/progress.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();
const prisma = new PrismaClient();

/* ------------------------------- TIME HELPERS ------------------------------ */
function weekStartUTC(d = new Date()) {
  const dt = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const diff = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - diff);
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
}
function monthStartUTC(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

/* ------------------------------ HELPERS ----------------------------------- */
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
  ["lesson_completed", "LESSON_COMPLETED"],
  ["quiz_completed", "QUIZ_COMPLETED"],
  ["daily_streak", "DAILY_STREAK"],
]);
function normalizeEventType(input) {
  const alias = EVENT_ALIASES.get(String(input || "").toLowerCase());
  if (alias && DB_EVENT_TYPES.has(alias)) return alias;
  const upper = String(input || "")
    .trim()
    .toUpperCase();
  if (DB_EVENT_TYPES.has(upper)) return upper;
  return "GENERIC";
}

async function ensureProgress(tx, userId) {
  let p = await tx.userProgress.findUnique({ where: { user_id: userId } });
  if (!p) {
    p = await tx.userProgress.create({
      data: { user_id: userId, total_xp: 0, last_activity: new Date() },
    });
  }
  return p;
}

/* -------------------------------- ROUTES ---------------------------------- */

// 🧠 GET /api/progress/me
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const wk = weekStartUTC();
    const mk = monthStartUTC();

    const progress = await prisma.userProgress.upsert({
      where: { user_id: userId },
      update: { last_activity: new Date() },
      create: { user_id: userId, total_xp: 0, last_activity: new Date() },
    });

    const weeklyTop = await prisma.userWeeklyTotals.findMany({
      where: { week_key: wk },
      orderBy: { week_xp: "desc" },
      take: 10,
      select: { user_id: true, week_xp: true },
    });

    res.json({ ok: true, progress, weeklyTop });
  } catch (err) {
    console.error("❌ /progress/me error:", err);
    res
      .status(500)
      .json({
        ok: false,
        message: "Failed to load progress",
        error: String(err?.message || err),
      });
  }
});

// 📊 GET /api/progress/summary
router.get("/summary", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const wk = weekStartUTC();

    const result = await prisma.$transaction(async (tx) => {
      const progress = await ensureProgress(tx, userId);

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
        select: { week_xp: true, month_xp: true, updated_at: true },
      });

      const badges = await tx.userBadge.findMany({
        where: { user_id: userId },
        orderBy: { awarded_at: "desc" },
        take: 10,
        select: {
          badge: { select: { code: true, name: true } },
          awarded_at: true,
        },
      });

      const events = await tx.xpEvent.findMany({
        where: { user_id: userId },
        orderBy: { created_at: "desc" },
        take: 10,
        select: { event_type: true, xp_delta: true, created_at: true },
      });

      const weeklyTop = await tx.userWeeklyTotals.findMany({
        where: { week_key: wk },
        orderBy: { week_xp: "desc" },
        take: 10,
        select: { user_id: true, week_xp: true },
      });

      return { progress, weekly, badges, events, weeklyTop };
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("❌ /progress/summary error:", err);
    res
      .status(500)
      .json({
        ok: false,
        message: "Failed to load summary",
        error: String(err?.message || err),
      });
  }
});

// 💾 POST /api/progress/save
router.post("/save", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const amount = parseAmount(req.body?.amount);
    if (amount === null || amount === 0)
      return res
        .status(400)
        .json({ ok: false, message: "amount must be a non-zero number" });

    const eventType = normalizeEventType(req.body?.event);
    const meta = req.body?.meta ?? {};
    const wk = weekStartUTC();
    const mk = monthStartUTC();

    const { ev, prog } = await prisma.$transaction(async (tx) => {
      await ensureProgress(tx, userId);
      const ev = await tx.xpEvent.create({
        data: {
          user_id: userId,
          event_type: eventType,
          xp_delta: amount,
          meta,
        },
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
      const prog = await tx.userProgress.upsert({
        where: { user_id: userId },
        create: {
          user_id: userId,
          total_xp: amount,
          last_activity: new Date(),
        },
        update: { total_xp: { increment: amount }, last_activity: new Date() },
      });
      return { ev, prog };
    });

    res.json({
      ok: true,
      message: "Progress saved / XP awarded",
      event: ev,
      progress: { total_xp: prog.total_xp, last_activity: prog.last_activity },
    });
  } catch (err) {
    console.error("❌ /progress/save error:", err);
    res
      .status(500)
      .json({
        ok: false,
        message: "Failed to save progress",
        error: String(err?.message || err),
      });
  }
});

export default router;
