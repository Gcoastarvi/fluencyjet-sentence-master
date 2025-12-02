import prisma from "../prisma/client.js";
import bcrypt from "bcryptjs";

async function main() {
  console.log("🌱 Seeding FluencyJet database...");

  // ----------------------------
  // ADMIN USER
  // ----------------------------
  const adminEmail = "admin@fluencyjet.com";
  const adminPass = await bcrypt.hash("admin123", 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: "Admin",
      email: adminEmail,
      password: adminPass,
      isAdmin: true,
      has_access: true,
      tier_level: "pro",
      xpTotal: 0,
      lastActiveAt: new Date(),
      progress: {
        create: {},
      },
      weekly: {
        create: {
          week_key: new Date(),
        },
      },
    },
  });

  console.log("✅ Admin account ready:", adminEmail);

  // ----------------------------
  // BASIC TYPING QUIZ SEED
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

  console.log("✅ Sample typing quiz inserted");

  console.log("🌱 Seeding completed");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
