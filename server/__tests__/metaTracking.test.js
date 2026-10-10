import { jest, test, expect, afterEach } from "@jest/globals";
import {
  getCapiDestination, MEMORY_PIXEL_ID, renderMetaPixelHtml,
} from "../config/metaTracking.js";
import { sendCapiPurchase } from "../lib/metaCapi.js";

afterEach(() => { jest.restoreAllMocks(); });

test("missing memory credentials never fall back to configured English CAPI", () => {
  const english = { META_PIXEL_ID: "1246171816816642", META_CAPI_ACCESS_TOKEN: "english-test-only" };
  expect(getCapiDestination("memory_masterclass_99", english)).toEqual({
    enabled: false, reason: "memory_capi_token_missing",
  });
  expect(getCapiDestination("sentence_master_1199", english)).toMatchObject({
    enabled: true, pixelId: english.META_PIXEL_ID, accessToken: english.META_CAPI_ACCESS_TOKEN,
  });
});

test.each(["memory_masterclass_99", "memory_future_product"])("%s uses only dedicated credentials/test code", product => {
  expect(getCapiDestination(product, {
    META_PIXEL_ID: "1246171816816642", META_CAPI_ACCESS_TOKEN: "english-test-only",
    META_TEST_EVENT_CODE: "ENGLISH_TEST",
    MEMORY_META_CAPI_ACCESS_TOKEN: "memory-test-only",
  })).toEqual({
    enabled: true, pixelId: MEMORY_PIXEL_ID, accessToken: "memory-test-only", testEventCode: null,
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
    eventId: "memory_masterclass_99_purchase_pay_a", eventTime: 1234567890000,
    eventSourceUrl: "https://www.fluencyjet.com/memory-masterclass/thank-you",
    value: 99, currency: "INR", contentName: "Memory",
    contentIds: ["memory_masterclass_99"], email: "Buyer@example.test",
    phone: "9876543210", externalId: "visitor-a", fbp: "fb.1.fixture",
    testEventCode: "MEMORY_TEST",
  });
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toContain(`/${MEMORY_PIXEL_ID}/events`);
  const body = JSON.parse(options.body);
  expect(body.test_event_code).toBe("MEMORY_TEST");
  expect(body.data[0].event_id).toBe("memory_masterclass_99_purchase_pay_a");
  expect(body.data[0].user_data.em[0]).toMatch(/^[a-f0-9]{64}$/);
  expect(body.data[0].user_data.ph[0]).toMatch(/^[a-f0-9]{64}$/);
  expect(body.data[0].user_data.fbp).toBe("fb.1.fixture");
  expect(options.body).not.toContain("memory-test-only");
  expect(options.body).not.toContain("Buyer@example.test");
});
