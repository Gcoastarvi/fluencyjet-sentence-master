import { jest, test, expect, afterEach } from "@jest/globals";
import crypto from "crypto";
import {
  getCapiDestination, MEMORY_PIXEL_ID, FJ_CAPI_VERSION, MEMORY_CAPI_VERSION, renderMetaPixelHtml,
} from "../config/metaTracking.js";
import { sendCapiPurchase } from "../lib/metaCapi.js";

afterEach(() => { jest.restoreAllMocks(); });

test("missing memory credentials never fall back to configured English CAPI", () => {
  const english = { META_PIXEL_ID: "1246171816816642", META_CAPI_ACCESS_TOKEN: "english-test-only" };
  expect(getCapiDestination("memory_masterclass_99", english)).toEqual({
    enabled: false, reason: "memory_capi_token_missing",
  });
  expect(getCapiDestination("sentence_master_1199", english)).toMatchObject({
    enabled: true, apiVersion: FJ_CAPI_VERSION,
    pixelId: english.META_PIXEL_ID, accessToken: english.META_CAPI_ACCESS_TOKEN,
  });
});

const purchase = {
  eventId: "memory_masterclass_99_purchase_pay_fixture",
  eventTime: 1787911500123,
  eventSourceUrl: "https://www.fluencyjet.com/memory-masterclass/thank-you",
  value: 99, currency: "INR", contentName: "Study Memory Masterclass",
  contentIds: ["memory_masterclass_99"], email: " Buyer@Example.test ",
  phone: "9876543210", externalId: " visitor-fixture ",
  fbc: " fb.1.click-fixture ", fbp: " fb.1.browser-fixture ",
  clientIpAddress: " 192.0.2.1 ", clientUserAgent: " QA fixture ",
};
const memory = () => ({
  ...purchase,
  ...getCapiDestination("memory_masterclass_99", {
    MEMORY_META_CAPI_ACCESS_TOKEN: "memory-test-only",
    MEMORY_META_TEST_EVENT_CODE: "MEMORY_TEST",
    META_TEST_EVENT_CODE: "ENGLISH_TEST",
  }),
});
const hash = value => crypto.createHash("sha256").update(value).digest("hex");

test("v26 Memory request retains the complete documented Purchase payload and dedicated auth", async () => {
  const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue({
    status: 200, ok: true, text: async () => '{"events_received":1,"fbtrace_id":"fixture"}',
  });
  expect(await sendCapiPurchase(memory())).toMatchObject({ status: 200, ok: true });
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("https://graph.facebook.com/v26.0/1998316064175555/events");
  expect(url).not.toContain("memory-test-only");
  expect(options.method).toBe("POST");
  expect(options.headers).toEqual({
    "Content-Type": "application/json", Authorization: "Bearer memory-test-only",
  });
  expect(JSON.parse(options.body)).toEqual({
    test_event_code: "MEMORY_TEST",
    data: [{
      event_name: "Purchase", event_time: 1787911500, action_source: "website",
      event_id: purchase.eventId, event_source_url: purchase.eventSourceUrl,
      user_data: {
        em: [hash("buyer@example.test")], ph: [hash("919876543210")],
        external_id: [hash("visitor-fixture")], fbc: "fb.1.click-fixture",
        fbp: "fb.1.browser-fixture", client_ip_address: "192.0.2.1",
        client_user_agent: "QA fixture",
      },
      custom_data: {
        currency: "INR", value: 99, content_name: purchase.contentName,
        content_ids: purchase.contentIds, content_type: "product",
      },
    }],
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("legacy FJ endpoint, query authentication, payload and success semantics remain unchanged", async () => {
  const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue({
    status: 200, ok: true, text: async () => "legacy-response",
  });
  const args = {
    ...purchase, contentIds: ["sentence_master_1199"], value: 1199,
    contentName: "FJ Sentence Master",
    eventId: "sentence_master_1199_purchase_pay_fj_fixture",
    eventSourceUrl: "https://www.fluencyjet.com/spoken-english-offer",
    ...getCapiDestination("sentence_master_1199", {
      META_PIXEL_ID: "1246171816816642", META_CAPI_ACCESS_TOKEN: "english-test-only",
      META_TEST_EVENT_CODE: "ENGLISH_TEST",
      MEMORY_META_CAPI_ACCESS_TOKEN: "memory-test-only",
    }),
  };
  expect(await sendCapiPurchase(args)).toEqual({ status: 200, ok: true, body: "legacy-response" });
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("https://graph.facebook.com/v19.0/1246171816816642/events?access_token=english-test-only");
  expect(options.headers).toEqual({ "Content-Type": "application/json" });
  const expected = JSON.parse(options.body);
  expect(expected.test_event_code).toBe("ENGLISH_TEST");
  expect(expected.data[0]).toEqual({
    event_name: "Purchase", event_time: 1787911500, event_id: args.eventId,
    action_source: "website", event_source_url: args.eventSourceUrl,
    custom_data: {
      value: 1199, currency: "INR", content_ids: ["sentence_master_1199"],
      content_name: "FJ Sentence Master", content_type: "product",
    },
    user_data: {
      em: [hash("buyer@example.test")], ph: [hash("919876543210")],
      external_id: [hash("visitor-fixture")], fbc: "fb.1.click-fixture",
      fbp: "fb.1.browser-fixture", client_ip_address: "192.0.2.1",
      client_user_agent: "QA fixture",
    },
  });
  // Default legacy callers (without a version) must generate identical HTTP requests.
  await sendCapiPurchase({ ...args, apiVersion: undefined });
  expect(fetchMock.mock.calls[1]).toEqual(fetchMock.mock.calls[0]);
});

test.each([400, 401, 429, 500])("Memory HTTP %s fails without retry or FJ fallback", async status => {
  const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue({
    status, ok: false, text: async () => '{"error":{"code":190,"message":"QA error"}}',
  });
  expect(await sendCapiPurchase(memory())).toEqual({
    status, ok: false, body: '{"error":{"code":190,"message":"QA error"}}',
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toContain("/v26.0/1998316064175555/events");
});

test.each(['{"events_received":0}', '{"error":{"code":190}}', "invalid JSON"])(
  "Memory does not claim delivery for an unacknowledged 200 response: %s", async body => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 200, ok: true, text: async () => body,
    });
    expect(await sendCapiPurchase(memory())).toEqual({ status: 200, ok: false, body });
  },
);

test("Memory network errors redact credentials and never retry", async () => {
  const fetchMock = jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("QA memory-test-only failure"));
  expect(await sendCapiPurchase(memory())).toEqual({
    status: 0, ok: false, body: "QA [REDACTED] failure",
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("a malformed Memory credential cannot throw from error redaction", async () => {
  const token = "invalid-\uD800-fixture";
  jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error(`QA ${token} failure`));
  expect(await sendCapiPurchase({ ...memory(), accessToken: token })).toEqual({
    status: 0, ok: false, body: "QA [REDACTED] failure",
  });
});

test.each([
  { accessToken: "" }, { accessToken: "   " }, { accessToken: undefined },
  { apiVersion: "v19.0" }, { apiVersion: "../../v26.0" },
])("invalid Memory configuration fails before HTTP: %j", async override => {
  const fetchMock = jest.spyOn(globalThis, "fetch");
  expect(await sendCapiPurchase({ ...memory(), ...override })).toMatchObject({ status: 0, ok: false });
  expect(fetchMock).not.toHaveBeenCalled();
});

test("Memory implicit test code never inherits the FJ environment code; explicit null disables it", async () => {
  const original = {
    fj: process.env.META_TEST_EVENT_CODE, memory: process.env.MEMORY_META_TEST_EVENT_CODE,
  };
  try {
    process.env.META_TEST_EVENT_CODE = "ENGLISH_TEST";
    delete process.env.MEMORY_META_TEST_EVENT_CODE;
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 200, ok: true, text: async () => '{"events_received":1}',
    });
    await sendCapiPurchase({ ...memory(), testEventCode: undefined });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty("test_event_code");
    process.env.MEMORY_META_TEST_EVENT_CODE = "MEMORY_TEST";
    await sendCapiPurchase({ ...memory(), testEventCode: undefined });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).test_event_code).toBe("MEMORY_TEST");
    await sendCapiPurchase({ ...memory(), testEventCode: null });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).not.toHaveProperty("test_event_code");
  } finally {
    for (const [key, value] of [
      ["META_TEST_EVENT_CODE", original.fj], ["MEMORY_META_TEST_EVENT_CODE", original.memory],
    ]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test.each(["memory_masterclass_99", "memory_future_product"])("%s uses only dedicated credentials/test code", product => {
  expect(getCapiDestination(product, {
    META_PIXEL_ID: "1246171816816642", META_CAPI_ACCESS_TOKEN: "english-test-only",
    META_TEST_EVENT_CODE: "ENGLISH_TEST",
    MEMORY_META_CAPI_ACCESS_TOKEN: "memory-test-only",
  })).toEqual({
    enabled: true, pixelId: MEMORY_PIXEL_ID, apiVersion: MEMORY_CAPI_VERSION,
    accessToken: "memory-test-only", testEventCode: null,
  });
});

test("a wrong memory Pixel fails closed instead of sending to FJ or an arbitrary dataset", () => {
  expect(getCapiDestination("memory_masterclass_99", {
    MEMORY_META_PIXEL_ID: "1246171816816642", MEMORY_META_CAPI_ACCESS_TOKEN: "memory-test-only",
  })).toEqual({ enabled: false, reason: "memory_pixel_mismatch" });
});

test.each([
  ["/memory-challenge", "1998316064175555"],
  ["/memory-masterclass/thank-you", "1998316064175555"],
  ["/memory-retest", "1998316064175555"],
  ["/Memory-Challenge/Result", "1998316064175555"],
  ["/%6Demory-challenge/video/school", "1998316064175555"],
  ["/spoken-english-offer", "1246171816816642"],
  ["/german-live-class", "1246171816816642"],
])("no-script HTML for %s contains only the correct Pixel", (path, id) => {
  const rendered = renderMetaPixelHtml("<!-- META_PIXEL_NOSCRIPT -->", path);
  expect(rendered).toContain(`tr?id=${id}&amp;ev=PageView`);
  expect(rendered.match(/tr\?id=/g)).toHaveLength(1);
});

test("CAPI hashes identity, uses an explicit test destination, and excludes tokens from the JSON body", async () => {
  const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue({
    status: 200, ok: true, text: async () => '{"events_received":1}',
  });
  await sendCapiPurchase({
    pixelId: MEMORY_PIXEL_ID, accessToken: "memory-test-only",
    apiVersion: MEMORY_CAPI_VERSION,
    eventId: "memory_masterclass_99_purchase_pay_a", eventTime: 1234567890000,
    eventSourceUrl: "https://www.fluencyjet.com/memory-masterclass/thank-you",
    value: 99, currency: "INR", contentName: "Memory",
    contentIds: ["memory_masterclass_99"], email: "Buyer@example.test",
    phone: "9876543210", externalId: "visitor-a", fbp: "fb.1.fixture",
    testEventCode: "MEMORY_TEST",
  });
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe(`https://graph.facebook.com/v26.0/${MEMORY_PIXEL_ID}/events`);
  expect(options.headers.Authorization).toBe("Bearer memory-test-only");
  const body = JSON.parse(options.body);
  expect(body.test_event_code).toBe("MEMORY_TEST");
  expect(body.data[0].event_id).toBe("memory_masterclass_99_purchase_pay_a");
  expect(body.data[0].user_data.em[0]).toMatch(/^[a-f0-9]{64}$/);
  expect(body.data[0].user_data.ph[0]).toMatch(/^[a-f0-9]{64}$/);
  expect(body.data[0].user_data.fbp).toBe("fb.1.fixture");
  expect(options.body).not.toContain("memory-test-only");
  expect(options.body).not.toContain("Buyer@example.test");
});
