// server/prisma/seed/practiceSeed.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding practice days & exercises...");

  /* -------------------------
     BEGINNER — DAY 1
  -------------------------- */

  const day1Beginner = await prisma.practiceDay.create({
    data: {
      level: "BEGINNER",
      dayNumber: 1,
      titleEn: "Day 1: Simple Sentences",
      titleTa: "நாள் 1: எளிய வாக்கியங்கள்",
      isActive: true,
    },
  });

  await prisma.practiceExercise.createMany({
    data: [
      {
        practiceDayId: day1Beginner.id,
        type: "FILL_BLANK",
        promptTa: "நான் ___ மாணவன்.",
        structureEn: "I ___ a student.",
        expected: { answer: "am" },
        xp: 20,
        orderIndex: 0,
      },
      {
        practiceDayId: day1Beginner.id,
        type: "TRANSLATION",
        promptTa: "நான் தினமும் ஆங்கிலம் பயிற்சி செய்கிறேன்",
        expected: { answer: "I practice English every day" },
        xp: 30,
        orderIndex: 1,
      },
    ],
  });

  /* -------------------------
     INTERMEDIATE — DAY 1
  -------------------------- */

  const day1Intermediate = await prisma.practiceDay.create({
    data: {
      level: "INTERMEDIATE",
      dayNumber: 1,
      titleEn: "Day 1: Sentence Flow",
      titleTa: "நாள் 1: வாக்கிய ஓட்டம்",
      isActive: true,
    },
  });

  await prisma.practiceExercise.createMany({
    data: [
      {
        practiceDayId: day1Intermediate.id,
        type: "TRANSLATION",
        promptTa: "அவன் அவளை நேற்று சந்தித்தான்",
        expected: { answer: "He met her yesterday" },
        xp: 30,
        orderIndex: 0,
      },
    ],
  });

  console.log("✅ Practice days & exercises seeded successfully");
}

main()
  .catch((e) => {
    console.error("❌ Practice seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
