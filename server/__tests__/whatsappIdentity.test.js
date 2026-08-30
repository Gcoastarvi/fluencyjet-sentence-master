import { jest, describe, expect, test } from "@jest/globals";
import { reconcileLesson1SignupReminder } from "../lib/whatsappIdentity.js";

function makeTransaction() {
  return {
    $executeRaw: jest.fn().mockResolvedValue(1),
    lessonModeProgress: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    userJourneyMilestone: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    automationEvent: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({ id: "signup-reminder" }),
    },
  };
}

function makeDatabase(transaction) {
  return {
    $transaction: jest.fn(async (callback) => callback(transaction)),
  };
}

describe("Signup reminder reconciliation destination boundary", () => {
  test.each([
    ["null", null],
    ["blank", ""],
    ["whitespace", "   "],
    ["invalid text", "not-a-phone-number"],
    ["noncanonical but normalizable", "919876543210"],
  ])(
    "cancels existing pending reminder but does not create a replacement for %s destination",
    async (_label, whatsappNumberNormalized) => {
      const transaction = makeTransaction();
      const database = makeDatabase(transaction);

      const result = await reconcileLesson1SignupReminder({
        prisma: database,
        userId: 42,
        whatsappConsent: true,
        whatsappNumber: "+91 98765 43210",
        whatsappNumberNormalized,
      });

      expect(result).toEqual({ created: false });
      expect(transaction.automationEvent.updateMany).toHaveBeenCalledTimes(1);
      expect(transaction.automationEvent.create).not.toHaveBeenCalled();
    },
  );

  test("creates a replacement for a valid canonical destination", async () => {
    const transaction = makeTransaction();
    const database = makeDatabase(transaction);

    const result = await reconcileLesson1SignupReminder({
      prisma: database,
      userId: 42,
      whatsappConsent: true,
      whatsappNumber: "+91 98765 43210",
      whatsappNumberNormalized: "+919876543210",
    });

    expect(result).toEqual({
      created: true,
      automationEvent: { id: "signup-reminder" },
    });
    expect(transaction.automationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 42,
        productKey: "sentence_master",
        eventType: "LESSON1_SIGNUP_REMINDER",
        status: "PENDING",
        destinationNumberNormalized: "+919876543210",
        payload: {
          whatsapp_number: "+91 98765 43210",
          source: "try-spoken-english-gym",
        },
      }),
    });
  });
});