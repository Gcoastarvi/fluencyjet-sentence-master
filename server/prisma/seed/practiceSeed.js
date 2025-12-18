import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding practice days & exercises...");

  // Clean existing data (safe now that tables exist)
  await prisma.practiceExercise.deleteMany();
  await prisma.practiceDay.deleteMany();

  // --- BEGINNER DAY 1 ---
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
        promptEn: "I ___ a student.",
        promptTa: "நான் ___ மாணவன்.",
        expected: "am",
        xpReward: 20,
      },
      {
        practiceDayId: day1Beginner.id,
        type: "TRANSLATION",
        promptTa: "நான் தினமும் ஆங்கிலம் பயிற்சி செய்கிறேன்",
        expected: "I practice English every day",
        xpReward: 30,
      },
    ],
  });

  // --- INTERMEDIATE DAY 1 ---
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
        type: "REORDER",
        promptEn: "to / English / want / speak / I",
        answer: "I want to speak English",
        xpReward: 30,
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
