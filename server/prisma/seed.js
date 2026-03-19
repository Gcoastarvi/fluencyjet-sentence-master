import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import bcrypt from "bcryptjs";

async function main() {
  console.log("🌱 Seeding FluencyJet database...");

  const saltRounds = 10;
  const commonPassword = await bcrypt.hash("admin123", saltRounds);

  // ----------------------------
  // 1. ADMIN & TEST USERS
  // ----------------------------
  const usersToSeed = [
    {
      email: "admin@fluencyjet.com",
      username: "Admin", // 🎯 Changed from 'name'
      isAdmin: true,
      xpTotal: 0,
      league: "GOLD",
      daily_streak: 100,
    },
    {
      email: "mango@gmail.com",
      username: "MangoMaster",
      isAdmin: false,
      xpTotal: 1250,
      league: "BRONZE",
      daily_streak: 5,
    },
    {
      email: "pro@test.com",
      username: "SentencePro",
      isAdmin: false,
      xpTotal: 2500,
      league: "BRONZE",
      daily_streak: 12,
    },
    {
      email: "alpha@test.com",
      username: "AlphaZero",
      isAdmin: false,
      xpTotal: 900,
      league: "BRONZE",
      daily_streak: 2,
    },
  ];

  for (const u of usersToSeed) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        ...u,
        password: commonPassword,
        has_access: true,
        tier_level: u.isAdmin ? "pro" : "free",
        lastActiveAt: new Date(),
      },
    });
  }
  console.log("✅ Users and Competitors seeded");

  // ----------------------------
  // 2. TYPING QUIZ SEED (Preserved)
  // ----------------------------
  const sampleData = [
    {
      ta: "நான் பள்ளிக்கு செல்கிறேன்",
      en: "I am going to school",
      lesson: "L1",
    },
    {
      ta: "அவர் புத்தகம் படிக்கிறார்",
      en: "He is reading a book",
      lesson: "L1",
    },
  ];

  await prisma.typingQuiz.createMany({
    data: sampleData,
    skipDuplicates: true,
  });

  // ----------------------------
  // 3. XP EVENTS (Weekly/Today Data)
  // ----------------------------
  console.log("📊 Generating weekly XP events...");

  // Get the IDs of the users we just created
  const allUsers = await prisma.user.findMany({ select: { id: true } });

  const xpEvents = allUsers.map((u) => ({
    user_id: u.id,
    xp_delta: Math.floor(Math.random() * 500) + 100, // Random XP between 100-600
    type: "LESSON_COMPLETED",
    created_at: new Date(), // This ensures they show up for 'Today' and 'Weekly'
  }));

  // We use a loop or createMany to avoid the unique constraint if you run it twice
  for (const event of xpEvents) {
    await prisma.xpEvent.upsert({
      where: {
        user_id_type: {
          user_id: event.user_id,
          type: event.type,
        },
      },
      update: {
        xp_delta: event.xp_delta,
        created_at: new Date(),
      },
      create: event,
    });
  }

  console.log("✅ Weekly XP events synchronized");

  console.log("✅ Sample typing quiz inserted");
  console.log("🏁 Seeding completed successfully!");
}

// ----------------------------
// 4. FOUNDATION LESSONS (The Mastery Path)
// ----------------------------
console.log("📚 Seeding Foundation Lessons...");
// 🎯 Cleaned to match your strict Prisma Schema
const foundationLessons = [
  { slug: "basic-sentence", title: "Basic Sentence Structure" },
  { slug: "subject-verb", title: "Subject-Verb Order" },
  { slug: "daily-phrases", title: "Common Daily Phrases" },
  { slug: "action-verbs", title: "Action Verbs Intro" },
  { slug: "strategy-planning", title: "Planning a Strategy" },
];

for (const lesson of foundationLessons) {
  await prisma.lesson.upsert({
    where: { slug: lesson.slug },
    update: {},
    create: {
      ...lesson,
      description: "Foundation practice",
      difficulty: "Beginner",
      isLocked: false,
      // ❌ REMOVED xpReward since schema rejected it
    },
  });
}
console.log("✅ 5 Foundation Lessons added to the Path");

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
