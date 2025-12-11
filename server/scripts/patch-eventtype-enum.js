// server/scripts/patch-eventtype-enum.js
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Keep this list in sync with what your API accepts
const ENUM_NAME = "EventType";
const DESIRED_VALUES = [
  "QUESTION_CORRECT",
  "QUIZ_COMPLETED",
  "LESSON_COMPLETED",
  "DAILY_STREAK",
  "BADGE_UNLOCK",
  "ADMIN_ADJUST",
  "GENERIC",
];

async function main() {
  console.log(`Patching enum ${ENUM_NAME}…`);

  // Get current labels
  const rows = await prisma.$queryRawUnsafe(`
    SELECT e.enumlabel AS val
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = '${ENUM_NAME}'
    ORDER BY e.enumsortorder;
  `);
  const current = rows.map((r) => r.val);
  const toAdd = DESIRED_VALUES.filter((v) => !current.includes(v));

  if (toAdd.length === 0) {
    console.log("No changes needed. Current values:");
    console.table(current.map((v) => ({ val: v })));
    return;
  }

  // Add values one-by-one (each as a single statement)
  for (const val of toAdd) {
    console.log(`Adding '${val}'…`);
    await prisma.$executeRawUnsafe(
      `ALTER TYPE "${ENUM_NAME}" ADD VALUE '${val}';`,
    );
  }

  // Show final state
  const rowsAfter = await prisma.$queryRawUnsafe(`
    SELECT e.enumlabel AS val
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = '${ENUM_NAME}'
    ORDER BY e.enumsortorder;
  `);
  console.log("Done. Final values:");
  console.table(rowsAfter.map((r) => ({ val: r.val })));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
