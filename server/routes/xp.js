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
  return d; // Date object (matches Prisma DateTime)
}
// Month 1st 00:00:00 UTC
function monthStartUTC() {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1, 0, 0, 0, 0));
}

/* ----------------------------- input validation ---------------------------- */
const ALLOWED_EVENT_TYPES = new Set([
  "quiz",
  "streak",
  "bonus",
  "admin",
  "generic",
]);
function normalizeEventType(t) {
  const v = String(t || "generic").toLowerCase();
  return ALLOWED_EVENT_TYPES.has(v) ? v : "generic";
}
function parseXp(x) {
  const n = parseInt(x, 10);
  if (Number.isNaN(n)) return null;
  // optional guardrails
  return Math.max(-100000, Math.min(100000, n));
}

/* ------------------------------ main endpoint ------------------------------ */
/**
 * POST /api/xp/log
 * Body: { event_type: "quiz" | "streak" | "bonus" | "admin", xp_delta: number, meta?: object }
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
          event_type: eventType, // Prisma enum accepts the string value
          xp_delta: xpValue,
          meta, // Json field; no stringify needed
        },
      }),
      prisma.userWeeklyTotals.upsert({
        where: { user_id: userId }, // model uses user_id as @id
        update: {
          // roll keys forward (if CRON hasn’t already)
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

    // 2) Compute lifetime XP (source of truth = events)
    const lifetimeAgg = await prisma.xpEvent.aggregate({
      _sum: { xp_delta: true },
      where: { user_id: userId },
    });
    const lifetimeXp = lifetimeAgg._sum.xp_delta || 0;

    // 3) Award any badges whose threshold <= lifetimeXp and not yet owned
    //    (DB-driven; if you’ve seeded Badge table this will just work)
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
      .json({ ok: false, message: "Failed to log XP", error: err.message });
  }
});

export default router;
