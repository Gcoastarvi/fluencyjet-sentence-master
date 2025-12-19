// server/prisma/seed/diagnosticSeed.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function pickAnyLessonId() {
  // Try to find a “diagnostic-like” lesson first (if those fields exist),
  // otherwise fall back to the first lesson in DB.
  let lesson = null;

  try {
    lesson = await prisma.lesson.findFirst({
      where: { title: { contains: "Diagnostic", mode: "insensitive" } },
      select: { id: true },
    });
  } catch (e) {
    // title field might not exist in your Lesson model — ignore
  }

  if (!lesson) {
    try {
      lesson = await prisma.lesson.findFirst({ select: { id: true } });
    } catch (e) {
      // If lesson model/table is not present, this will throw
      lesson = null;
    }
  }

  if (!lesson?.id) {
    throw new Error(
      "No Lesson found in DB. Seed/create at least one Lesson first (Quiz.lessonId is required).",
    );
  }

  return lesson.id;
}

async function main() {
  console.log("🌱 Seeding DIAGNOSTIC quizzes into Quiz table...");

  const lessonId = await pickAnyLessonId();
  console.log("✅ Using lessonId =", lessonId);

  // Clean old DIAGNOSTIC rows to avoid duplicates
  await prisma.quiz.deleteMany({ where: { type: "DIAGNOSTIC" } });

  const rows = [
    {
      lessonId,
      type: "DIAGNOSTIC",
      question: "Choose the correct word: I ___ a student.",
      prompt: null,
      data: {
        kind: "MCQ",
        options: ["am", "is", "are"],
        correctAnswer: "am",
        tag: "grammar",
      },
      xpReward: 0,
    },
    {
      lessonId,
      type: "DIAGNOSTIC",
      question: "Choose the correct word: She ___ to school every day.",
      prompt: null,
      data: {
        kind: "MCQ",
        options: ["go", "goes", "going"],
        correctAnswer: "goes",
        tag: "grammar",
      },
      xpReward: 0,
    },
    {
      lessonId,
      type: "DIAGNOSTIC",
      question: "Pick the best sentence:",
      prompt: null,
      data: {
        kind: "MCQ",
        options: [
          "He don’t like coffee.",
          "He doesn’t like coffee.",
          "He not like coffee.",
        ],
        correctAnswer: "He doesn’t like coffee.",
        tag: "grammar",
      },
      xpReward: 0,
    },
    {
      lessonId,
      type: "DIAGNOSTIC",
      question: "Choose the correct preposition: I am good ___ English.",
      prompt: null,
      data: {
        kind: "MCQ",
        options: ["in", "at", "on"],
        correctAnswer: "at",
        tag: "prepositions",
      },
      xpReward: 0,
    },
    {
      lessonId,
      type: "DIAGNOSTIC",
      question: "Choose the correct tense: Yesterday, I ___ a movie.",
      prompt: null,
      data: {
        kind: "MCQ",
        options: ["watch", "watched", "watching"],
        correctAnswer: "watched",
        tag: "tenses",
      },
      xpReward: 0,
    },
    {
      lessonId,
      type: "DIAGNOSTIC",
      question: "Pick the correct question form:",
      prompt: null,
      data: {
        kind: "MCQ",
        options: [
          "Where you are going?",
          "Where are you going?",
          "Where going you?",
        ],
        correctAnswer: "Where are you going?",
        tag: "sentence_flow",
      },
      xpReward: 0,
    },
  ];

  const result = await prisma.quiz.createMany({ data: rows });
  console.log("✅ DIAGNOSTIC quizzes seeded:", result.count);
}

main()
  .catch((e) => {
    console.error("❌ diagnosticSeed failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
