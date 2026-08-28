import { jest } from "@jest/globals";
import {
  ANY_QUESTIONS_REMINDER,
  CHECKOUT_HELP_REMINDER,
  LEARNING_PATH_DISCOVERY_REMINDER,
  LEARNING_PATH_EXPLORED,
  LESSON1_OPENED,
  LESSON1_PRACTICE_COMPLETED,
  LESSON1_SIGNUP_REMINDER,
  LESSON1_WATCH_REMINDER,
  SENTENCE_MASTER_PRODUCT_KEY,
  recordBlockAJourneyMilestone,
  recordCheckoutIntent,
  recordPracticeCompletionTransition,
  scheduleAnyQuestionsAfterCheckoutHelpSent,
} from "../lib/whatsappJourney.js";

function makeTransaction() {
  return {
    $executeRaw: jest.fn().mockResolvedValue(1),
    userJourneyMilestone: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    automationEvent: {
      findFirst: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        whatsapp_number: "+91 98765 43210",
        whatsapp_number_normalized: "+919876543210",
        whatsapp_consent: true,
        has_access: false,
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

  test("a prior Lesson 1 open prevents a later threshold from creating watch", async () => {
    const tx = makeTransaction();
    tx.userJourneyMilestone.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "milestone-open" });
    tx.userJourneyMilestone.create.mockResolvedValue({
      id: "milestone-practice",
      userId: 42,
      productKey: SENTENCE_MASTER_PRODUCT_KEY,
      milestoneType: LESSON1_PRACTICE_COMPLETED,
      occurredAt,
    });

    const result = await recordPracticeCompletionTransition({
      transaction: tx,
      userId: 42,
      previousCompleted: 9,
      nextCompleted: 10,
      occurredAt,
    });

    expect(result.created).toBe(true);
    expect(tx.automationEvent.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.automationEvent.create).not.toHaveBeenCalled();
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

  test("a prior learning-path exploration prevents Lesson 1 open from creating discovery", async () => {
    const tx = makeTransaction();
    tx.userJourneyMilestone.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "milestone-path" });
    tx.userJourneyMilestone.create.mockResolvedValue({
      id: "milestone-open",
      userId: 42,
      productKey: SENTENCE_MASTER_PRODUCT_KEY,
      milestoneType: LESSON1_OPENED,
      occurredAt,
    });
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
    expect(tx.automationEvent.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.automationEvent.create).not.toHaveBeenCalled();
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

describe("WhatsApp Block B checkout journey", () => {
  const occurredAt = new Date("2026-08-28T10:00:00.000Z");

  test("records one eligible checkout-help reminder 20 minutes later under the journey lock", async () => {
    const tx = makeTransaction();
    tx.automationEvent.findFirst.mockResolvedValue(null);
    tx.automationEvent.create.mockResolvedValue({ id: "checkout-help-event" });
    const database = {
      $transaction: jest.fn(async (callback) => callback(tx)),
    };

    const result = await recordCheckoutIntent({
      database,
      userId: 42,
      occurredAt,
    });

    expect(result.created).toBe(true);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.automationEvent.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 42,
        productKey: SENTENCE_MASTER_PRODUCT_KEY,
        eventType: {
          in: [CHECKOUT_HELP_REMINDER, ANY_QUESTIONS_REMINDER],
        },
        status: { in: ["PENDING", "SENDING"] },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    expect(tx.automationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 42,
        productKey: SENTENCE_MASTER_PRODUCT_KEY,
        eventType: CHECKOUT_HELP_REMINDER,
        status: "PENDING",
        destinationNumberNormalized: "+919876543210",
        scheduledAt: new Date("2026-08-28T10:20:00.000Z"),
      }),
    });
  });

  test.each([
    [{ whatsapp_consent: false }, "WHATSAPP_NOT_ELIGIBLE"],
    [{ whatsapp_number_normalized: null }, "WHATSAPP_NOT_ELIGIBLE"],
    [{ has_access: true }, "USER_HAS_ACCESS"],
  ])("does not create checkout help for an ineligible learner", async (
    override,
    reason,
  ) => {
    const tx = makeTransaction();
    tx.user.findUnique.mockResolvedValue({
      whatsapp_number: "+91 98765 43210",
      whatsapp_number_normalized: "+919876543210",
      whatsapp_consent: true,
      has_access: false,
      ...override,
    });
    const database = {
      $transaction: jest.fn(async (callback) => callback(tx)),
    };

    const result = await recordCheckoutIntent({
      database,
      userId: 42,
      occurredAt,
    });

    expect(result).toEqual({ created: false, reason });
    expect(tx.automationEvent.findFirst).not.toHaveBeenCalled();
    expect(tx.automationEvent.create).not.toHaveBeenCalled();
  });

  test("does not duplicate an active checkout-help reminder", async () => {
    const tx = makeTransaction();
    const existing = { id: "existing-checkout-help" };
    tx.automationEvent.findFirst.mockResolvedValue(existing);
    const database = {
      $transaction: jest.fn(async (callback) => callback(tx)),
    };

    const result = await recordCheckoutIntent({
      database,
      userId: 42,
      occurredAt,
    });

    expect(result).toEqual({
      created: false,
      reason: "ALREADY_ACTIVE",
      automationEvent: existing,
    });
    expect(tx.automationEvent.create).not.toHaveBeenCalled();
  });

  test("schedules any-questions exactly once at authoritative SENT plus 24 hours", async () => {
    const tx = makeTransaction();
    tx.automationEvent.findFirst.mockResolvedValue(null);
    tx.automationEvent.create.mockResolvedValue({ id: "any-questions-event" });
    const sentAt = new Date("2026-08-28T10:20:00.000Z");
    const checkoutHelpEvent = {
      id: "checkout-help-event",
      userId: 42,
      productKey: SENTENCE_MASTER_PRODUCT_KEY,
      eventType: CHECKOUT_HELP_REMINDER,
      status: "SENT",
      destinationNumberNormalized: "+919876543210",
    };

    const result = await scheduleAnyQuestionsAfterCheckoutHelpSent({
      transaction: tx,
      checkoutHelpEvent,
      sentAt,
      anchorSource: "test-evidence",
    });

    expect(result.created).toBe(true);
    expect(tx.automationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 42,
        productKey: SENTENCE_MASTER_PRODUCT_KEY,
        eventType: ANY_QUESTIONS_REMINDER,
        status: "PENDING",
        sourceAutomationEventId: "checkout-help-event",
        destinationNumberNormalized: "+919876543210",
        scheduledAt: new Date("2026-08-29T10:20:00.000Z"),
        payload: expect.objectContaining({
          sourceAutomationEventId: "checkout-help-event",
          anchorSource: "test-evidence",
          anchorSentAt: sentAt.toISOString(),
        }),
      }),
    });

    tx.automationEvent.findFirst.mockResolvedValue({
      id: "existing-any-questions",
      status: "CANCELLED",
    });
    tx.automationEvent.create.mockClear();
    const duplicate = await scheduleAnyQuestionsAfterCheckoutHelpSent({
      transaction: tx,
      checkoutHelpEvent,
      sentAt,
    });
    expect(duplicate.created).toBe(false);
    expect(duplicate.reason).toBe("ALREADY_ACTIVE");
    expect(tx.automationEvent.create).not.toHaveBeenCalled();
  });
});