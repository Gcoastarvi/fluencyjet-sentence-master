import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

const mockPrisma = {
  memoryAssessmentSession: {
    updateMany: jest.fn(),
  },
};

jest.unstable_mockModule("../db/client.js", () => ({
  default: mockPrisma,
}));

const {
  deliverMemoryScoreWhatsApp,
} = await import("../services/memoryScoreWhatsApp.js");

const ORIGINAL_URL =
  process.env.WANOTIFIER_MEMORY_SCORE_URL;

beforeEach(() => {
  jest.clearAllMocks();

  process.env.WANOTIFIER_MEMORY_SCORE_URL =
    "https://example.test/wanotifier?key=test-secret";

  global.fetch = jest.fn();
});

afterEach(() => {
  if (ORIGINAL_URL === undefined) {
    delete process.env.WANOTIFIER_MEMORY_SCORE_URL;
  } else {
    process.env.WANOTIFIER_MEMORY_SCORE_URL =
      ORIGINAL_URL;
  }

  delete global.fetch;
});

describe("deliverMemoryScoreWhatsApp", () => {
  test("sends school score to parent number while keeping student name in template", async () => {
    mockPrisma.memoryAssessmentSession.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        error: false,
        status: "attempted",
        message: "SUCCESS",
      }),
    });

    const result =
      await deliverMemoryScoreWhatsApp({
        ownerToken:
          "11111111-2222-4333-8444-555555555555",
        trackId: "school_foundation",
        learnerName: "Arun",
        parentGuardianName: "Kumar",
        whatsappContactRole: "PARENT_GUARDIAN",
        whatsappNumberNormalized:
          "+919876543210",
        formAScore: 68,
      });

    expect(result).toEqual({
      ok: true,
      providerStatus: "attempted",
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [url, options] =
      global.fetch.mock.calls[0];

    expect(url).toBe(
      "https://example.test/wanotifier?key=test-secret",
    );

    expect(options.method).toBe("POST");

    expect(options.headers).toEqual({
      "Content-Type": "application/json",
    });

    expect(JSON.parse(options.body)).toEqual({
      data: {
        body_variables: [
          "Arun",
          "68",
        ],
      },
      recipients: [
        {
          whatsapp_number:
            "+919876543210",
          first_name: "Kumar",
        },
      ],
    });

    expect(
      mockPrisma.memoryAssessmentSession.updateMany,
    ).toHaveBeenCalledTimes(2);

    const acceptedUpdate =
      mockPrisma.memoryAssessmentSession
        .updateMany.mock.calls[1][0];

    expect(acceptedUpdate.data).toMatchObject({
      whatsappScoreDeliveryStatus:
        "ACCEPTED",
      whatsappScoreDeliveryError: null,
    });

    expect(
      acceptedUpdate.data
        .whatsappScoreDeliveryAcceptedAt,
    ).toBeInstanceOf(Date);
  });

  test("uses learner name as contact name for Advanced learner", async () => {
    mockPrisma.memoryAssessmentSession.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        error: false,
        status: "attempted",
      }),
    });

    await deliverMemoryScoreWhatsApp({
      ownerToken:
        "11111111-2222-4333-8444-555555555555",
      trackId: "advanced",
      learnerName: "Priya",
      parentGuardianName: null,
      whatsappContactRole: "LEARNER",
      whatsappNumberNormalized:
        "+919876543210",
      formAScore: 52.5,
    });

    const body = JSON.parse(
      global.fetch.mock.calls[0][1].body,
    );

    expect(body).toEqual({
      data: {
        body_variables: [
          "Priya",
          "52.5",
        ],
      },
      recipients: [
        {
          whatsapp_number:
            "+919876543210",
          first_name: "Priya",
        },
      ],
    });
  });

  test("does not send when another request already claimed or completed delivery", async () => {
    mockPrisma.memoryAssessmentSession.updateMany
      .mockResolvedValueOnce({ count: 0 });

    const result =
      await deliverMemoryScoreWhatsApp({
        ownerToken:
          "11111111-2222-4333-8444-555555555555",
        trackId: "school_foundation",
        learnerName: "Arun",
        parentGuardianName: "Kumar",
        whatsappContactRole:
          "PARENT_GUARDIAN",
        whatsappNumberNormalized:
          "+919876543210",
        formAScore: 68,
      });

    expect(result).toEqual({
      skipped: true,
      reason:
        "ALREADY_SENT_OR_IN_PROGRESS",
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("marks delivery FAILED when WANotifier rejects the request", async () => {
    mockPrisma.memoryAssessmentSession.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });

    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: true,
        message: "provider unavailable",
      }),
    });

    const result =
      await deliverMemoryScoreWhatsApp({
        ownerToken:
          "11111111-2222-4333-8444-555555555555",
        trackId: "school_foundation",
        learnerName: "Arun",
        parentGuardianName: "Kumar",
        whatsappContactRole:
          "PARENT_GUARDIAN",
        whatsappNumberNormalized:
          "+919876543210",
        formAScore: 68,
      });

    expect(result).toEqual({
      ok: false,
      error: "provider unavailable",
    });

    const failedUpdate =
      mockPrisma.memoryAssessmentSession
        .updateMany.mock.calls[1][0];

    expect(failedUpdate.data).toEqual({
      whatsappScoreDeliveryStatus:
        "FAILED",
      whatsappScoreDeliveryError:
        "provider unavailable",
    });
  });

  test("skips safely when WANotifier URL is not configured", async () => {
    delete process.env.WANOTIFIER_MEMORY_SCORE_URL;

    const result =
      await deliverMemoryScoreWhatsApp({
        ownerToken:
          "11111111-2222-4333-8444-555555555555",
        trackId: "advanced",
        learnerName: "Priya",
        whatsappContactRole: "LEARNER",
        whatsappNumberNormalized:
          "+919876543210",
        formAScore: 80,
      });

    expect(result).toEqual({
      skipped: true,
      reason:
        "WANOTIFIER_MEMORY_SCORE_URL_NOT_CONFIGURED",
    });

    expect(
      mockPrisma.memoryAssessmentSession.updateMany,
    ).not.toHaveBeenCalled();

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
