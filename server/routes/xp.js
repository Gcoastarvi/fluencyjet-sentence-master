// server/routes/xp.js
import express from "express";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";

const router = express.Router();

// ─────────────────────────────────────────────
// XP constants
// ─────────────────────────────────────────────
const INDIA_TZ = "Asia/Kolkata";
const XP_PER_CORRECT = 150;

// ─────────────────────────────────────────────
// Time helpers
// ─────────────────────────────────────────────
function ymdInTZ(date = new Date(), timeZone = INDIA_TZ) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function startOfWeekYMD(ymd) {
  // Monday-based week start
  const [Y, M, D] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(Y, M - 1, D));
  const day = dt.getUTCDay(); // 0..6 (Sun..Sat)
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  dt.setUTCDate(dt.getUTCDate() + diffToMonday);
  return dt.toISOString().slice(0, 10);
}

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
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

const MAX_XPEVENT_TYPE_LEN = 32;

function compactAttemptId(attemptId) {
  // UUID -> remove dashes -> take first 10 chars
  return String(attemptId || "")
    .replace(/-/g, "")
    .slice(0, 10);
}

function makeTypeKey({ mode, isCorrect, attemptId }) {
  const modeCodeMap = { reorder: "R", typing: "T", dragdrop: "D", cloze: "C" };
  const m = modeCodeMap[String(mode || "").toLowerCase()] || "X";
  const r = isCorrect ? "C" : "W";
  const a = compactAttemptId(attemptId);
  // Example: "PX_RC_a1b2c3d4e5"
  const raw = `PX_${m}${r}_${a}`;
  return raw.length > MAX_XPEVENT_TYPE_LEN
    ? raw.slice(0, MAX_XPEVENT_TYPE_LEN)
    : raw;
}

// ─────────────────────────────────────────────
// Core XP logic (per your request: always 150 for correct)
// ─────────────────────────────────────────────
function computeXpAward({ isCorrect }) {
  return isCorrect ? XP_PER_CORRECT : 0;
}

// ─────────────────────────────────────────────
// Prisma helpers (match your schema: xpEvent has NO meta)
// ─────────────────────────────────────────────
async function sumXpForUserBetween(userId, start, end) {
  const agg = await prisma.xpEvent.aggregate({
    where: { user_id: userId, created_at: { gte: start, lt: end } },
    _sum: { xp_delta: true },
  });
  return Number(agg?._sum?.xp_delta || 0);
}

// Idempotency WITHOUT meta:
// We store attemptId inside the type string as: `${baseType}|${attemptId}`
async function findExistingByAttemptId(userId, attemptId, mode, isCorrect) {
  if (!attemptId) return null;
  const typeKey = makeTypeKey({ mode, isCorrect: !!isCorrect, attemptId });
  return prisma.xpEvent.findFirst({
    where: { user_id: userId, type: typeKey },
    orderBy: { created_at: "desc" },
  });
}

async function ensureProgress(tx, userId) {
  let p = await tx.userProgress.findUnique({ where: { user_id: userId } });
  if (!p) {
    p = await tx.userProgress.create({
      data: {
        user_id: userId,
        xp: 0,
        streak: 0,
        badges: [],
        updated_at: new Date(),
      },
    });
  }
  return p;
}

function safeInt(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

// ─────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────

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

    res.json({
      ok: true,
      balance: {
        week_xp: totals?.week_xp ?? 0,
        month_xp: totals?.month_xp ?? 0,
        lifetime_xp: lifetime?._sum?.xp_delta ?? 0,
        week_key: totals?.week_key ?? weekStartUTC(),
        month_key: totals?.month_key ?? monthStartUTC(),
      },
    });
  } catch (err) {
    console.error("❌ xp/balance error:", err);
    res.status(500).json({ ok: false, message: "Failed to load XP balance" });
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

// POST /api/xp/award (admin/manual award) — stores as type
router.post("/award", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const amount = Math.trunc(Number(req.body?.amount || 0));
    if (!Number.isFinite(amount) || amount === 0) {
      return res.status(400).json({ ok: false, message: "Invalid XP amount" });
    }
    const type =
      String(req.body?.event || "ADMIN_ADJUST").trim() || "ADMIN_ADJUST";

    const now = new Date();
    const wk = weekStartUTC(now);
    const mk = monthStartUTC(now);

    const result = await prisma.$transaction(async (tx) => {
      await ensureProgress(tx, userId);

      const evt = await tx.xpEvent.create({
        data: { user_id: userId, xp_delta: amount, type },
      });

      const user = await tx.user.update({
        where: { id: userId },
        data: { xpTotal: { increment: amount } },
      });

      const prog = await tx.userProgress.update({
        where: { user_id: userId },
        data: { xp: { increment: amount }, updated_at: now },
      });

      await tx.userWeeklyTotals.upsert({
        where: { user_id: userId },
        update: {
          week_key: wk,
          month_key: mk,
          week_xp: { increment: amount },
          month_xp: { increment: amount },
          updated_at: now,
        },
        create: {
          user_id: userId,
          week_key: wk,
          month_key: mk,
          week_xp: amount,
          month_xp: amount,
          updated_at: now,
        },
      });

      return { evt, user, prog };
    });

    res.json({
      ok: true,
      xpAwarded: amount,
      totalXP: safeInt(result.user?.xpTotal, 0),
      progressXP: safeInt(result.prog?.xp, 0),
      event: result.evt,
    });
  } catch (err) {
    console.error("❌ xp/award error:", err);
    res.status(500).json({ ok: false, message: "Failed to award XP" });
  }
});

// POST /api/xp/log — compatibility endpoint (expects xp_delta + event_type)
router.post("/log", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const xpValue = Math.trunc(Number(req.body?.xp_delta || 0));
    if (!Number.isFinite(xpValue) || xpValue === 0) {
      return res
        .status(400)
        .json({ ok: false, message: "xp_delta must be non-zero" });
    }
    const type = String(req.body?.event_type || "GENERIC").trim() || "GENERIC";

    const now = new Date();
    const wk = weekStartUTC(now);
    const mk = monthStartUTC(now);

    const result = await prisma.$transaction(async (tx) => {
      await ensureProgress(tx, userId);

      const evt = await tx.xpEvent.create({
        data: { user_id: userId, xp_delta: xpValue, type },
      });

      const user = await tx.user.update({
        where: { id: userId },
        data: { xpTotal: { increment: xpValue } },
      });

      const prog = await tx.userProgress.update({
        where: { user_id: userId },
        data: { xp: { increment: xpValue }, updated_at: now },
      });

      await tx.userWeeklyTotals.upsert({
        where: { user_id: userId },
        update: {
          week_key: wk,
          month_key: mk,
          week_xp: { increment: xpValue },
          month_xp: { increment: xpValue },
          updated_at: now,
        },
        create: {
          user_id: userId,
          week_key: wk,
          month_key: mk,
          week_xp: xpValue,
          month_xp: xpValue,
          updated_at: now,
        },
      });

      return { evt, user, prog };
    });

    res.json({
      ok: true,
      xpAwarded: xpValue,
      totalXP: safeInt(result.user?.xpTotal, 0),
      progressXP: safeInt(result.prog?.xp, 0),
      event: result.evt,
    });
  } catch (err) {
    console.error("❌ xp/log error:", err);
    res.status(500).json({ ok: false, message: "Failed to log XP" });
  }
});

// POST /api/xp/commit  ✅ CANONICAL (used by sentence practice)
// awards +150 for any correct answer (as requested)
router.post("/commit", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      attemptId,
      mode = "reorder",
      lessonId = null,
      questionId = null,
      isCorrect = false,
      attemptNo = 0,
      timeTakenSec = null,
      completedQuiz = false,
    } = req.body || {};

    if (!attemptId) {
      return res
        .status(400)
        .json({ ok: false, error: "attemptId is required" });
    }

    const typeKey = makeTypeKey({ mode, isCorrect: !!isCorrect, attemptId });

    // Idempotency: if already credited for this attemptId, return that
    const existing = await findExistingByAttemptId(
      userId,
      attemptId,
      mode,
      isCorrect,
    );

    if (existing) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const progress = await prisma.userProgress.findUnique({
        where: { user_id: userId },
      });

      const todayYMD = ymdInTZ(new Date());
      const todayStart = new Date(`${todayYMD}T00:00:00.000Z`);
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

      const weekKey = startOfWeekYMD(todayYMD);
      const weekStart = new Date(`${weekKey}T00:00:00.000Z`);
      const weekEnd = new Date(weekStart);
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

      const monthStart = new Date(
        Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
      );
      const monthEnd = new Date(
        Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1),
      );

      const [todayXP, weeklyXP, monthlyXP] = await Promise.all([
        sumXpForUserBetween(userId, todayStart, tomorrowStart),
        sumXpForUserBetween(userId, weekStart, weekEnd),
        sumXpForUserBetween(userId, monthStart, monthEnd),
      ]);

      return res.json({
        ok: true,
        idempotent: true,
        xpAwarded: safeInt(existing?.xp_delta, 0),
        totalXP: safeInt(user?.xpTotal, safeInt(progress?.xp, 0)),
        streak: safeInt(progress?.streak, 0),
        todayXP,
        weeklyXP,
        monthlyXP,
        event: existing,
      });
    }

    const xpAwarded = computeXpAward({ mode, isCorrect, attemptNo });

    console.log("🧠 computeXpAward result", {
      mode,
      isCorrect,
      attemptNo,
      xpAwarded,
    });

    const now = new Date();

    // streak logic based on updated_at
    const progress0 = await prisma.userProgress.findUnique({
      where: { user_id: userId },
    });
    const todayYMD = ymdInTZ(now);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayYMD = ymdInTZ(yesterday);

    const lastActiveYMD = progress0?.updated_at
      ? ymdInTZ(progress0.updated_at)
      : null;
    let newStreak = safeInt(progress0?.streak, 0);

    if (lastActiveYMD !== todayYMD) {
      if (lastActiveYMD === yesterdayYMD) newStreak += 1;
      else newStreak = 1;
    }

    // Write everything atomically
    const wk = weekStartUTC(now);
    const mk = monthStartUTC(now);

    const result = await prisma.$transaction(async (tx) => {
      await ensureProgress(tx, userId);

      console.log("XP_EVENT typeKey", typeKey, "len=", String(typeKey).length);

      // Only create XP event if xpAwarded > 0
      let evt = null;
      if (xpAwarded > 0) {
        evt = await tx.xpEvent.create({
          data: {
            user_id: userId,
            xp_delta: xpAwarded,
            type: typeKey, // contains attemptId for idempotency
          },
        });

        await tx.user.update({
          where: { id: userId },
          data: { xpTotal: { increment: xpAwarded } },
        });

        await tx.userWeeklyTotals.upsert({
          where: { user_id: userId },
          update: {
            week_key: wk,
            month_key: mk,
            week_xp: { increment: xpAwarded },
            month_xp: { increment: xpAwarded },
            updated_at: now,
          },
          create: {
            user_id: userId,
            week_key: wk,
            month_key: mk,
            week_xp: xpAwarded,
            month_xp: xpAwarded,
            updated_at: now,
          },
        });
      }

      const prog2 = await tx.userProgress.update({
        where: { user_id: userId },
        data: {
          xp: xpAwarded > 0 ? { increment: xpAwarded } : undefined,
          streak: newStreak,
          updated_at: now,
        },
      });

      const user2 = await tx.user.findUnique({ where: { id: userId } });
      return { evt, prog2, user2 };
    });

    // Period totals for UI
    const todayStart = new Date(`${todayYMD}T00:00:00.000Z`);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

    const weekKey = startOfWeekYMD(todayYMD);
    const weekStart = new Date(`${weekKey}T00:00:00.000Z`);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

    const monthStart = new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1),
    );

    const [todayXP, weeklyXP, monthlyXP] = await Promise.all([
      sumXpForUserBetween(userId, todayStart, tomorrowStart),
      sumXpForUserBetween(userId, weekStart, weekEnd),
      sumXpForUserBetween(userId, monthStart, monthEnd),
    ]);

    return res.json({
      ok: true,
      xpAwarded,
      totalXP: safeInt(result.user2?.xpTotal, safeInt(result.prog2?.xp, 0)),
      streak: safeInt(result.prog2?.streak, 0),
      todayXP,
      weeklyXP,
      monthlyXP,
      event: result.evt,
    });
  } catch (err) {
    console.error("XP commit failed:", err);
    return res.status(500).json({ ok: false, error: "XP commit failed" });
  }
});

export default router;
