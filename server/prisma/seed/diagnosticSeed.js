// server/prisma/seed/diagnosticSeed.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding diagnostic lesson + questions...");

  // 1) Create/Upsert the Lesson (this is where slug belongs)
  const lesson = await prisma.lesson.upsert({
    where: { slug: "english-diagnostic" },
    update: {
      title: "English Diagnostic Quiz",
      description: "Find your English level in 5 minutes",
      difficulty: "beginner",
      isLocked: false,
    },
    create: {
      slug: "english-diagnostic",
      title: "English Diagnostic Quiz",
      description: "Find your English level in 5 minutes",
      difficulty: "beginner",
      isLocked: false,
    },
  });

  // 2) Make seeding idempotent: wipe old diagnostic questions for this lesson
  await prisma.quiz.deleteMany({
    where: { lessonId: lesson.id, type: "diagnostic" },
  });

  // 3) Insert 6 questions (Quiz rows = question rows in your schema)
  const questions = [
    {
      question: "Arrange the words to make a correct sentence: (I / to / go / school)",
      prompt: "Sentence ordering",
      data: {
        kind: "order",
        correct: "I go to school",
        tokens: ["I", "to", "go", "school"],
        weaknessTags: ["word_order", "sentence_structure"],
        levelHint: "BEGINNER",
      },
      xpReward: 0,
    },
    {
      question: "Fill in the blank: She ___ to office every day.",
      prompt: "Fill in the blank",
      data: {
        kind: "fill_blank",
        answer: "goes",
        weaknessTags: ["grammar", "subject_verb_agreement"],
        levelHint: "BEGINNER",
      },
      xpReward: 0,
    },
    {
      question: "Choose the correct sentence: (Tamil mistake pattern)",
      prompt: "Common mistake correction",
      data: {
        kind: "mcq",
        options: ["He is having two brothers", "He has two brothers"],
        answer: "He has two brothers",
        weaknessTags: ["grammar", "tamil_influence"],
        levelHint: "BEGINNER",
      },
      xpReward: 0,
    },
    {
      question: "Reorder to form a natural sentence: (Can / you / help / me / please)",
      prompt: "Sentence ordering",
      data: {
        kind: "order",
        correct: "Can you please help me",
        tokens: ["Can", "you", "help", "me", "please"],
        weaknessTags: ["fluency", "word_order"],
        levelHint: "INTERMEDIATE",
      },
      xpReward: 0,
    },
    {
      question: "Fill in the blank: If I ___ earlier, I would have caught the bus.",
      prompt: "Grammar (conditional)",
      data: {
        kind: "fill_blank",
        answer: "had left",
        weaknessTags: ["grammar", "tense"],
        levelHint: "INTERMEDIATE",
      },
      xpReward: 0,
    },
    {
      question: "Pick the most natural sentence:",
      prompt: "Fluency choice",
      data: {
        kind: "mcq",
        options: [
          "I am knowing the answer",
          "I know the answer",
          "I knew the answer now",
        ],
        answer: "I know the answer",
        weaknessTags: ["grammar", "tamil_influence"],
        levelHint: "INTERMEDIATE",
      },
      xpReward: 0,
    },
  ];

  await prisma.quiz.createMany({
    data: questions.map((q) => ({
      lessonId: lesson.id,
      question: q.question,
      type: "diagnostic",
      prompt: q.prompt,
      data: q.data,
      xpReward: q.xpReward ?? 0,
    })),
  });

  console.log("✅ Diagnostic lesson + questions seeded");
}

main()
  .catch((e) => {
    console.error("❌ Diagnostic seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
