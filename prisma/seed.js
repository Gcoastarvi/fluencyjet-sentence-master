import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Seed badges
  await prisma.badge.createMany({
    data: [
      { code: "bronze", name: "Bronze", threshold: 1000 },
      { code: "silver", name: "Silver", threshold: 5000 },
      { code: "gold", name: "Gold", threshold: 10000 },
      { code: "diamond", name: "Diamond", threshold: 50000 },
    ],
    skipDuplicates: true,
  });

  // Seed sample lessons
  await prisma.lesson.createMany({
    data: [
      {
        slug: "intro-1",
        title: "Welcome to FluencyJet",
        difficulty: "beginner",
        is_locked: false,
      },
      {
        slug: "root-words",
        title: "Root Words Practice",
        difficulty: "intermediate",
        is_locked: true,
      },
      {
        slug: "memory-tricks",
        title: "Memory Techniques Lesson",
        difficulty: "advanced",
        is_locked: true,
      },
    ],
    skipDuplicates: true,
  });

  console.log("✅ Seeded badges and lessons");
}

main().finally(async () => {
  await prisma.$disconnect();
});
