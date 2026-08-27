import { jest } from "@jest/globals";
import {
  LEARNING_PATH_DISCOVERY_REMINDER,
  LEARNING_PATH_EXPLORED,
  LESSON1_OPENED,
  LESSON1_PRACTICE_COMPLETED,
  LESSON1_SIGNUP_REMINDER,
  LESSON1_WATCH_REMINDER,
  SENTENCE_MASTER_PRODUCT_KEY,
  recordBlockAJourneyMilestone,
  recordPracticeCompletionTransition,
} from "../lib/whatsappJourney.js";

function makeTransaction() {
  return {
    $executeRaw: jest.fn().mockResolvedValue(1),
    userJourneyMilestone: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    automationEvent: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        whatsapp_number: "+91 98765 43210",
        whatsapp_number_normalized: "+919876543210",
      }),
    },
  };
}

describe("WhatsApp Block A journey foundation", () => {
  const occurredAt = new Date("2026-08-27T10:00:00.000Z");

  test("the first below-10 to at-least-10 transition atomically cancels signup and schedules watch", async () => {
    const tx = makeTransaction();
    tx.userJourneyMilestone.findUnique.mockResolvedValue(null);
    tx.userJourneyMilestone.create.mockResolvedValue({
      id: "milestone-1",
      userId: 42,
      productKey: SENTENCE_MASTER_PRODUCT_KEY,
      milestoneType: LESSON1_PRACTICE_COMPLETED,
      occurredAt,
    });
    tx.automationEvent.create.mockResolvedValue({ id: "watch-event" });

    const result = await recordPracticeCompletionTransition({
      transaction: tx,
      userId: 42,
      previousCompleted: 9,
      nextCompleted: 10,
      occurredAt,
    });

    expect(result.created).toBe(true);
    expect(tx.automationEvent.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 42,
        productKey: SENTENCE_MASTER_PRODUCT_KEY,
        eventType: { in: [LESSON1_SIGNUP_REMINDER] },
        status: "PENDING",
      },
      data: {
        status: "CANCELLED",
        cancelledAt: occurredAt,
        processedAt: occurredAt,
      },
    });
    expect(tx.automationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 42,
        productKey: SENTENCE_MASTER_PRODUCT_KEY,
        eventType: LESSON1_WATCH_REMINDER,
        status: "PENDING",
        destinationNumberNormalized: "+919876543210",
        scheduledAt: new Date("2026-08-27T10:15:00.000Z"),
      }),
    });
  });

  test("non-crossing practice updates do not create milestones or reminders", async () => {
    const tx = makeTransaction();

    const result = await recordPracticeCompletionTransition({
      transaction: tx,
      userId: 42,
      previousCompleted: 10,
      nextCompleted: 12,
      occurredAt,
    });

    expect(result).toEqual({
      created: false,
      reason: "THRESHOLD_NOT_CROSSED",
    });
    expect(tx.userJourneyMilestone.findUnique).not.toHaveBeenCalled();
    expect(tx.automationEvent.create).not.toHaveBeenCalled();
  });

  test("first Lesson 1 open cancels watch and schedules discovery 75 minutes later", async () => {
    const tx = makeTransaction();
    tx.userJourneyMilestone.findUnique.mockResolvedValue(null);
    tx.userJourneyMilestone.create.mockResolvedValue({
      id: "milestone-open",
      userId: 42,
      productKey: SENTENCE_MASTER_PRODUCT_KEY,
      milestoneType: LESSON1_OPENED,
      occurredAt,
    });
    tx.automationEvent.create.mockResolvedValue({ id: "discovery-event" });
    const database = {
      $transaction: jest.fn(async (callback) => callback(tx)),
    };

    const result = await recordBlockAJourneyMilestone({
      database,
      userId: 42,
      milestoneType: LESSON1_OPENED,
      occurredAt,
    });

    expect(result.created).toBe(true);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.automationEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventType: { in: [LESSON1_WATCH_REMINDER] },
        }),
      }),
    );
    expect(tx.automationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: LEARNING_PATH_DISCOVERY_REMINDER,
        scheduledAt: new Date("2026-08-27T11:15:00.000Z"),
      }),
    });
  });

  test("duplicate milestone requests are idempotent", async () => {
    const tx = makeTransaction();
    const existing = {
      id: "existing",
      userId: 42,
      productKey: SENTENCE_MASTER_PRODUCT_KEY,
      milestoneType: LESSON1_OPENED,
      occurredAt,
    };
    tx.userJourneyMilestone.findUnique.mockResolvedValue(existing);
    const database = {
      $transaction: jest.fn(async (callback) => callback(tx)),
    };

    const result = await recordBlockAJourneyMilestone({
      database,
      userId: 42,
      milestoneType: LESSON1_OPENED,
      occurredAt,
    });

    expect(result).toEqual({ created: false, milestone: existing });
    expect(tx.automationEvent.updateMany).not.toHaveBeenCalled();
    expect(tx.automationEvent.create).not.toHaveBeenCalled();
  });

  test("first learning-path exploration cancels pending discovery without scheduling another event", async () => {
    const tx = makeTransaction();
    tx.userJourneyMilestone.findUnique.mockResolvedValue(null);
    tx.userJourneyMilestone.create.mockResolvedValue({
      id: "milestone-path",
      userId: 42,
      productKey: SENTENCE_MASTER_PRODUCT_KEY,
      milestoneType: LEARNING_PATH_EXPLORED,
      occurredAt,
    });
    const database = {
      $transaction: jest.fn(async (callback) => callback(tx)),
    };

    const result = await recordBlockAJourneyMilestone({
      database,
      userId: 42,
      milestoneType: LEARNING_PATH_EXPLORED,
      occurredAt,
    });

    expect(result.created).toBe(true);
    expect(tx.automationEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventType: { in: [LEARNING_PATH_DISCOVERY_REMINDER] },
        }),
      }),
    );
    expect(tx.automationEvent.create).not.toHaveBeenCalled();
  });
});