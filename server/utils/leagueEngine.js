const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function runLeagueResetLogic() {
  const users = await prisma.user.findMany({
    where: { xpTotal: { gt: 0 } },
    orderBy: { xpTotal: "desc" },
  });

  const results = [];
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const rank = i + 1;

    // 1. Record the history
    await prisma.leagueHistory.create({
      data: {
        userId: user.id,
        leagueName: user.league || "BRONZE",
        rank: rank,
        xpEarned: user.xpTotal,
      },
    });

    // 2. Promote Top 3
    if (rank <= 3 && user.league === "BRONZE") {
      await prisma.user.update({
        where: { id: user.id },
        data: { league: "SILVER" },
      });
    }
    results.push({ username: user.username, rank });
  }
  return results;
}

module.exports = { runLeagueResetLogic };
