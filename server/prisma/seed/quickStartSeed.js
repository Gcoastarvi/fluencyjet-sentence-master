import { PrismaClient } from "@prisma/client";

import { QUICK_START_DAY_NUMBER } from "../../config/quickStart.js";

const prisma = new PrismaClient();

const QUICK_START_TITLE = "FluencyJet Quick Start";
const QUICK_START_TITLE_TA = "ஃப்ளூயன்ஸிஜெட் விரைவு தொடக்கம்";
const SOURCE_KEY_PREFIX = `quick-start:${QUICK_START_DAY_NUMBER}:`;

const SENTENCES = [
  {
    english: "I am learning English.",
    tamil: "நான் ஆங்கிலம் கற்றுக்கொண்டிருக்கிறேன்.",
  },
  {
    english: "I am ready to practise.",
    tamil: "நான் பயிற்சி செய்யத் தயாராக இருக்கிறேன்.",
  },
  {
    english: "I have a clear goal.",
    tamil: "எனக்கு ஒரு தெளிவான இலக்கு உள்ளது.",
  },
  {
    english: "I have time to improve.",
    tamil: "முன்னேற எனக்கு நேரம் உள்ளது.",
  },
  {
    english: "I want to speak confidently.",
    tamil: "நான் தன்னம்பிக்கையுடன் பேச விரும்புகிறேன்.",
  },
  {
    english: "I want to make sentences faster.",
    tamil: "நான் வாக்கியங்களை வேகமாக உருவாக்க விரும்புகிறேன்.",
  },
  {
    english: "I need daily practice.",
    tamil: "எனக்கு தினசரி பயிற்சி தேவை.",
  },
  {
    english: "I need simple guidance.",
    tamil: "எனக்கு எளிய வழிகாட்டுதல் தேவை.",
  },
  {
    english: "I can learn step by step.",
    tamil: "நான் படிப்படியாகக் கற்றுக்கொள்ள முடியும்.",
  },
  {
    english: "I can speak better with practice.",
    tamil: "பயிற்சியால் நான் இன்னும் நன்றாகப் பேச முடியும்.",
  },
];

const MODES = [
  { mode: "reorder", type: "DRAG_DROP", xp: 100, includeWords: true },
  { mode: "typing", type: "MAKE_SENTENCE", xp: 150, includeWords: true },
  { mode: "audio", type: "TRANSLATE", xp: 150, includeWords: false },
];

function sourceKey(mode, orderIndex) {
  return `${SOURCE_KEY_PREFIX}${mode}:${orderIndex}`;
}

function isOwnedExercise(exercise) {
  const key = String(exercise?.expected?.sourceKey || "");
  return key.startsWith(SOURCE_KEY_PREFIX);
}

function buildExercises(practiceDayId) {
  return MODES.flatMap(({ mode, type, xp, includeWords }) =>
    SENTENCES.map(({ english, tamil }, index) => {
      const orderIndex = index + 1;
      const expected = {
        mode,
        answer: english,
        sourceKey: sourceKey(mode, orderIndex),
        ...(includeWords
          ? { words: english.trim().split(/\s+/).filter(Boolean) }
          : {}),
      };

      return {
        practiceDayId,
        type,
        promptTa: tamil,
        expected,
        xp,
        orderIndex,
      };
    }),
  );
}

async function seedQuickStart() {
  await prisma.$transaction(async (tx) => {
    const [daysAtNumber, lessonCollision] = await Promise.all([
      tx.practiceDay.findMany({
        where: { dayNumber: QUICK_START_DAY_NUMBER },
        include: { exercises: true },
      }),
      tx.lesson.findUnique({
        where: { id: QUICK_START_DAY_NUMBER },
        select: { id: true, title: true, slug: true },
      }),
    ]);

    if (lessonCollision) {
      throw new Error(
        `Quick Start collision: Lesson ${QUICK_START_DAY_NUMBER} already exists`,
      );
    }

    if (daysAtNumber.length > 1) {
      throw new Error(
        `Quick Start collision: multiple PracticeDay records use ${QUICK_START_DAY_NUMBER}`,
      );
    }

    const existingDay = daysAtNumber[0] || null;
    if (
      existingDay &&
      (existingDay.level !== "BEGINNER" ||
        existingDay.titleEn !== QUICK_START_TITLE)
    ) {
      throw new Error(
        `Quick Start collision: PracticeDay ${QUICK_START_DAY_NUMBER} is not owned by this seed`,
      );
    }

    if (existingDay?.exercises?.some((exercise) => !isOwnedExercise(exercise))) {
      throw new Error(
        `Quick Start ownership check failed: PracticeDay ${QUICK_START_DAY_NUMBER} contains an unowned exercise`,
      );
    }

    const day = existingDay
      ? await tx.practiceDay.update({
          where: { id: existingDay.id },
          data: {
            titleTa: QUICK_START_TITLE_TA,
            isActive: true,
          },
        })
      : await tx.practiceDay.create({
          data: {
            level: "BEGINNER",
            dayNumber: QUICK_START_DAY_NUMBER,
            titleEn: QUICK_START_TITLE,
            titleTa: QUICK_START_TITLE_TA,
            isActive: true,
          },
        });

    await tx.practiceExercise.deleteMany({
      where: { practiceDayId: day.id },
    });

    await tx.practiceExercise.createMany({
      data: buildExercises(day.id),
    });

    const [dayCount, lessonAfter, exercises] = await Promise.all([
      tx.practiceDay.count({
        where: { dayNumber: QUICK_START_DAY_NUMBER },
      }),
      tx.lesson.findUnique({
        where: { id: QUICK_START_DAY_NUMBER },
        select: { id: true },
      }),
      tx.practiceExercise.findMany({
        where: { practiceDayId: day.id },
        select: { expected: true },
      }),
    ]);

    const counts = exercises.reduce(
      (result, exercise) => {
        const mode = String(exercise?.expected?.mode || "").toLowerCase();
        if (Object.hasOwn(result, mode)) result[mode] += 1;
        return result;
      },
      { reorder: 0, typing: 0, audio: 0 },
    );

    if (
      dayCount !== 1 ||
      lessonAfter ||
      exercises.length !== 30 ||
      counts.reorder !== 10 ||
      counts.typing !== 10 ||
      counts.audio !== 10
    ) {
      throw new Error(
        `Quick Start post-seed assertion failed: ${JSON.stringify({
          dayCount,
          lessonCreated: Boolean(lessonAfter),
          total: exercises.length,
          counts,
        })}`,
      );
    }
  });

  console.log(
    `Seeded ${QUICK_START_TITLE} at PracticeDay ${QUICK_START_DAY_NUMBER}`,
  );
}

seedQuickStart()
  .catch((error) => {
    console.error("Quick Start seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

