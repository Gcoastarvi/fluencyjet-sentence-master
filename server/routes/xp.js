// server/routes/xp.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import authRequired from "../middleware/authRequired.js";

const prisma = new PrismaClient();
const router = express.Router();

/* ----------------------------- HELPERS ----------------------------- */
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function weekStart() {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function monthStart() {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/* ----------------------------- BALANCE ----------------------------- */
router.get("/balance", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    const totals = await prisma.userWeeklyTotals.findUnique({
      where: { user_id: userId },
    });

    const lifetime = await prisma.xpEvent.aggregate({
      _sum: { xp: true },
      where: { user_id: userId },
    });

    res.json({
      ok: true,
      balance: {
        week_xp: totals?.week_xp ?? 0,
        month_xp: totals?.month_xp ?? 0,
        lifetime_xp: lifetime._sum.xp || 0,
      },
    });
  } catch (err) {
    console.error("XP Balance error:", err);
    res.status(500).json({ ok: false, message: "Failed to fetch XP balance" });
  }
});

/* ----------------------------- AWARD XP ----------------------------- */
router.post("/award", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const amount = Number(req.body.amount);

    if (!amount || !Number.isFinite(amount))
      return res.status(400).json({ ok: false, message: "Invalid XP amount" });

    const eventType = req.body.event || "GENERIC";

    const event = await prisma.$transaction(async (tx) => {
      // Log XP event
      const ev = await tx.xpEvent.create({
        data: {
          user_id: userId,
          xp: amount,
          event_type: eventType,
        },
      });

      // Update weekly/monthly totals
      await tx.userWeeklyTotals.upsert({
        where: { user_id: userId },
        update: {
          week_key: weekStart(),
          month_key: monthStart(),
          week_xp: { increment: amount },
          month_xp: { increment: amount },
        },
        create: {
          user_id: userId,
          week_key: weekStart(),
          month_key: monthStart(),
          week_xp: amount,
          month_xp: amount,
        },
      });

      // Update user progress XP
      await tx.userProgress.upsert({
        where: { user_id: userId },
        update: { total_xp: { increment: amount } },
        create: { user_id: userId, total_xp: amount },
      });

      // Update streak
      const today = todayKey();

      await tx.userStreak.upsert({
        where: { user_id: userId },
        update: {
          last_active: today,
          streak: { increment: 1 },
        },
        create: {
          user_id: userId,
          streak: 1,
          last_active: today,
        },
      });

      return ev;
    });

    res.json({ ok: true, event });
  } catch (err) {
    console.error("XP Award error:", err);
    res.status(500).json({ ok: false, message: "Failed to award XP" });
  }
});

/* ----------------------------- EVENTS LOG ----------------------------- */
router.get("/events", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    const events = await prisma.xpEvent.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: 100,
    });

    res.json({ ok: true, events });
  } catch (err) {
    console.error("XP Events error:", err);
    res.status(500).json({ ok: false, message: "Failed to load events" });
  }
});

export default router;
