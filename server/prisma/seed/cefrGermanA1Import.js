import prisma from "../../db/client.js";

import {
  LANGUAGE,
  PROGRAM,
  VERSION_KEY,
  DAYS,
} from "./cefrGermanA1Seed.js";

const PROD_CONFIRMATION = `german-a1:${VERSION_KEY}:production`;

function fail(message) {
  throw new Error(message);
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }

  return value;
}

function stableJson(value) {
  return JSON.stringify(canonicalize(value));
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(
      `${label} mismatch: expected ${JSON.stringify(
        expected,
      )}, found ${JSON.stringify(actual)}`,
    );
  }
}

function assertJsonEqual(actual, expected, label) {
  const normalizedActual = actual ?? null;
  const normalizedExpected = expected ?? null;

  if (stableJson(normalizedActual) !== stableJson(normalizedExpected)) {
    fail(
      `${label} mismatch: expected ${stableJson(
        normalizedExpected,
      )}, found ${stableJson(normalizedActual)}`,
    );
  }
}

function optionalJsonData(key, value) {
  return value === undefined ? {} : { [key]: value };
}

function sanitizedDatabaseTarget() {
  const raw = process.env.DATABASE_URL;

  if (!raw) return null;

  try {
    const url = new URL(raw);

    return {
      host: url.hostname,
      port: url.port || null,
      database: url.pathname.replace(/^\/+/, "") || null,
    };
  } catch {
    return {
      host: "UNPARSEABLE_DATABASE_URL",
      port: null,
      database: null,
    };
  }
}

function assertImportEnvironment() {
  const target = String(
    process.env.CEFR_GERMAN_A1_IMPORT_TARGET || "",
  ).toUpperCase();

  if (!["TEST", "PROD"].includes(target)) {
    fail(
      "CEFR_GERMAN_A1_IMPORT_TARGET must be explicitly set to TEST or PROD",
    );
  }

  if (!process.env.DATABASE_URL) {
    fail("DATABASE_URL is required");
  }

  if (target === "TEST") {
    if (!process.env.TEST_DATABASE_URL) {
      fail(
        "TEST import refused: TEST_DATABASE_URL is not set",
      );
    }

    if (process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
      fail(
        "TEST import refused: DATABASE_URL does not exactly match TEST_DATABASE_URL",
      );
    }
  }

  if (target === "PROD") {
    if (!process.env.PROD_DATABASE_URL) {
      fail(
        "PROD import refused: PROD_DATABASE_URL is not set",
      );
    }

    if (process.env.DATABASE_URL !== process.env.PROD_DATABASE_URL) {
      fail(
        "PROD import refused: DATABASE_URL does not exactly match PROD_DATABASE_URL",
      );
    }

    if (
      process.env.CEFR_GERMAN_A1_PROD_CONFIRM !==
      PROD_CONFIRMATION
    ) {
      fail(
        `PROD import refused: CEFR_GERMAN_A1_PROD_CONFIRM must equal ${PROD_CONFIRMATION}`,
      );
    }
  }

  return target;
}

async function ensureLanguage(tx) {
  const existing = await tx.language.findUnique({
    where: {
      code: LANGUAGE.code,
    },
  });

  if (existing) {
    assertEqual(
      existing.name,
      LANGUAGE.name,
      `Language ${LANGUAGE.code} name`,
    );

    return {
      record: existing,
      created: false,
    };
  }

  const created = await tx.language.create({
    data: {
      code: LANGUAGE.code,
      name: LANGUAGE.name,
    },
  });

  return {
    record: created,
    created: true,
  };
}

async function ensureProgram(tx, languageId) {
  const existing = await tx.program.findUnique({
    where: {
      slug: PROGRAM.slug,
    },
  });

  if (existing) {
    assertEqual(
      existing.languageId,
      languageId,
      `Program ${PROGRAM.slug} languageId`,
    );

    assertEqual(
      existing.name,
      PROGRAM.name,
      `Program ${PROGRAM.slug} name`,
    );

    assertEqual(
      existing.cefrLevel,
      PROGRAM.cefrLevel,
      `Program ${PROGRAM.slug} cefrLevel`,
    );

    return {
      record: existing,
      created: false,
    };
  }

  const created = await tx.program.create({
    data: {
      languageId,
      slug: PROGRAM.slug,
      name: PROGRAM.name,
      cefrLevel: PROGRAM.cefrLevel,
    },
  });

  return {
    record: created,
    created: true,
  };
}

async function ensureProgramVersion(tx, programId) {
  const existing = await tx.programVersion.findUnique({
    where: {
      programId_versionKey: {
        programId,
        versionKey: VERSION_KEY,
      },
    },
  });

  if (existing) {
    return {
      record: existing,
      created: false,
    };
  }

  const created = await tx.programVersion.create({
    data: {
      programId,
      versionKey: VERSION_KEY,
    },
  });

  return {
    record: created,
    created: true,
  };
}

async function ensureLearningDay(
  tx,
  programVersionId,
  manifestDay,
) {
  const existing = await tx.learningDay.findUnique({
    where: {
      programVersionId_dayNumber: {
        programVersionId,
        dayNumber: manifestDay.dayNumber,
      },
    },
  });

  if (existing) {
    assertEqual(
      existing.title,
      manifestDay.title,
      `Day ${manifestDay.dayNumber} title`,
    );

    assertEqual(
      existing.summary ?? null,
      manifestDay.summary ?? null,
      `Day ${manifestDay.dayNumber} summary`,
    );

    return {
      record: existing,
      created: false,
    };
  }

  const created = await tx.learningDay.create({
    data: {
      programVersionId,
      dayNumber: manifestDay.dayNumber,
      title: manifestDay.title,
      summary: manifestDay.summary ?? null,
    },
  });

  return {
    record: created,
    created: true,
  };
}

async function ensureActivity(
  tx,
  learningDayId,
  dayNumber,
  manifestActivity,
) {
  const [byKey, byOrder] = await Promise.all([
    tx.activity.findUnique({
      where: {
        learningDayId_key: {
          learningDayId,
          key: manifestActivity.key,
        },
      },
    }),
    tx.activity.findUnique({
      where: {
        learningDayId_orderIndex: {
          learningDayId,
          orderIndex: manifestActivity.orderIndex,
        },
      },
    }),
  ]);

  if (byKey && byOrder && byKey.id !== byOrder.id) {
    fail(
      `Day ${dayNumber} Activity collision: key ${manifestActivity.key} and orderIndex ${manifestActivity.orderIndex} belong to different records`,
    );
  }

  if (!byKey && byOrder) {
    fail(
      `Day ${dayNumber} Activity order collision: orderIndex ${manifestActivity.orderIndex} is already owned by key ${byOrder.key}`,
    );
  }

  if (byKey) {
    assertEqual(
      byKey.orderIndex,
      manifestActivity.orderIndex,
      `Day ${dayNumber}/${manifestActivity.key} orderIndex`,
    );

    assertEqual(
      byKey.activityType,
      manifestActivity.activityType,
      `Day ${dayNumber}/${manifestActivity.key} activityType`,
    );

    assertEqual(
      byKey.evaluationMode,
      manifestActivity.evaluationMode,
      `Day ${dayNumber}/${manifestActivity.key} evaluationMode`,
    );

    assertEqual(
      byKey.title,
      manifestActivity.title,
      `Day ${dayNumber}/${manifestActivity.key} title`,
    );

    assertJsonEqual(
      byKey.config,
      manifestActivity.config,
      `Day ${dayNumber}/${manifestActivity.key} config`,
    );

    assertJsonEqual(
      byKey.xpConfig,
      manifestActivity.xpConfig,
      `Day ${dayNumber}/${manifestActivity.key} xpConfig`,
    );

    return {
      record: byKey,
      created: false,
    };
  }

  const created = await tx.activity.create({
    data: {
      learningDayId,
      key: manifestActivity.key,
      activityType: manifestActivity.activityType,
      evaluationMode: manifestActivity.evaluationMode,
      title: manifestActivity.title,
      orderIndex: manifestActivity.orderIndex,
      ...optionalJsonData("config", manifestActivity.config),
      ...optionalJsonData("xpConfig", manifestActivity.xpConfig),
    },
  });

  return {
    record: created,
    created: true,
  };
}

async function ensureActivityItem(
  tx,
  activityId,
  dayNumber,
  activityKey,
  manifestItem,
) {
  const [byKey, byOrder] = await Promise.all([
    tx.activityItem.findUnique({
      where: {
        activityId_itemKey: {
          activityId,
          itemKey: manifestItem.itemKey,
        },
      },
    }),
    tx.activityItem.findUnique({
      where: {
        activityId_orderIndex: {
          activityId,
          orderIndex: manifestItem.orderIndex,
        },
      },
    }),
  ]);

  if (byKey && byOrder && byKey.id !== byOrder.id) {
    fail(
      `Day ${dayNumber}/${activityKey} item collision: key ${manifestItem.itemKey} and orderIndex ${manifestItem.orderIndex} belong to different records`,
    );
  }

  if (!byKey && byOrder) {
    fail(
      `Day ${dayNumber}/${activityKey} item order collision: orderIndex ${manifestItem.orderIndex} is already owned by key ${byOrder.itemKey}`,
    );
  }

  if (byKey) {
    assertEqual(
      byKey.orderIndex,
      manifestItem.orderIndex,
      `Day ${dayNumber}/${activityKey}/${manifestItem.itemKey} orderIndex`,
    );

    assertJsonEqual(
      byKey.prompt,
      manifestItem.prompt,
      `Day ${dayNumber}/${activityKey}/${manifestItem.itemKey} prompt`,
    );

    assertJsonEqual(
      byKey.payload,
      manifestItem.payload,
      `Day ${dayNumber}/${activityKey}/${manifestItem.itemKey} payload`,
    );

    assertJsonEqual(
      byKey.answerKey,
      manifestItem.answerKey,
      `Day ${dayNumber}/${activityKey}/${manifestItem.itemKey} answerKey`,
    );

    assertJsonEqual(
      byKey.hint,
      manifestItem.hint,
      `Day ${dayNumber}/${activityKey}/${manifestItem.itemKey} hint`,
    );

    assertJsonEqual(
      byKey.feedback,
      manifestItem.feedback,
      `Day ${dayNumber}/${activityKey}/${manifestItem.itemKey} feedback`,
    );

    return {
      record: byKey,
      created: false,
    };
  }

  const created = await tx.activityItem.create({
    data: {
      activityId,
      itemKey: manifestItem.itemKey,
      orderIndex: manifestItem.orderIndex,
      prompt: manifestItem.prompt,
      ...optionalJsonData("payload", manifestItem.payload),
      ...optionalJsonData("answerKey", manifestItem.answerKey),
      ...optionalJsonData("hint", manifestItem.hint),
      ...optionalJsonData("feedback", manifestItem.feedback),
    },
  });

  return {
    record: created,
    created: true,
  };
}

async function assertImportedCurriculum(
  tx,
  programVersionId,
) {
  const dayNumbers = DAYS.map((day) => day.dayNumber);

  const importedDays = await tx.learningDay.findMany({
    where: {
      programVersionId,
      dayNumber: {
        in: dayNumbers,
      },
    },
    orderBy: {
      dayNumber: "asc",
    },
    include: {
      activities: {
        orderBy: {
          orderIndex: "asc",
        },
        include: {
          items: {
            orderBy: {
              orderIndex: "asc",
            },
          },
        },
      },
    },
  });

  if (importedDays.length !== DAYS.length) {
    fail(
      `Post-import assertion failed: expected ${DAYS.length} challenge days, found ${importedDays.length}`,
    );
  }

  let activityCount = 0;
  let itemCount = 0;

  for (const manifestDay of DAYS) {
    const dbDay = importedDays.find(
      (day) => day.dayNumber === manifestDay.dayNumber,
    );

    if (!dbDay) {
      fail(
        `Post-import assertion failed: Day ${manifestDay.dayNumber} is missing`,
      );
    }

    if (dbDay.activities.length !== manifestDay.activities.length) {
      fail(
        `Post-import assertion failed: Day ${manifestDay.dayNumber} expected ${manifestDay.activities.length} Activities, found ${dbDay.activities.length}`,
      );
    }

    for (const manifestActivity of manifestDay.activities) {
      const dbActivity = dbDay.activities.find(
        (activity) => activity.key === manifestActivity.key,
      );

      if (!dbActivity) {
        fail(
          `Post-import assertion failed: Day ${manifestDay.dayNumber}/${manifestActivity.key} is missing`,
        );
      }

      if (dbActivity.items.length !== manifestActivity.items.length) {
        fail(
          `Post-import assertion failed: Day ${manifestDay.dayNumber}/${manifestActivity.key} expected ${manifestActivity.items.length} items, found ${dbActivity.items.length}`,
        );
      }

      activityCount += 1;
      itemCount += dbActivity.items.length;
    }
  }

  if (activityCount !== 29 || itemCount !== 97) {
    fail(
      `Post-import count assertion failed: ${JSON.stringify({
        activities: activityCount,
        items: itemCount,
      })}`,
    );
  }

  return {
    days: importedDays.length,
    activities: activityCount,
    items: itemCount,
  };
}

async function importGermanA1() {
  const target = assertImportEnvironment();
  const databaseTarget = sanitizedDatabaseTarget();

  console.log(
    "CEFR German A1 import target:",
    JSON.stringify({
      target,
      ...databaseTarget,
      programSlug: PROGRAM.slug,
      versionKey: VERSION_KEY,
    }),
  );

  const result = await prisma.$transaction(async (tx) => {
    const stats = {
      created: {
        languages: 0,
        programs: 0,
        programVersions: 0,
        learningDays: 0,
        activities: 0,
        activityItems: 0,
      },
      verified: {
        languages: 0,
        programs: 0,
        programVersions: 0,
        learningDays: 0,
        activities: 0,
        activityItems: 0,
      },
    };

    const languageResult = await ensureLanguage(tx);

    stats[languageResult.created ? "created" : "verified"].languages += 1;

    const programResult = await ensureProgram(
      tx,
      languageResult.record.id,
    );

    stats[programResult.created ? "created" : "verified"].programs += 1;

    const versionResult = await ensureProgramVersion(
      tx,
      programResult.record.id,
    );

    stats[
      versionResult.created ? "created" : "verified"
    ].programVersions += 1;

    for (const manifestDay of DAYS) {
      const dayResult = await ensureLearningDay(
        tx,
        versionResult.record.id,
        manifestDay,
      );

      stats[
        dayResult.created ? "created" : "verified"
      ].learningDays += 1;

      for (const manifestActivity of manifestDay.activities) {
        const activityResult = await ensureActivity(
          tx,
          dayResult.record.id,
          manifestDay.dayNumber,
          manifestActivity,
        );

        stats[
          activityResult.created ? "created" : "verified"
        ].activities += 1;

        for (const manifestItem of manifestActivity.items) {
          const itemResult = await ensureActivityItem(
            tx,
            activityResult.record.id,
            manifestDay.dayNumber,
            manifestActivity.key,
            manifestItem,
          );

          stats[
            itemResult.created ? "created" : "verified"
          ].activityItems += 1;
        }
      }
    }

    const assertions = await assertImportedCurriculum(
      tx,
      versionResult.record.id,
    );

    return {
      stats,
      assertions,
    };
  }, {
    maxWait: 10000,
    timeout: 60000,
  });

  console.log(
    "CEFR German A1 import complete:",
    JSON.stringify(result, null, 2),
  );
}

importGermanA1()
  .catch((error) => {
    console.error(
      "CEFR German A1 import failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
