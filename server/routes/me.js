import express from "express";
import { prisma } from "../db/client.js"; // adjust path to your prisma client
import { requireAuth } from "../middleware/requireAuth.js"; // adjust to your auth

const router = express.Router();

router.get("/entitlements", requireAuth, async (req, res) => {
  // req.user.id should exist if your auth middleware attaches it
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { plan: true, proExpiresAt: true },
  });

  const now = new Date();
  const proActive =
    user?.plan === "pro" &&
    (!user.proExpiresAt || new Date(user.proExpiresAt) > now);

  res.json({
    plan: user?.plan ?? "free",
    proExpiresAt: user?.proExpiresAt ?? null,
    proActive,
  });
});

export default router;
