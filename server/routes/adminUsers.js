import express from "express";
import prisma from "../db/client.js";
import { adminOnly } from "../middleware/adminOnly.js";

const router = express.Router();

/* ---------------------------------------------
   GET ALL USERS
--------------------------------------------- */
router.get("/", adminOnly, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        xp: true,
        streak: true,
        last_active: true,
        isBanned: true,
        created_at: true,
      },
    });

    res.json({ ok: true, users });
  } catch (error) {
    console.error("Admin GET users error:", error);
    res.status(500).json({ ok: false, message: "Failed to fetch users" });
  }
});

/* ---------------------------------------------
   GET USER BY ID
--------------------------------------------- */
router.get("/:id", adminOnly, async (req, res) => {
  const { id } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
      select: {
        id: true,
        email: true,
        name: true,
        xp: true,
        streak: true,
        last_active: true,
        isBanned: true,
      },
    });

    if (!user)
      return res.status(404).json({ ok: false, message: "User not found" });

    res.json({ ok: true, user });
  } catch (error) {
    console.error("Admin GET user error:", error);
    res.status(500).json({ ok: false, message: "Failed to fetch user" });
  }
});

/* ---------------------------------------------
   RESET USER XP
--------------------------------------------- */
router.patch("/:id/reset-xp", adminOnly, async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.user.update({
      where: { id: Number(id) },
      data: { xp: 0 },
    });

    res.json({ ok: true, message: "XP reset successfully" });
  } catch (error) {
    console.error("Reset XP error:", error);
    res.status(500).json({ ok: false, message: "Failed to reset XP" });
  }
});

/* ---------------------------------------------
   RESET USER STREAK
--------------------------------------------- */
router.patch("/:id/reset-streak", adminOnly, async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.user.update({
      where: { id: Number(id) },
      data: { streak: 0 },
    });

    res.json({ ok: true, message: "Streak reset successfully" });
  } catch (error) {
    console.error("Reset streak error:", error);
    res.status(500).json({ ok: false, message: "Failed to reset streak" });
  }
});

/* ---------------------------------------------
   BAN / UNBAN USER
--------------------------------------------- */
router.patch("/:id/toggle-ban", adminOnly, async (req, res) => {
  const { id } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
      select: { isBanned: true },
    });

    if (!user)
      return res.status(404).json({ ok: false, message: "User not found" });

    const updated = await prisma.user.update({
      where: { id: Number(id) },
      data: { isBanned: !user.isBanned },
    });

    res.json({
      ok: true,
      message: updated.isBanned ? "User banned" : "User unbanned",
      isBanned: updated.isBanned,
    });
  } catch (error) {
    console.error("Ban toggle error:", error);
    res.status(500).json({ ok: false, message: "Failed to toggle ban" });
  }
});

export default router;
