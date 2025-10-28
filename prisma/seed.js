// prisma/seed.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // --- 1️⃣ Clear existing data (for fresh start) ---
  await prisma.userBadge.deleteMany();
  await prisma.badge.deleteMany();
  await prisma.lesson.deleteMany();

  // --- 2️⃣ Seed Lessons ---
  const lessons = [
    {
      slug: "lesson-1",
      title: "Basic Greetings",
      difficulty: "beginner",
      is_locked: false,
    },
    {
      slug: "lesson-2",
      title: "Daily Routine",
      difficulty: "beginner",
      is_locked: false,
    },
    { slug: "lesson-3", title: "Food & Meals", difficulty: "intermediate" },
    {
      slug: "lesson-4",
      title: "Shopping & Bargaining",
      difficulty: "intermediate",
    },
    { slug: "lesson-5", title: "Travel & Directions", difficulty: "advanced" },
  ];

  await prisma.lesson.createMany({ data: lessons });
  console.log(`✅ Seeded ${lessons.length} lessons`);

  // --- 3️⃣ Seed Badges ---
  const badges = [
    { code: "BRONZE_STARTER", name: "Bronze Starter", threshold: 1000 },
    { code: "SILVER_ACHIEVER", name: "Silver Achiever", threshold: 5000 },
    { code: "GOLD_MASTER", name: "Gold Master", threshold: 10000 },
    { code: "PLATINUM_ELITE", name: "Platinum Elite", threshold: 25000 },
    { code: "DIAMOND_LEGEND", name: "Diamond Legend", threshold: 50000 },
  ];

  await prisma.badge.createMany({ data: badges });
  console.log(`🏅 Seeded ${badges.length} badges`);

  console.log("🌟 Seeding completed successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seeding failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
