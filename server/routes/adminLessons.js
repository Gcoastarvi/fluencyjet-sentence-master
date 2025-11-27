// server/routes/adminLessons.js
import express from "express";
import { requireAdmin } from "../middleware/admin.js";
import { query } from "../db.js";

const router = express.Router();

function mapLesson(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    level: row.level,
    isPublished: row.is_published,
    xpReward: row.xp_reward,
    orderIndex: row.order_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function slugify(input) {
  return input
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * GET /api/admin/lessons
 * Optional query params:
 *  - level=beginner|intermediate|advanced
 *  - search=string (search in title)
 */
router.get("/", requireAdmin, async (req, res) => {
  try {
    const { level, search } = req.query;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (level) {
      conditions.push(`level = $${idx++}`);
      params.push(level);
    }

    if (search) {
      conditions.push(`title ILIKE $${idx++}`);
      params.push(`%${search}%`);
    }

    let sql = `
      SELECT *
      FROM lessons
    `;

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += `
      ORDER BY order_index ASC, id ASC
    `;

    const result = await query(sql, params);
    const lessons = result.rows.map(mapLesson);

    res.json({ lessons });
  } catch (err) {
    console.error("Error in GET /api/admin/lessons", err);
    res.status(500).json({ error: "Failed to fetch lessons" });
  }
});

/**
 * GET /api/admin/lessons/:id
 */
router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid lesson ID" });
    }

    const result = await query("SELECT * FROM lessons WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    res.json({ lesson: mapLesson(result.rows[0]) });
  } catch (err) {
    console.error("Error in GET /api/admin/lessons/:id", err);
    res.status(500).json({ error: "Failed to fetch lesson" });
  }
});

/**
 * POST /api/admin/lessons
 * Body: { title, description, level, isPublished, xpReward, orderIndex, slug? }
 */
router.post("/", requireAdmin, async (req, res) => {
  try {
    let {
      title,
      description = "",
      level = "beginner",
      isPublished = false,
      xpReward = 100,
      orderIndex = 0,
      slug,
    } = req.body;

    if (!title || typeof title !== "string") {
      return res.status(400).json({ error: "Title is required" });
    }

    if (!slug) {
      slug = slugify(title);
    } else {
      slug = slugify(slug);
    }

    const allowedLevels = ["beginner", "intermediate", "advanced"];
    if (!allowedLevels.includes(level)) {
      return res
        .status(400)
        .json({
          error: "Invalid level. Use beginner | intermediate | advanced",
        });
    }

    const result = await query(
      `
      INSERT INTO lessons (slug, title, description, level, is_published, xp_reward, order_index)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
      [slug, title, description, level, isPublished, xpReward, orderIndex],
    );

    res.status(201).json({ lesson: mapLesson(result.rows[0]) });
  } catch (err) {
    console.error("Error in POST /api/admin/lessons", err);

    if (err.code === "23505") {
      // unique violation (slug)
      return res
        .status(400)
        .json({ error: "Slug already exists. Use a different title/slug." });
    }

    res.status(500).json({ error: "Failed to create lesson" });
  }
});

/**
 * PUT /api/admin/lessons/:id
 * Body: { title?, description?, level?, isPublished?, xpReward?, orderIndex?, slug? }
 */
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid lesson ID" });
    }

    const {
      title,
      description,
      level,
      isPublished,
      xpReward,
      orderIndex,
      slug,
    } = req.body;

    // Fetch existing
    const existingRes = await query("SELECT * FROM lessons WHERE id = $1", [
      id,
    ]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: "Lesson not found" });
    }
    const existing = existingRes.rows[0];

    const newTitle = title ?? existing.title;
    const newDescription = description ?? existing.description;
    const newLevel = level ?? existing.level;
    const newIsPublished =
      typeof isPublished === "boolean" ? isPublished : existing.is_published;
    const newXpReward =
      typeof xpReward === "number" ? xpReward : existing.xp_reward;
    const newOrderIndex =
      typeof orderIndex === "number" ? orderIndex : existing.order_index;
    let newSlug = slug ? slugify(slug) : existing.slug;

    const allowedLevels = ["beginner", "intermediate", "advanced"];
    if (!allowedLevels.includes(newLevel)) {
      return res
        .status(400)
        .json({
          error: "Invalid level. Use beginner | intermediate | advanced",
        });
    }

    const updateRes = await query(
      `
      UPDATE lessons
      SET slug = $1,
          title = $2,
          description = $3,
          level = $4,
          is_published = $5,
          xp_reward = $6,
          order_index = $7
      WHERE id = $8
      RETURNING *
    `,
      [
        newSlug,
        newTitle,
        newDescription,
        newLevel,
        newIsPublished,
        newXpReward,
        newOrderIndex,
        id,
      ],
    );

    res.json({ lesson: mapLesson(updateRes.rows[0]) });
  } catch (err) {
    console.error("Error in PUT /api/admin/lessons/:id", err);

    if (err.code === "23505") {
      return res
        .status(400)
        .json({ error: "Slug already exists. Use a different slug." });
    }

    res.status(500).json({ error: "Failed to update lesson" });
  }
});

/**
 * DELETE /api/admin/lessons/:id
 */
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid lesson ID" });
    }

    const result = await query(
      "DELETE FROM lessons WHERE id = $1 RETURNING id",
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Error in DELETE /api/admin/lessons/:id", err);
    res.status(500).json({ error: "Failed to delete lesson" });
  }
});

export default router;
