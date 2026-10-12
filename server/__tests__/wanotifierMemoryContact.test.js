import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

const {
  syncMemoryLeadToWanotifier,
} = await import(
  "../services/wanotifierMemoryContact.js"
);

const ENV_KEYS = [
  "WANOTIFIER_MEMORY_NURTURE_ENABLED",
  "WANOTIFIER_API_KEY",
  "WANOTIFIER_MEMORY_LIST_ID",
  "WANOTIFIER_MEMORY_SCHOOL_PARENT_TAG_ID",
  "WANOTIFIER_MEMORY_COMPETITIVE_TAG_ID",
];

const ORIGINAL_ENV = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

function mockSuccess() {
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      error: false,
      message: "Contact updated successfully.",
    }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();

  process.env.WANOTIFIER_MEMORY_NURTURE_ENABLED =
    "true";
  process.env.WANOTIFIER_API_KEY = "test-secret";
  process.env.WANOTIFIER_MEMORY_LIST_ID = "571785";
  process.env.WANOTIFIER_MEMORY_SCHOOL_PARENT_TAG_ID =
    "571786";
  process.env.WANOTIFIER_MEMORY_COMPETITIVE_TAG_ID =
    "571787";

  global.fetch = jest.fn();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (ORIGINAL_ENV[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = ORIGINAL_ENV[key];
    }
  }

  delete global.fetch;
});

describe("syncMemoryLeadToWanotifier", () => {
  test("does nothing when nurture is disabled", async () => {
    process.env.WANOTIFIER_MEMORY_NURTURE_ENABLED =
      "false";

    const result =
      await syncMemoryLeadToWanotifier({
        trackId: "school_foundation",
        learnerName: "Arun",
        whatsappNumberNormalized:
          "+919876543210",
        score: "48",
      });

    expect(result).toEqual({
      skipped: true,
      reason:
        "WANOTIFIER_MEMORY_NURTURE_DISABLED",
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test.each([
    "school_foundation",
    "school_advanced",
  ])(
    "assigns %s to the school-parent nurture tag",
    async (trackId) => {
      mockSuccess();

      const result =
        await syncMemoryLeadToWanotifier({
          trackId,
          learnerName: "Arun",
          whatsappNumberNormalized:
            "+919876543210",
          score: "48",
        });

      expect(result).toEqual({ ok: true });
      expect(global.fetch).toHaveBeenCalledTimes(1);

      const [url, options] =
        global.fetch.mock.calls[0];

      expect(String(url)).toContain(
        "https://app.wanotifier.com/api/v1/contacts",
      );

      expect(String(url)).toContain(
        "key=test-secret",
      );

      expect(JSON.parse(options.body)).toEqual({
        whatsapp_number: "+919876543210",
        attributes: {
          learner_name: "Arun",
          memory_score: "48",
        },
        list_ids: [571785],
        tag_ids: [571786],
        status: "subscribed",
        replace: false,
      });
    },
  );

  test("assigns Advanced learner to competitive nurture tag", async () => {
    mockSuccess();

    const result =
      await syncMemoryLeadToWanotifier({
        trackId: "advanced",
        learnerName: "Priya",
        whatsappNumberNormalized:
          "+919876543210",
        score: "68.5",
      });

    expect(result).toEqual({ ok: true });

    const body = JSON.parse(
      global.fetch.mock.calls[0][1].body,
    );

    expect(body).toEqual({
      whatsapp_number: "+919876543210",
      attributes: {
        learner_name: "Priya",
        memory_score: "68.5",
      },
      list_ids: [571785],
      tag_ids: [571787],
      status: "subscribed",
      replace: false,
    });
  });

  test("fails safely when WANotifier rejects contact update", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: true,
        message: "provider unavailable",
      }),
    });

    const result =
      await syncMemoryLeadToWanotifier({
        trackId: "advanced",
        learnerName: "Priya",
        whatsappNumberNormalized:
          "+919876543210",
        score: "68",
      });

    expect(result).toEqual({
      ok: false,
      error: "provider unavailable",
    });
  });

  test("does not call WANotifier for unknown track", async () => {
    const result =
      await syncMemoryLeadToWanotifier({
        trackId: "unknown",
        learnerName: "Arun",
        whatsappNumberNormalized:
          "+919876543210",
        score: "48",
      });

    expect(result).toEqual({
      skipped: true,
      reason:
        "WANOTIFIER_MEMORY_CONTACT_CONFIG_INCOMPLETE",
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
