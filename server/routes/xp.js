// server/routes/xp.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import authRequired from "../middleware/authMiddleware.js";

const prisma = new PrismaClient();
const router = express.Router();

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
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/* ---------------- EVENT TYPES AND HELPERS ---------------- */

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
  ["question_correct", "QUESTION_CORRECT"],
  ["quiz_completed", "QUIZ_COMPLETED"],
  ["lesson_completed", "LESSON_COMPLETED"],
  ["daily_streak", "DAILY_STREAK"],
  ["badge_unlock", "BADGE_UNLOCK"],
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

/* ---------------- BADGES ---------------- */

const BADGE_THRESHOLDS = [
  {
    code: "BRONZE_1K",
    label: "Bronze Achiever",
    description: "Reached 1,000 XP",
    minXp: 1000,
  },
  {
    code: "SILVER_5K",
    label: "Silver Achiever",
    description: "Reached 5,000 XP",
    minXp: 5000,
  },
  {
    code: "GOLD_10K",
    label: "Gold Achiever",
    description: "Reached 10,000 XP",
    minXp: 10000,
  },
];

async function ensureBadgeCatalog(tx) {
  for (const b of BADGE_THRESHOLDS) {
    await tx.badge.upsert({
      where: { code: b.code },
      update: {
        label: b.label,
        description: b.description,
        min_xp: b.minXp,
      },
      create: {
        code: b.code,
        label: b.label,
        description: b.description,
        min_xp: b.minXp,
      },
    });
  }
}

async function awardBadgesIfNeeded(tx, userId, totalXp) {
  await ensureBadgeCatalog(tx);

  const existing = await tx.userBadge.findMany({
    where: { user_id: userId },
    include: { badge: true },
  });

  const owned = new Set(existing.map((ub) => ub.badge.code));
  const newOnes = [];

  for (const cfg of BADGE_THRESHOLDS) {
    if (totalXp >= cfg.minXp && !owned.has(cfg.code)) {
      const badge = await tx.badge.findUnique({ where: { code: cfg.code } });
      if (!badge) continue;

      const created = await tx.userBadge.create({
        data: { user_id: userId, badge_id: badge.id },
        include: { badge: true },
      });

      newOnes.push(created.badge);
    }
  }

  return newOnes;
}

/* ---------------- MAIN HELPERS ---------------- */

async function ensureProgress(tx, userId) {
  let p = await tx.userProgress.findUnique({ where: { user_id: userId } });
  if (!p) {
    p = await tx.userProgress.create({
      data: { user_id: userId, total_xp: 0, last_activity: new Date() },
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
    create: { user_id: userId, total_xp: amount, last_activity: new Date() },
    update: { total_xp: { increment: amount }, last_activity: new Date() },
  });

  const progress = await tx.userProgress.findUnique({
    where: { user_id: userId },
  });

  const newBadges = await awardBadgesIfNeeded(tx, userId, progress.total_xp);

  return { event, progress, newBadges };
}

/* ---------------- ROUTES ---------------- */

// GET /api/xp/balance
router.get("/balance", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    const totals = await prisma.userWeeklyTotals.findUnique({
      where: { user_id: userId },
      select: {
        week_xp: true,
        month_xp: true,
        week_key: true,
        month_key: true,
      },
    });

    const lifetime = await prisma.xpEvent.aggregate({
      _sum: { xp_delta: true },
      where: { user_id: userId },
    });

    const badges = await prisma.userBadge.findMany({
      where: { user_id: userId },
      include: { badge: true },
    });

    res.json({
      ok: true,
      balance: {
        week_xp: totals?.week_xp ?? 0,
        month_xp: totals?.month_xp ?? 0,
        lifetime_xp: lifetime._sum.xp_delta || 0,
        week_key: totals?.week_key ?? weekStartUTC(),
        month_key: totals?.month_key ?? monthStartUTC(),
        badges: badges.map((b) => ({
          code: b.badge.code,
          label: b.badge.label,
          description: b.badge.description,
          awarded_at: b.awarded_at,
        })),
      },
    });
  } catch (err) {
    console.error("❌ xp/balance error:", err);
    res.status(500).json({ ok: false, message: "Failed to load XP balance" });
  }
});

// POST /api/xp/award
router.post("/award", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const amount = parseAmount(req.body?.amount);
    if (amount === null || amount === 0)
      return res.status(400).json({ ok: false, message: "Invalid XP amount" });

    const eventType = normalizeEventType(req.body?.event);
    const meta = req.body?.meta ?? {};

    const { event, progress, newBadges } = await prisma.$transaction(
      async (tx) => {
        await ensureProgress(tx, userId);
        return await writeXp(tx, userId, amount, eventType, meta);
      },
    );

    res.json({
      ok: true,
      message: "XP awarded",
      event,
      balance: { total_xp: progress.total_xp },
      newBadges,
    });
  } catch (err) {
    console.error("❌ xp/award error:", err);
    res.status(500).json({ ok: false, message: "Failed to award XP" });
  }
});

// POST /api/xp/log
router.post("/log", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const xpValue = parseAmount(req.body?.xp_delta);
    if (xpValue === null || xpValue === 0)
      return res
        .status(400)
        .json({ ok: false, message: "xp_delta must be non-zero" });

    const eventType = normalizeEventType(req.body?.event_type);
    const meta = req.body?.meta ?? {};

    const { event, progress, newBadges } = await prisma.$transaction(
      async (tx) => {
        await ensureProgress(tx, userId);
        return await writeXp(tx, userId, xpValue, eventType, meta);
      },
    );

    res.json({
      ok: true,
      message: "XP logged",
      event,
      balance: { total_xp: progress.total_xp },
      newBadges,
    });
  } catch (err) {
    console.error("❌ xp/log error:", err);
    res.status(500).json({ ok: false, message: "Failed to log XP" });
  }
});

// GET /api/xp/events
router.get("/events", authRequired, async (req, res) => {
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
    res.status(500).json({ ok: false, message: "Failed to load XP events" });
  }
});

export default router;
