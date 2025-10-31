import express from "express";
import { PrismaClient } from "@prisma/client";
const router = express.Router();
const prisma = new PrismaClient();

router.get("/check-db", async (_, res) => {
  const badges = await prisma.badge.findMany();
  const lessons = await prisma.lesson.findMany();
  res.json({ badges, lessons });
});

export default router;
