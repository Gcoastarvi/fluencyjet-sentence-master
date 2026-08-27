/**
 * Real PostgreSQL coverage for the Block A learner/product serialization
 * invariant. All writes use TEST_DATABASE_URL and no provider is imported.
 */
import crypto from "crypto";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { PrismaClient } from "@prisma/client";
import { reconcileLesson1SignupReminder } from "../lib/whatsappIdentity.js";
import {
  LEARNING_PATH_DISCOVERY_REMINDER,
  LEARNING_PATH_EXPLORED,
  LESSON1_OPENED,
  LESSON1_PRACTICE_COMPLETED,
  LESSON1_SIGNUP_REMINDER,
  LESSON1_WATCH_REMINDER,
  SENTENCE_MASTER_PRODUCT_KEY,
  acquireUserJourneyLock,
  recordBlockAJourneyMilestone,
  recordPracticeCompletionTransition,
} from "../lib/whatsappJourney.js";

jest.setTimeout(45_000);

function fingerprint(connectionString) {
  const parsed = new URL(connectionString);
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        protocol: parsed.protocol,
        host: parsed.hostname.toLowerCase(),
        port: parsed.port || "5432",
        database: decodeURIComponent(parsed.pathname).replace(/^\/+/, ""),
      }),
    )
    .digest("hex");
}

const testDatabaseUrl = String(process.env.TEST_DATABASE_URL || "").trim();
const productionDatabaseUrl = String(process.env.DATABASE_URL || "").trim();

if (!testDatabaseUrl || !productionDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL and DATABASE_URL are required for isolation verification.",
  );
}

if (fingerprint(testDatabaseUrl) === fingerprint(productionDatabaseUrl)) {
  throw new Error("TEST_DATABASE_URL must not target DATABASE_URL.");
}

const control = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});
const progressClient = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});
const signupClient = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});
const journeyClient = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});

const runToken = crypto.randomInt(100_000_000, 999_999_999).toString();
let user;

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function applyProgress(client, incomingCompleted, hooks = {}) {
  return client.$transaction(async (tx) => {
    await acquireUserJourneyLock(
      tx,
      user.id,
      SENTENCE_MASTER_PRODUCT_KEY,
    );
    hooks.locked?.();
    await hooks.wait?.();

    const existing = await tx.lessonModeProgress.findUnique({
      where: {
        userId_lessonId_mode: {
          userId: String(user.id),
          lessonId: 1,
          mode: "reorder",
        },
      },
    });
    const previousCompleted = Number(existing?.completed || 0);
    const nextCompleted = Math.max(previousCompleted, incomingCompleted);
    const saved = await tx.lessonModeProgress.upsert({
      where: {
        userId_lessonId_mode: {
          userId: String(user.id),
          lessonId: 1,
          mode: "reorder",
        },
      },
      update: { completed: nextCompleted, total: 20 },
      create: {
        userId: String(user.id),
        lessonId: 1,
        mode: "reorder",
        completed: nextCompleted,
        total: 20,
      },
    });

    await recordPracticeCompletionTransition({
      transaction: tx,
      userId: user.id,
      previousCompleted,
      nextCompleted: saved.completed,
      occurredAt: new Date(),
    });
  }, {
    maxWait: 5_000,
    timeout: 15_000,
  });
}

beforeAll(async () => {
  await Promise.all([
    control.$connect(),
    progressClient.$connect(),
    signupClient.$connect(),
    journeyClient.$connect(),
  ]);

  const number = `+1994${runToken}`;
  user = await control.user.create({
    data: {
      name: "Block A Concurrency User",
      email: `block-a-${runToken}@example.test`,
      password: "not-a-real-password",
      whatsapp_number: number,
      whatsapp_number_normalized: number,
      whatsapp_consent: true,
      whatsapp_consent_at: new Date(),
      has_access: false,
    },
  });
  await control.lessonModeProgress.create({
    data: {
      userId: String(user.id),
      lessonId: 1,
      mode: "reorder",
      completed: 9,
      total: 20,
    },
  });
  await control.automationEvent.create({
    data: {
      userId: user.id,
      productKey: SENTENCE_MASTER_PRODUCT_KEY,
      eventType: LESSON1_SIGNUP_REMINDER,
      status: "PENDING",
      destinationNumberNormalized: number,
      scheduledAt: new Date(Date.now() + 60_000),
    },
  });
});

afterAll(async () => {
  if (user) {
    await control.automationEvent.deleteMany({ where: { userId: user.id } });
    await control.userJourneyMilestone.deleteMany({
      where: { userId: user.id },
    });
    await control.lessonModeProgress.deleteMany({
      where: { userId: String(user.id) },
    });
    await control.user.deleteMany({ where: { id: user.id } });
  }
  await Promise.all([
    control.$disconnect(),
    progressClient.$disconnect(),
    signupClient.$disconnect(),
    journeyClient.$disconnect(),
  ]);
});

describe("Block A PostgreSQL journey concurrency", () => {
  test("overlapping progress and signup reconciliation cannot revive signup or duplicate milestones/reminders", async () => {
    const locked = deferred();
    const release = deferred();

    const firstProgress = applyProgress(progressClient, 10, {
      locked: locked.resolve,
      wait: () => release.promise,
    });
    await locked.promise;

    const signupRace = reconcileLesson1SignupReminder({
      prisma: signupClient,
      userId: user.id,
      whatsappConsent: true,
      whatsappNumber: user.whatsapp_number,
      whatsappNumberNormalized: user.whatsapp_number_normalized,
    });
    const repeatedProgress = applyProgress(journeyClient, 10);

    release.resolve();
    await Promise.all([firstProgress, signupRace, repeatedProgress]);

    const [milestones, watches, activeSignups] = await Promise.all([
      control.userJourneyMilestone.count({
        where: {
          userId: user.id,
          productKey: SENTENCE_MASTER_PRODUCT_KEY,
          milestoneType: LESSON1_PRACTICE_COMPLETED,
        },
      }),
      control.automationEvent.count({
        where: {
          userId: user.id,
          productKey: SENTENCE_MASTER_PRODUCT_KEY,
          eventType: LESSON1_WATCH_REMINDER,
        },
      }),
      control.automationEvent.count({
        where: {
          userId: user.id,
          productKey: SENTENCE_MASTER_PRODUCT_KEY,
          eventType: LESSON1_SIGNUP_REMINDER,
          status: { in: ["PENDING", "SENDING"] },
        },
      }),
    ]);

    expect(milestones).toBe(1);
    expect(watches).toBe(1);
    expect(activeSignups).toBe(0);
  });

  test("repeated opens create one discovery and exploration cancels it", async () => {
    await Promise.all([
      recordBlockAJourneyMilestone({
        database: progressClient,
        userId: user.id,
        milestoneType: LESSON1_OPENED,
      }),
      recordBlockAJourneyMilestone({
        database: journeyClient,
        userId: user.id,
        milestoneType: LESSON1_OPENED,
      }),
    ]);

    const [activeWatches, openMilestones, discoveries] = await Promise.all([
      control.automationEvent.count({
        where: {
          userId: user.id,
          eventType: LESSON1_WATCH_REMINDER,
          status: "PENDING",
        },
      }),
      control.userJourneyMilestone.count({
        where: {
          userId: user.id,
          milestoneType: LESSON1_OPENED,
        },
      }),
      control.automationEvent.count({
        where: {
          userId: user.id,
          eventType: LEARNING_PATH_DISCOVERY_REMINDER,
        },
      }),
    ]);

    expect(activeWatches).toBe(0);
    expect(openMilestones).toBe(1);
    expect(discoveries).toBe(1);

    await Promise.all([
      recordBlockAJourneyMilestone({
        database: progressClient,
        userId: user.id,
        milestoneType: LEARNING_PATH_EXPLORED,
      }),
      recordBlockAJourneyMilestone({
        database: journeyClient,
        userId: user.id,
        milestoneType: LEARNING_PATH_EXPLORED,
      }),
    ]);

    const [explorationMilestones, activeDiscoveries] = await Promise.all([
      control.userJourneyMilestone.count({
        where: {
          userId: user.id,
          milestoneType: LEARNING_PATH_EXPLORED,
        },
      }),
      control.automationEvent.count({
        where: {
          userId: user.id,
          eventType: LEARNING_PATH_DISCOVERY_REMINDER,
          status: "PENDING",
        },
      }),
    ]);

    expect(explorationMilestones).toBe(1);
    expect(activeDiscoveries).toBe(0);
  });
});