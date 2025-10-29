// server/utils/awardBadges.js
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * Get a user's total XP (safe even if they have no events).
 */
async function getUserTotalXp(userId) {
  const agg = await prisma.xpEvent.aggregate({
    _sum: { xp_delta: true },
    where: { user_id: userId },
  });
  return agg._sum.xp_delta || 0;
}

/**
 * Award a specific badge (by its unique `code`) to a user, if not owned.
 * Returns a normalized result describing what happened.
 */
export async function awardBadge(userId, badgeCode) {
  try {
    const badge = await prisma.badge.findUnique({
      where: { code: badgeCode },
      select: { id: true, code: true, title: true },
    });

    if (!badge) {
      return { ok: false, reason: "badge_not_found", badgeCode };
    }

    // Unique constraint on (user_id, badge_id) in your schema makes this idempotent.
    const created = await prisma.userBadge.createMany({
      data: [{ user_id: userId, badge_id: badge.id }],
      skipDuplicates: true, // prevents error if it already exists
    });

    if (created.count === 0) {
      return { ok: true, alreadyHad: true, badge };
    }
    return { ok: true, awarded: true, badge };
  } catch (err) {
    console.error("awardBadge error:", err);
    return { ok: false, reason: "error", error: err.message, badgeCode };
  }
}

/**
 * Award any threshold-based badges the user qualifies for
 * (e.g., badges with `threshold <= totalXP`) that they don't already have.
 *
 * Call this immediately after you write XP events, lesson completions, etc.
 * Returns: { ok, xp, awarded: [badgeCode...], count }
 */
export async function awardBadgesForUser(userId) {
  try {
    // Ensure correctness under concurrent requests
    const result = await prisma.$transaction(async (tx) => {
      const xp = await getUserTotalXp(userId);

      // Find all badges whose threshold has been reached
      // and that the user doesn't already own.
      const eligible = await tx.badge.findMany({
        where: {
          threshold: { lte: xp }, // numeric column in your Badge table
          user_badges: { none: { user_id: userId } }, // relation name as per your schema
        },
        select: { id: true, code: true },
      });

      if (eligible.length === 0) {
        return { xp, awardedCodes: [], count: 0 };
      }

      // Create user_badge links; skipDuplicates guards against race conditions.
      await tx.userBadge.createMany({
        data: eligible.map((b) => ({ user_id: userId, badge_id: b.id })),
        skipDuplicates: true,
      });

      return {
        xp,
        awardedCodes: eligible.map((b) => b.code),
        count: eligible.length,
      };
    });

    if (result.count > 0) {
      console.log(
        `🏅 Awarded ${result.count} badge(s) to user ${userId}: ${result.awardedCodes.join(", ")}`,
      );
    }

    return {
      ok: true,
      xp: result.xp,
      awarded: result.awardedCodes,
      count: result.count,
    };
  } catch (err) {
    console.error("❌ Error awarding badges:", err);
    return { ok: false, error: err.message, awarded: [], count: 0 };
  }
}
