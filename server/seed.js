import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.lesson.createMany({
    data: [
      {
        title: "Lesson 1: Greetings",
        content: "Hello → வணக்கம்",
        isFree: true,
      },
      {
        title: "Lesson 2: Introductions",
        content: "My name is Aravind",
        isFree: true,
      },
      {
        title: "Lesson 3: Travel",
        content: "Where is the bus stop?",
        isFree: false,
      },
    ],
  });
  console.log("✅ Seeded lessons");
}

main().finally(() => prisma.$disconnect());
