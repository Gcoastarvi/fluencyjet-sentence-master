// server/routes/progress.js
import express from "express";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";

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
function parseLessonId(raw) {
  // Accept: 1, "1", "L1", "lesson-1"
  if (raw === undefined || raw === null) return null;

  // number-like
  const n = Number(raw);
  if (!Number.isNaN(n) && n > 0) return n;

  // strings like "L1"
  if (typeof raw === "string") {
    const m = raw.match(/(\d+)/);
    if (m) {
      const n2 = Number(m[1]);
      if (!Number.isNaN(n2) && n2 > 0) return n2;
    }
  }

  return null;
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
      // ───────────────────────────────
      // XP CAP (FREE PLAN – HARD LIMIT)
      // ───────────────────────────────

      // TEMP: hard cap (can be plan-based later)
      const MAX_TOTAL_XP_FREE = 5000;

      // get current progress
      const currentProgress = await tx.userProgress.findUnique({
        where: { user_id: userId },
      });

      if (currentProgress && currentProgress.total_xp >= MAX_TOTAL_XP_FREE) {
        // Do NOT award XP beyond cap
        return {
          ev: null,
          prog: currentProgress,
          capped: true,
        };
      }

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

    if (ev === null) {
      return res.json({
        ok: true,
        capped: true,
        message: "XP cap reached. Upgrade to PRO to earn more XP.",
        progress: prog,
      });
    }

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

// POST /api/progress/update
// IMPORTANT:
// - This endpoint is called on every question attempt from /practice/*
// - So it MUST be bulletproof.
// - Award XP + update streak ALWAYS.
// - Only do lesson completion/unlock when completedQuiz === true.
router.post("/update", authRequired, async (req, res) => {
  try {
    const userId = req.user?.id;

    const body = req.body || {};
    const attemptId = String(body.attemptId || body.attempt_id || "");
    const attemptNo = Number(body.attemptNo ?? 1) || 1;
    const isCorrect = Boolean(body.isCorrect);

    // normalize practice type
    const practiceType = String(body.practiceType || body.mode || "reorder");

    // normalize question id (string-safe)
    const questionIdRaw = body.questionId ?? body.questionKey ?? "";
    const questionId = String(questionIdRaw);

    // completedQuiz controls whether we do lesson unlock logic
    const completedQuiz = Boolean(body.completedQuiz);

    // Lesson id: we keep BOTH in payload, but only required for completedQuiz flow
    const lessonIdRaw =
      body.lessonId ?? body.lessonKey ?? body.lessonID ?? null;

    if (!userId)
      return res.status(401).json({ ok: false, message: "Unauthorized" });
    if (!attemptId)
      return res
        .status(400)
        .json({ ok: false, message: "attemptId is required" });

    // XP rules (match your current UI expectation)
    const XP_BY_TYPE = {
      reorder: 150,
      typing: 150,
      cloze: 80,
      audio: 80,
    };

    const baseXP = isCorrect ? (XP_BY_TYPE[practiceType] ?? 100) : 0;

    const result = await prisma.$transaction(async (tx) => {
      // 1) ensure user progress exists
      const prog = await ensureProgress(tx, userId);

      // 2) idempotency: don't award XP twice for same attemptId
      const eventKey = `practice:${practiceType}:L${lessonId}:Q${questionId}:A${attemptId}`;

      const existing = await tx.xpEvent.findFirst({
        where: { user_id: userId, type: eventKey },
        select: { id: true },
      });

      // streak logic (simple + stable)
      const now = new Date();
      const last = prog.last_activity ? new Date(prog.last_activity) : null;

      const todayKey = now.toDateString();
      const lastKey = last ? last.toDateString() : null;

      const isNewDay = lastKey !== todayKey;
      const streakBonus = isCorrect && isNewDay ? 200 : 0;

      const xpDelta = existing ? 0 : baseXP + streakBonus;

      // 3) write xpEvent if awarding XP
      if (!existing && xpDelta > 0) {
        await tx.xpEvent.create({
          data: {
            user_id: userId,
            attempt_id: attemptId,
            practice_type: practiceType,
            question_id: questionId || null,
            is_correct: isCorrect,
            attempt_no: attemptNo,
            xp_delta: xpDelta,
          },
        });
      }

      // 4) update totals + streak + last_activity
      const nextStreak = isNewDay
        ? Number(prog.streak || 0) + 1
        : Number(prog.streak || 0);

      const updatedProgress = await tx.userProgress.update({
        where: { user_id: userId },
        data: {
          total_xp: { increment: xpDelta },
          last_activity: now,
          streak: nextStreak,
        },
      });

      // 5) ONLY on quiz completion do we attempt lesson completion/unlock logic
      //    AND ONLY if the Prisma model exists (prevents your current crash)
      let lessonPayload = null;

      if (completedQuiz) {
        // normalize lessonId to number if possible, else null
        const lessonIdNum = Number(lessonIdRaw);
        if (!lessonIdRaw || Number.isNaN(lessonIdNum)) {
          // don’t crash; just skip unlock flow
          lessonPayload = { skipped: true, reason: "lessonId missing/invalid" };
        } else if (!tx.userLessonProgress) {
          // this is YOUR current production problem — so we skip cleanly
          lessonPayload = {
            skipped: true,
            reason: "userLessonProgress model not available",
          };
        } else {
          const lp = await ensureLessonProgress(tx, userId, lessonIdNum);

          const bestScore = Math.max(
            Number(lp.best_score || 0),
            Number(body.score || 0),
          );

          const updatedLP = await tx.userLessonProgress.update({
            where: { id: lp.id },
            data: {
              completed: true,
              best_score: bestScore,
            },
          });

          const lesson = await tx.lesson.findUnique({
            where: { id: lessonIdNum },
          });

          if (lesson) {
            // unlock next lesson
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

            lessonPayload = {
              lessonProgress: updatedLP,
              unlockedLessons: unlocked.map((u) => u.lesson_id),
              nextLessonId: nextLesson?.id || null,
            };
          } else {
            lessonPayload = { skipped: true, reason: "lesson not found" };
          }
        }
      }

      return {
        xpAwarded: xpDelta,
        streak: updatedProgress.streak,
        totalXP: updatedProgress.total_xp,
        lesson: lessonPayload,
      };
    });

    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("❌ /progress/update error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to update progress",
      error: String(err?.message || err),
    });
  }
});

export default router;
