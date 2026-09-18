import { DAYS } from "../prisma/seed/cefrGermanA1Seed.js";
import {
  assertValidCefrCurriculum,
} from "../services/cefrCurriculumValidator.js";

function countCurriculum(days) {
  let activities = 0;
  let items = 0;

  for (const day of days) {
    activities += day.activities?.length || 0;

    for (const activity of day.activities ?? []) {
      items += activity.items?.length || 0;
    }
  }

  return {
    days: days.length,
    activities,
    items,
  };
}

try {
  assertValidCefrCurriculum({
    days: DAYS,
  });

  const counts = countCurriculum(DAYS);

  console.log(
    "CEFR curriculum validation passed:",
    JSON.stringify(counts),
  );
} catch (error) {
  console.error(
    "CEFR curriculum validation failed:",
    error instanceof Error ? error.message : error,
  );

  process.exitCode = 1;
}
