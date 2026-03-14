const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function resetLeagues() {
  console.log("⏳ Starting Sunday League Reset...");

  try {
    // 1. Get the current Weekly Leaderboard
    // (This logic should match your aggregateXP logic)
    const topPerformers = await prisma.user.findMany({
      where: { xpTotal: { gt: 0 } },
      orderBy: { xpTotal: "desc" },
      take: 100, // Process top 100 users
    });

    for (let i = 0; i < topPerformers.length; i++) {
      const user = topPerformers[i];
      const rank = i + 1;

      // 2. Save to League History
      await prisma.leagueHistory.create({
        data: {
          userId: user.id,
          leagueName: user.league || "BRONZE",
          rank: rank,
          xpEarned: user.xpTotal, // Or specific weekly XP if tracked separately
        },
      });

      // 3. Promote Top 3 to Silver (if they were Bronze)
      if (rank <= 3 && user.league === "BRONZE") {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            league: "SILVER",
            // last_week_rank: rank // Useful for the animation we built!
          },
        });
        console.log(`🚀 Promoted ${user.username} to SILVER!`);
      }
    }

    // 4. Reset everyone's weekly progress/XP for the new week
    // Note: Use a separate field for 'weeklyXP' so 'xpTotal' stays permanent
    await prisma.user.updateMany({
      data: {
        // weeklyXP: 0
      },
    });

    console.log("✅ League Reset Complete!");
  } catch (error) {
    console.error("❌ Reset Failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

resetLeagues();
