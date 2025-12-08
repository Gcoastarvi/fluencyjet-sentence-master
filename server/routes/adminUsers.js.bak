// server/routes/adminUsers.js
import express from "express";
import prisma from "../db/client.js";
import authRequired from "../middleware/authMiddleware.js";
import requireAdmin from "../middleware/admin.js";

const router = express.Router();

/**
 * Map a User row into a safe admin-facing payload
 */
function mapUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    has_access: user.has_access,
    tier_level: user.tier_level,
    isAdmin: user.isAdmin,
    created_at: user.created_at,
    lastActiveAt: user.lastActiveAt,
    xpTotal: user.xpTotal,
  };
}

/**
 * GET /api/admin/users
 * List all users (latest first)
 */
router.get("/", authRequired, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        has_access: true,
        tier_level: true,
        isAdmin: true,
        created_at: true,
        lastActiveAt: true,
        xpTotal: true,
      },
    });

    return res.json({
      ok: true,
      users: users.map(mapUser),
    });
  } catch (err) {
    console.error("GET /api/admin/users error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to fetch users" });
  }
});

/**
 * GET /api/admin/users/:id
 * Fetch a single user by id
 */
router.get("/:id", authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, message: "Invalid user id" });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        has_access: true,
        tier_level: true,
        isAdmin: true,
        created_at: true,
        lastActiveAt: true,
        xpTotal: true,
      },
    });

    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    return res.json({ ok: true, user: mapUser(user) });
  } catch (err) {
    console.error("GET /api/admin/users/:id error:", err);
    return res.status(500).json({ ok: false, message: "Failed to fetch user" });
  }
});

/**
 * PATCH /api/admin/users/:id/access
 * Update has_access and/or tier_level for a user
 */
router.patch("/:id/access", authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, message: "Invalid user id" });
    }

    const { has_access, tier_level } = req.body;

    const data = {};
    if (typeof has_access === "boolean") data.has_access = has_access;
    if (typeof tier_level === "string" && tier_level.trim()) {
      data.tier_level = tier_level.trim();
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        ok: false,
        message: "No valid fields provided to update",
      });
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        has_access: true,
        tier_level: true,
        isAdmin: true,
        created_at: true,
        lastActiveAt: true,
        xpTotal: true,
      },
    });

    return res.json({
      ok: true,
      message: "User access updated",
      user: mapUser(updated),
    });
  } catch (err) {
    console.error("PATCH /api/admin/users/:id/access error:", err);

    if (err.code === "P2025") {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    return res
      .status(500)
      .json({ ok: false, message: "Failed to update user access" });
  }
});

export default router;
