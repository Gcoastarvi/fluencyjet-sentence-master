import express from "express";
import prisma from "../db/client.js";
import { authRequired } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/entitlements", authRequired, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { has_access: true, tier_level: true, plan: true },
  });

  const tier = String(user?.tier_level || "").toLowerCase();
  const plan = String(user?.plan || "").toLowerCase();

  const proActive =
    !!user?.has_access ||
    tier === "pro" ||
    tier === "all" ||
    plan === "pro" ||
    plan === "paid";

  res.json({
    ok: true,
    tier_level: user?.tier_level || "free",
    plan: user?.plan || "FREE",
    proActive,
  });
});

export default router;
