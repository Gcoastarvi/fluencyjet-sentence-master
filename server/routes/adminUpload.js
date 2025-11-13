import express from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const router = express.Router();
const upload = multer({ dest: "uploads/" });

const JWT_SECRET = process.env.JWT_SECRET || "fluencyjet_secret_2025";

// ✅ Simple admin auth middleware (reuse same JWT check)
function authRequired(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token)
      return res.status(401).json({ ok: false, message: "Missing token" });

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res
      .status(401)
      .json({ ok: false, message: "Invalid or expired token" });
  }
}

/**
 * 📥 POST /api/admin/upload-csv
 * CSV format: ta,en
 */
router.post(
  "/upload-csv",
  authRequired,
  upload.single("file"),
  async (req, res) => {
    try {
      const filePath = req.file.path;
      const csvBuffer = fs.readFileSync(filePath);
      const rows = parse(csvBuffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      let count = 0;
      for (const row of rows) {
        const { ta, en } = row;
        if (!ta || !en) continue;

        await prisma.typingQuestion.upsert({
          where: { ta },
          update: { en },
          create: { ta, en, level: "beginner" },
        });
        count++;
      }

      fs.unlinkSync(filePath); // cleanup

      res.json({
        ok: true,
        message: `Uploaded ${count} quiz rows successfully!`,
      });
    } catch (err) {
      console.error("CSV upload error:", err);
      res
        .status(500)
        .json({
          ok: false,
          message: "Failed to upload CSV",
          error: err.message,
        });
    }
  },
);

export default router;
