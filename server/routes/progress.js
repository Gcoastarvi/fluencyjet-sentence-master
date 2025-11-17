// server/routes/progress.js
import express from "express";
import prisma from "../db/client.js";
import { authMiddleware as authRequired } from "../middleware/authMiddleware.js";

const router = express.Router();

/* TIME HELPERS */

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

function dayStartUTC(d = new Date()) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

/* HELPERS */

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
  const key = String(input || "").toLowerCase();
  const alias = EVENT_ALIASES.get(key);
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
      data: {
        user_id: userId,
        total_xp: 0,
        last_activity: new Date(),
        consecutive_days: 0,
        lessons_completed: 0,
      },
    });
  }
  return p;
}

async function ensureLessonProgress(tx, userId, lessonId) {
  let lp = await tx.userLessonProgress.findFirst({
    where: { user_id: userId, lesson_id: lessonId },
  });

  if (!lp) {
    lp = await tx.userLessonProgress.create({
      data: {
        user_id: userId,
        lesson_id: lessonId,
        attempts: 0,
        best_score: 0,
        completed: false,
        last_attempt_at: new Date(),
      },
    });
  }
  return lp;
}

/* ROUTES */

// GET /api/progress/me
router.get("/me", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const wk = weekStartUTC();

    const progress = await prisma.userProgress.upsert({
      where: { user_id: userId },
      update: { last_activity: new Date() },
      create: { user_id: userId, total_xp: 0, last_activity: new Date() },
    });

    const weeklyTop = await prisma.userWeeklyTotals.findMany({
      where: { week_key: wk },
      orderBy: { week_xp: "desc" },
      take: 10,
    });

    res.json({ ok: true, progress, weeklyTop });
  } catch (err) {
    console.error("❌ /progress/me error:", err);
    res.status(500).json({
      ok: false,
      message: "Failed to load progress",
      error: String(err?.message || err),
    });
  }
});

// GET /api/progress/summary
router.get("/summary", authRequired, async (req, res) => {
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
      });

      const badges = await tx.userBadge.findMany({
        where: { user_id: userId },
        orderBy: { awarded_at: "desc" },
        take: 10,
        include: { badge: true },
      });

      const events = await tx.xpEvent.findMany({
        where: { user_id: userId },
        orderBy: { created_at: "desc" },
        take: 10,
      });

      const weeklyTop = await tx.userWeeklyTotals.findMany({
        where: { week_key: wk },
        orderBy: { week_xp: "desc" },
        take: 10,
      });

      return {
        progress,
        weekly,
        badges: badges.map((ub) => ({
          code: ub.badge.code,
          label: ub.badge.label,
          description: ub.badge.description,
          awarded_at: ub.awarded_at,
        })),
        events,
        weeklyTop,
      };
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("❌ /progress/summary error:", err);
    res.status(500).json({
      ok: false,
      message: "Failed to load summary",
      error: String(err?.message || err),
    });
  }
});

// POST /api/progress/save  (XP alias – kept for compatibility)
router.post("/save", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const amount = parseAmount(req.body?.amount);
    if (amount === null || amount === 0) {
      return res
        .status(400)
        .json({ ok: false, message: "amount must be a non-zero number" });
    }

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
        update: {
          total_xp: { increment: amount },
          last_activity: new Date(),
        },
      });

      return { ev, prog };
    });

    res.json({
      ok: true,
      message: "Progress saved / XP awarded",
      event: ev,
      progress: prog,
    });
  } catch (err) {
    console.error("❌ /progress/save error:", err);
    res.status(500).json({
      ok: false,
      message: "Failed to save progress",
      error: String(err?.message || err),
    });
  }
});

// POST /api/progress/update  (mark lesson completed + unlock next + streak)
router.post("/update", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const lessonId = Number(req.body?.lessonId);

    if (!lessonId || Number.isNaN(lessonId)) {
      return res
        .status(400)
        .json({ ok: false, message: "lessonId is required" });
    }

    const todayUTC = dayStartUTC(new Date());
    const yesterdayUTC = dayStartUTC(
      new Date(Date.now() - 24 * 60 * 60 * 1000),
    );

    const result = await prisma.$transaction(async (tx) => {
      const existingProgress = await ensureProgress(tx, userId);

      const lesson = await tx.lesson.findUnique({
        where: { id: lessonId },
      });

      if (!lesson) throw new Error("Lesson not found");

      let lp = await ensureLessonProgress(tx, userId, lessonId);
      const wasCompleted = lp.completed;

      lp = await tx.userLessonProgress.update({
        where: { id: lp.id },
        data: {
          completed: true,
          attempts: (lp.attempts || 0) + 1,
          last_attempt_at: new Date(),
        },
      });

      if (!wasCompleted) {
        await tx.userProgress.update({
          where: { user_id: userId },
          data: { lessons_completed: { increment: 1 } },
        });
      }

      // streak logic
      let newStreak = existingProgress.consecutive_days || 0;
      const last = existingProgress.last_activity
        ? dayStartUTC(new Date(existingProgress.last_activity))
        : null;

      if (!last) newStreak = 1;
      else if (last.getTime() === todayUTC.getTime())
        newStreak = existingProgress.consecutive_days || 1;
      else if (last.getTime() === yesterdayUTC.getTime())
        newStreak = (existingProgress.consecutive_days || 0) + 1;
      else newStreak = 1;

      const updatedProgress = await tx.userProgress.update({
        where: { user_id: userId },
        data: {
          consecutive_days: newStreak,
          last_activity: new Date(),
        },
      });

      // unlock current lesson
      await tx.unlockedLesson.upsert({
        where: {
          user_id_lesson_id: { user_id: userId, lesson_id: lessonId },
        },
        update: {},
        create: {
          user_id: userId,
          lesson_id: lessonId,
        },
      });

      // unlock next lesson (by order)
      const nextLesson = await tx.lesson.findFirst({
        where: { order: { gt: lesson.order } },
        orderBy: { order: "asc" },
      });

      if (nextLesson) {
        await tx.unlockedLesson.upsert({
          where: {
            user_id_lesson_id: {
              user_id: userId,
              lesson_id: nextLesson.id,
            },
          },
          update: {},
          create: {
            user_id: userId,
            lesson_id: nextLesson.id,
          },
        });
      }

      const unlocked = await tx.unlockedLesson.findMany({
        where: { user_id: userId },
      });

      return {
        lessonProgress: lp,
        progress: updatedProgress,
        unlockedLessons: unlocked.map((u) => u.lesson_id),
        nextLessonId: nextLesson?.id || null,
      };
    });

    res.json({
      ok: true,
      message: "Lesson progress updated + lessons unlocked",
      ...result,
    });
  } catch (err) {
    console.error("❌ /progress/update error:", err);
    res.status(500).json({
      ok: false,
      message: "Failed to update progress",
      error: String(err?.message || err),
    });
  }
});

export default router;
