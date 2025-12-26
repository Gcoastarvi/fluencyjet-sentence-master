import express from "express";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(authRequired);

const INDIA_TZ = "Asia/Kolkata";

function ymdInTZ(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  const d = parts.find((p) => p.type === "day").value;
  return `${y}-${m}-${d}`;
}

function startOfWeekYMD(ymd) {
  const [Y, M, D] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(Y, M - 1, D));
  const day = dt.getUTCDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1) - day;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt.toISOString().slice(0, 10);
}

async function aggregateXP(start, end) {
  return prisma.xpEvent.groupBy({
    by: ["userId"],
    where: { createdAt: { gte: start, lt: end } },
    _sum: { delta: true },
  });
}

router.get("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const period = (req.query.period || "weekly").toLowerCase();

    const now = new Date();
    let start, end;

    if (period === "today") {
      const today = ymdInTZ(now);
      start = new Date(`${today}T00:00:00.000Z`);
      end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
    } else if (period === "monthly") {
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    } else if (period === "all") {
      start = new Date(0);
      end = now;
    } else {
      // weekly default
      const today = ymdInTZ(now);
      const wk = startOfWeekYMD(today);
      start = new Date(`${wk}T00:00:00.000Z`);
      end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 7);
    }

    const xpRows = await aggregateXP(start, end);

    const userIds = xpRows.map((r) => r.userId);

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true, xpTotal: true },
    });

    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    const rows = xpRows
      .map((r) => ({
        userId: r.userId,
        xp: Number(r._sum.delta || 0),
        name:
          userMap[r.userId]?.name ||
          userMap[r.userId]?.email?.split("@")[0] ||
          "Learner",
      }))
      .filter((r) => r.xp > 0)
      .sort((a, b) => b.xp - a.xp)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    const you = rows.find((r) => r.userId === userId) || null;

    return res.json({
      ok: true,
      period,
      totalLearners: rows.length,
      rows,
      top: rows.slice(0, 5),
      you,
    });
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ ok: false, message: "Leaderboard failed" });
  }
});

export default router;
