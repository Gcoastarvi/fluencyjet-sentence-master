// server/routes/progress.js
import express from "express";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";

import crypto from "crypto";

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

function hashKey(prefix, raw, maxLen = 50) {
  const h = crypto.createHash("sha1").update(String(raw)).digest("hex"); // 40 chars
  const key = `${prefix}_${h}`; // "qxp_" + 40 = 44 chars
  return key.length > maxLen ? key.slice(0, maxLen) : key;
}

async function ensureProgress(tx, userId) {
  // ✅ Always ensure a row exists, even for old/new users
  return tx.userProgress.upsert({
    where: { user_id: userId },
    update: {}, // no-op if exists
    create: {
      user_id: userId,
      xp: 0,
      streak: 0,
      badges: [],
      // updated_at has default(now()) in schema, so we can omit it
    },
  });
}

async function ensureLessonProgress(tx, userId, lessonId) {
  // If this model doesn't exist in Prisma schema yet, skip safely.
  if (!tx?.userLessonProgress) return null;
  let row = await tx.userDayProgress.findFirst({
    where: {
      userId,
      dayNumber: lessonId,
    },
  });

  if (!row) {
    row = await tx.userDayProgress.create({
      data: {
        userId,
        dayNumber: lessonId,
        level: "BEGINNER", // current system = lesson/day
        completed: false,
        xpEarned: 0,
      },
    });
  }

  return row;
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
      update: {},
      create: { user_id: userId, xp: 0, streak: 0, badges: [] },
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

      if (currentProgress && currentProgress.xp >= MAX_TOTAL_XP_FREE) {
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
          xp: amount,
          streak: 0,
          badges: [],
          updated_at: new Date(),
        },
        update: {
          xp: { increment: amount },
          updated_at: new Date(),
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
// Called on every question attempt from /practice/*
// Must be bulletproof: award XP + update streak ALWAYS.
// Only do lesson completion/unlock when completedQuiz === true.
router.post("/update", authRequired, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ ok: false, message: "Unauthorized" });

    const body = req.body || {};

    // --- attemptId normalize (idempotency) ---
    // Accept camel + snake; if missing, generate a safe server fallback.
    // This prevents "all answers collapse to the same eventKey".
    const rawAttemptId = body.attemptId ?? body.attempt_id ?? "";
    const attemptId =
      typeof rawAttemptId === "string" && rawAttemptId.trim()
        ? rawAttemptId.trim()
        : `srv_${userId}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    // normalize mode + practiceType safely
    const rawMode = String(
      body.mode ?? body.practiceType ?? body.practice_type ?? "",
    )
      .trim()
      .toLowerCase();

    const rawType = String(
      body.practiceType ?? body.practice_type ?? body.mode ?? "",
    )
      .trim()
      .toLowerCase();

    // normalize to the 4 known practice types
    const practiceType =
      rawType === "typing"
        ? "typing"
        : rawType === "reorder"
          ? "reorder"
          : rawType === "cloze"
            ? "cloze"
            : rawType === "audio"
              ? "audio"
              : rawMode === "typing"
                ? "typing"
                : rawMode === "reorder"
                  ? "reorder"
                  : rawMode === "cloze"
                    ? "cloze"
                    : rawMode === "audio"
                      ? "audio"
                      : "reorder";

    // keep `mode` for any other logic (level mapping etc.)
    const mode = rawMode || practiceType;

    const attemptNo = Number(body.attemptNo ?? body.attempt_no ?? 1) || 1;

    const event = String(body.event || "")
      .trim()
      .toLowerCase();

    // Treat "exercise_correct" as correct even if client didn't send isCorrect:true
    const isCorrect =
      body.isCorrect !== undefined
        ? Boolean(body.isCorrect)
        : event === "exercise_correct";

    const completedQuiz = Boolean(body.completedQuiz);

    const questionIdRaw =
      body.questionId ?? body.questionKey ?? body.question_id ?? "";
    const questionId = String(questionIdRaw || "");

    // Lesson tag (safe string) + numeric lesson id (only needed on completedQuiz)
    const lessonIdMaybe = body.lessonId ?? body.lesson_id ?? null;
    const lessonKeyMaybe = body.lessonKey ?? body.lesson_key ?? null;

    const lessonIdNum = Number(lessonIdMaybe);
    const lessonTag =
      !Number.isNaN(lessonIdNum) && lessonIdNum > 0
        ? `L${lessonIdNum}`
        : typeof lessonKeyMaybe === "string" && lessonKeyMaybe
          ? String(lessonKeyMaybe)
          : "L0";

    // XP economy (server is source of truth)
    const XP_BY_TYPE = { typing: 150, reorder: 100, cloze: 80, audio: 150 };

    // If client sends xp, accept it only up to allowed max for that mode (prevents cheating)
    const requestedXp = Number(body.xp ?? 0) || 0;
    const maxXp = Number(XP_BY_TYPE?.[practiceType] ?? 100) || 100;

    const eventName = String(body.event ?? "")
      .trim()
      .toLowerCase();
    const shouldAward = eventName
      ? eventName === "exercise_correct" && isCorrect
      : isCorrect;

    const baseXP = shouldAward ? Math.min(Math.max(requestedXp, 0), maxXp) : 0;

    const result = await prisma.$transaction(async (tx) => {
      // 1) ensure user progress row exists
      const prog = await ensureProgress(tx, userId);

      // streak logic temporarily disabled (schema has streak, but we don't compute it here yet)
      const now = new Date();
      const newStreak = Number(prog?.streak ?? 0);

      // No streak bonus for now (we’ll re-enable when we add last_activity / daily tracking)
      const streakBonus = 0;

      // 3) idempotency key (store in xpEvent.type)
      // Make it unique per question attempt (prevents xpDelta becoming 0 after Q1)
      const exerciseIdNum =
        Number(body.exerciseId ?? body.exercise_id ?? 0) || 0;
      const lessonIdNum = Number(body.lessonId ?? body.lesson_id ?? 0) || 0;
      const attemptNo = Number(body.attemptNo ?? body.attempt_no ?? 1) || 1;

      const eventKey = [
        "xp",
        userId,
        lessonIdNum,
        practiceType, // already normalized earlier in your route
        String(body.event || "unknown"),
        exerciseIdNum,
        attemptNo,
        attemptId,
      ].join("|");

      const existing = await tx.xpEvent.findFirst({
        where: { user_id: userId, type: eventKey },
        select: { id: true },
      });

      console.log("[XPDBG] eventKey", eventKey);

      console.log("[progress/update]", {
        event: body.event,
        xp: body.xp,
        mode: body.mode,
        practiceType: body.practiceType,
        practice_type: body.practice_type,
        lessonId: body.lessonId,
        exerciseId: body.exerciseId,
      });

      // Keep type length safe (type column usually limited)
      const dayKey = now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

      const lessonKeyForDedupe =
        !Number.isNaN(lessonIdNum) && lessonIdNum > 0
          ? `L${lessonIdNum}`
          : lessonTag;

      const qKeyRaw = String(questionId || "").trim();
      const questionKeyForDedupe = qKeyRaw ? qKeyRaw : `Q${attemptNo}`;

      // ✅ hashed + short (fits VarChar(50))
      const qEventKey = hashKey(
        "qxp",
        `${dayKey}|${lessonKeyForDedupe}|${practiceType}|${questionKeyForDedupe}`,
        50,
      );

      const existingQuestionAward = isCorrect
        ? await tx.xpEvent.findFirst({
            where: { user_id: userId, type: qEventKey },
            select: { id: true },
          })
        : null;

      const xpDelta =
        existing || existingQuestionAward ? 0 : baseXP + streakBonus;

      if (!existing && !existingQuestionAward && xpDelta > 0) {
        // award xp (attempt-level idempotency)
        await tx.xpEvent.create({
          data: {
            user_id: userId,
            type: eventKey,
            xp_delta: xpDelta,
          },
        });

        // lock per-question-per-day (prevents spamming the same question)
        await tx.xpEvent.create({
          data: {
            user_id: userId,
            type: qEventKey,
            xp_delta: 0,
          },
        });
      }

      console.log(
        "[DBG] tx keys:",
        Object.keys(tx)
          .filter((k) => !k.startsWith("$"))
          .slice(0, 200),
      );
      console.log("[DBG] tx.userProgress?", !!tx.userProgress);
      console.log("[DBG] tx.userLessonProgress?", !!tx.userLessonProgress);

      // 4) Update UserProgress (keep cached totals/streak in sync with XpEvent)
      const updatedProgress = await tx.userProgress.upsert({
        where: { user_id: userId },
        update: {
          xp: { increment: xpDelta },
          streak: newStreak,
          updated_at: now,
        },
        create: {
          user_id: userId,
          xp: Number(xpDelta) || 0,
          streak: newStreak,
          badges: [],
          updated_at: now,
        },
      });

      // 5) optional: only on quiz completion -> mark lesson complete + unlock next
      let lessonPayload = null;

      // Optional: only on quiz completion -> mark lesson complete + unlock next
      if (completedQuiz) {
        if (Number.isNaN(lessonIdNum) || lessonIdNum <= 0) {
          lessonPayload = { skipped: true, reason: "lessonId missing/invalid" };
        } else {
          // If Prisma schema doesn't have these models yet, skip safely.
          if (!tx?.lesson || !tx?.unlockedLesson || !tx?.userLessonProgress) {
            lessonPayload = {
              skipped: true,
              reason: "unlock models not in schema yet",
            };
          } else {
            // userLessonProgress might still be absent for some users; ensureLessonProgress returns null if model missing
            let lp = await ensureLessonProgress(tx, userId, lessonIdNum);

            // If ensureLessonProgress returned null, skip safely
            if (!lp) {
              lessonPayload = {
                skipped: true,
                reason: "lesson progress table not available",
              };
            } else {
              const wasCompleted = Boolean(lp.completed);

              lp = await tx.userLessonProgress.update({
                where: { id: lp.id },
                data: {
                  completed: true,
                  attempts: (lp.attempts || 0) + 1,
                  last_attempt_at: now,
                },
              });

              // Unlock next lesson using "order" ONLY if your schema actually has an "order" field.
              // If your Lesson model doesn't have "order", comment out this entire unlock section.
              const lesson = await tx.lesson.findUnique({
                where: { id: lessonIdNum },
              });

              let nextLesson = null;
              if (lesson && typeof lesson.order === "number") {
                nextLesson = await tx.lesson.findFirst({
                  where: { order: { gt: lesson.order } },
                  orderBy: { order: "asc" },
                });

                if (
                  !tx.unlockedLesson ||
                  typeof tx.unlockedLesson.upsert !== "function"
                ) {
                  console.warn(
                    "[unlock] skipped: unlockedLesson model missing",
                  );
                } else {
                  // existing unlock code (upsert + findMany)
                }

                if (nextLesson) {
                  await tx.unlockedLesson.upsert({
                    where: {
                      user_id_lesson_id: {
                        user_id: userId,
                        lesson_id: nextLesson.id,
                      },
                    },
                    update: {},
                    create: { user_id: userId, lesson_id: nextLesson.id },
                  });
                }
              }

              const unlocked = await tx.unlockedLesson.findMany({
                where: { user_id: userId },
              });

              lessonPayload = {
                lessonProgress: lp,
                unlockedLessons: unlocked.map((u) => u.lesson_id),
                nextLessonId: nextLesson ? nextLesson.id : null,
              };
            }
          }

          // ✅ Completion tracking using UserDayProgress (replaces removed UserLessonProgress)
          if (completedQuiz) {
            // Need level + dayNumber. If client sends them, use those.
            // Fallback mapping: treat lessonId as dayNumber, and mode as level bucket.
            const level =
              mode === "beginner"
                ? "BEGINNER"
                : mode === "intermediate"
                  ? "INTERMEDIATE"
                  : mode === "advanced"
                    ? "ADVANCED"
                    : "BEGINNER";

            const dayNumber = lessonIdNum || 1;

            // If schema/table not present, skip safely (prevents tx.userDayProgress undefined)
            if (!tx?.userDayProgress) {
              // don't crash completion
            } else {
              const existing = await tx.userDayProgress.findFirst({
                where: { userId, level, dayNumber },
              });

              if (existing) {
                await tx.userDayProgress.update({
                  where: { id: existing.id },
                  data: { completed: true, completedAt: now },
                });
              } else {
                await tx.userDayProgress.create({
                  data: {
                    userId,
                    level,
                    dayNumber,
                    completed: true,
                    completedAt: now,
                  },
                });
              }
            }

            const existingDay = await tx.userDayProgress.findFirst({
              where: { userId, level, dayNumber },
            });

            const wasCompleted = Boolean(existingDay?.completed);

            if (existingDay) {
              await tx.userDayProgress.update({
                where: { id: existingDay.id },
                data: {
                  completed: true,
                  completedAt: now,
                  // Optional: accumulate XP if you want
                  // xpEarned: { increment: xpDelta },
                },
              });
            } else {
              await tx.userDayProgress.create({
                data: {
                  userId,
                  level,
                  dayNumber,
                  completed: true,
                  completedAt: now,
                  // xpEarned: xpDelta,
                },
              });
            }

            // Keep the "lessons_completed" counter in UserProgress if you still use it on dashboard
          }
        }

        if (!Number.isFinite(lessonIdNum) || lessonIdNum <= 0) {
          lessonPayload = { skipped: true, reason: "lessonId missing/invalid" };
        } else {
          const lesson = await tx.lesson.findUnique({
            where: { id: lessonIdNum },
          });

          let nextLesson = null;

          if (lesson) {
            nextLesson = await tx.lesson.findFirst({
              where: { id: { gt: lesson.id } },
              orderBy: { id: "asc" },
            });

            if (
              !tx.unlockedLesson ||
              typeof tx.unlockedLesson.upsert !== "function" ||
              typeof tx.unlockedLesson.findMany !== "function"
            ) {
              console.warn("[unlock] skipped: unlockedLesson model missing");

              // Still return a payload so completion doesn't 500
              lessonPayload = {
                unlockedLessons: [],
                nextLessonId: nextLesson ? nextLesson.id : null,
                unlockSkipped: true,
              };
            } else {
              if (nextLesson) {
                await tx.unlockedLesson.upsert({
                  where: {
                    user_id_lesson_id: {
                      user_id: userId,
                      lesson_id: nextLesson.id,
                    },
                  },
                  update: {},
                  create: { user_id: userId, lesson_id: nextLesson.id },
                });
              }

              const unlocked = await tx.unlockedLesson.findMany({
                where: { user_id: userId },
              });

              lessonPayload = {
                unlockedLessons: unlocked.map((u) => u.lesson_id),
                nextLessonId: nextLesson ? nextLesson.id : null,
              };
            }
          } else {
            lessonPayload = { skipped: true, reason: "lesson not found" };
          }
        }
      }

      return {
        xpAwarded: xpDelta,
        streak: updatedProgress.streak,
        totalXP: updatedProgress.xp,
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
