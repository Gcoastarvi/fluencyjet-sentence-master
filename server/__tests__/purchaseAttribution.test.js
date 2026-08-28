import { describe, expect, jest, test } from "@jest/globals";
import {
  CHECKOUT_INTENT_MATCH_WINDOW_MS,
  findExactSentenceMasterCheckoutIntent,
  getCapturedPaymentTime,
} from "../lib/purchaseAttribution.js";

const capturedAt = new Date("2026-08-28T10:05:00.000Z");

function makeDatabase(candidates = []) {
  return {
    sentenceMasterCheckoutIntent: {
      findMany: jest.fn().mockResolvedValue(candidates),
    },
  };
}

function makeIntent(overrides = {}) {
  return {
    id: "intent-1",
    userId: 42,
    productKey: "sentence_master",
    learnerEmail: "learner@example.test",
    destinationNumberNormalized: "+919876543210",
    createdAt: new Date("2026-08-28T10:00:00.000Z"),
    ...overrides,
  };
}

describe("Sentence Master purchase attribution evidence", () => {
  test("normalizes exact payment identity and selects only the bounded product intent", async () => {
    const intent = makeIntent();
    const database = makeDatabase([intent]);

    const result = await findExactSentenceMasterCheckoutIntent({
      database,
      customerEmail: "  LEARNER@EXAMPLE.TEST ",
      customerContact: "98765 43210",
      capturedAt,
    });

    expect(result).toEqual({ intent, reason: null });
    expect(database.sentenceMasterCheckoutIntent.findMany).toHaveBeenCalledWith({
      where: {
        productKey: "sentence_master",
        learnerEmail: "learner@example.test",
        destinationNumberNormalized: "+919876543210",
        purchase: { is: null },
        createdAt: {
          lte: capturedAt,
          gte: new Date(capturedAt.getTime() - CHECKOUT_INTENT_MATCH_WINDOW_MS),
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: expect.any(Object),
    });
  });

  test.each([
    {
      name: "anonymous email",
      customerEmail: null,
      customerContact: "+919876543210",
      capturedAt,
    },
    {
      name: "anonymous contact",
      customerEmail: "learner@example.test",
      customerContact: null,
      capturedAt,
    },
    {
      name: "missing payment time",
      customerEmail: "learner@example.test",
      customerContact: "+919876543210",
      capturedAt: null,
    },
  ])("fails closed before querying for $name", async (evidence) => {
    const database = makeDatabase([makeIntent()]);

    await expect(
      findExactSentenceMasterCheckoutIntent({
        database,
        customerEmail: evidence.customerEmail,
        customerContact: evidence.customerContact,
        capturedAt: evidence.capturedAt,
      }),
    ).resolves.toEqual({
      intent: null,
      reason: "INCOMPLETE_PAYMENT_EVIDENCE",
    });
    expect(database.sentenceMasterCheckoutIntent.findMany).not.toHaveBeenCalled();
  });

  test("does not guess when payment identity or timing finds no candidate", async () => {
    const database = makeDatabase([]);

    await expect(
      findExactSentenceMasterCheckoutIntent({
        database,
        customerEmail: "wrong-user@example.test",
        customerContact: "+919876543210",
        capturedAt,
      }),
    ).resolves.toEqual({
      intent: null,
      reason: "NO_EXACT_CHECKOUT_INTENT",
    });
  });

  test("does not guess when more than one authenticated intent matches", async () => {
    const database = makeDatabase([
      makeIntent(),
      makeIntent({ id: "intent-2" }),
    ]);

    await expect(
      findExactSentenceMasterCheckoutIntent({
        database,
        customerEmail: "learner@example.test",
        customerContact: "+919876543210",
        capturedAt,
      }),
    ).resolves.toEqual({
      intent: null,
      reason: "AMBIGUOUS_CHECKOUT_INTENT",
    });
  });

  test("requires a valid Razorpay payment creation timestamp", () => {
    expect(getCapturedPaymentTime({ created_at: 1787911500 })).toEqual(
      new Date("2026-08-28T10:05:00.000Z"),
    );
    expect(getCapturedPaymentTime({ created_at: "1787911500" })).toEqual(
      new Date("2026-08-28T10:05:00.000Z"),
    );
    expect(getCapturedPaymentTime({})).toBeNull();
    expect(getCapturedPaymentTime({ created_at: "not-a-time" })).toBeNull();
  });
});