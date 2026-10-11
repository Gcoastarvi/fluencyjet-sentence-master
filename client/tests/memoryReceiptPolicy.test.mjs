import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  MOCK_RECEIPT_CONTEXT as context, MEMORY_GRAPH_ENDPOINT,
  requireMockReceipt, assertMockLaunch, inspectBrowserMetaRequest,
  inspectGraphRequest, assertPrivateParamsAbsent, prepareMockGraphReceipt,
} from "./memoryReceiptPolicy.mjs";
import { buildReceiptBrowserSuite } from "./memoryReceiptFixture.mjs";
import { assertReceiptSandbox } from "./memoryReceiptSandbox.mjs";

const tracker = (patch = {}) => "https://www.facebook.com/tr/?" +
  new URLSearchParams({ id: "1998316064175555", ev: "Lead",
    dl: "http://127.0.0.1:3000/memory-challenge/result", cd: "{}", ...patch });

test("off by default; no live flag, implicit consent or credential loading", () => {
  assertMockLaunch(["--mock", "--acknowledge-synthetic-consent"]);
  for (const args of [[], ["--mock"], ["--real"], ["--mock", "--acknowledge-synthetic-consent", "--send"]]) {
    assert.throws(() => assertMockLaunch(args));
  }
  requireMockReceipt(context);
  assert.throws(() => requireMockReceipt());
  assert.throws(() => requireMockReceipt({ ...context, mode: "real" }));
});

for (const key of ["consentAcknowledged", "privateStore", "accessToken", "testEventCode", "matchingKind"]) {
  test(`mock receipt refuses missing or foreign ${key}`, () => {
    const missing = { ...context }; delete missing[key];
    assert.throws(() => requireMockReceipt(missing));
    assert.throws(() => requireMockReceipt({ ...context, [key]: "foreign" }));
  });
}

test("candidate browser policy recognizes only dedicated SDK and standard Memory events", () => {
  assert.equal(inspectBrowserMetaRequest("https://connect.facebook.net/en_US/fbevents.js").kind, "sdk");
  assert.equal(inspectBrowserMetaRequest("https://connect.facebook.net/signals/config/1998316064175555").kind, "sdk");
  for (const ev of ["PageView", "Lead", "InitiateCheckout"]) {
    for (const path of ["result", "video/school", "video/advanced"]) {
      assert.equal(inspectBrowserMetaRequest(tracker({
        ev, dl: `http://127.0.0.1:3000/memory-challenge/${path}`,
      })).event, ev);
    }
  }
});

for (const [label, url, method, body] of [
  ["FJ", tracker({ id: "1246171816816642" })],
  ["ambiguous id", tracker() + "&id=1246171816816642"],
  ["ambiguous event", tracker() + "&ev=Purchase"],
  ["browser Purchase", tracker({ ev: "Purchase" })],
  ["root content", tracker({ dl: "http://127.0.0.1:3000/" })],
  ["English content", tracker({ dl: "http://127.0.0.1:3000/vocabulary-vsl" })],
  ["identity query", tracker({ dl: "http://127.0.0.1:3000/memory-challenge/result?email=test" })],
  ["foreign source", tracker({ dl: "https://www.fluencyjet.com/memory-challenge/result" })],
  ["mixed method/body id", tracker(), "POST", "id=1246171816816642"],
  ["foreign SDK config", "https://connect.facebook.net/signals/config/1246171816816642"],
  ["broad SDK plugins", "https://connect.facebook.net/signals/plugins/arbitrary.js"],
  ["lookalike host", "https://connect.facebook.net.attacker.invalid/en_US/fbevents.js"],
  ["HTTP", tracker().replace("https:", "http:")],
  ["userinfo", tracker().replace("www.facebook.com", "user:pass@www.facebook.com")],
  ["port", tracker().replace("www.facebook.com", "www.facebook.com:444")],
  ["GA4", "https://www.google-analytics.com/g/collect"],
  ["Razorpay", "https://checkout.razorpay.com/v1/checkout.js"],
]) {
  test(`candidate policy rejects ${label} before any transport`, () => {
    assert.throws(() => inspectBrowserMetaRequest(url, method, body));
  });
}

test("private parameters rejected recursively; ordinary product description allowed", () => {
  assertPrivateParamsAbsent({ content_name: "Memory class", value: 99, track: "advanced" });
  for (const params of [{ totalScore: 40 }, { email: "fixture@example.test" },
    { nested: { studentName: "Fixture" } }, { items: [{ answers: [] }] }]) {
    assert.throws(() => assertPrivateParamsAbsent(params));
    assert.throws(() => inspectBrowserMetaRequest(tracker({ cd: JSON.stringify(params) })));
  }
  assert.throws(() => inspectBrowserMetaRequest(tracker() + "&cd%5Bscore%5D=40"));
  assert.throws(() => inspectBrowserMetaRequest(tracker() + "&ud%5Bem%5D=hash"));
  assert.throws(() => inspectBrowserMetaRequest(tracker() + "&email=fixture"));
});

function graphOptions() {
  return { method: "POST", redirect: "error",
    headers: { Authorization: `Bearer ${context.accessToken}` },
    body: JSON.stringify({ test_event_code: context.testEventCode, data: [{
      event_name: "Purchase", action_source: "website",
      event_id: "memory_masterclass_99_purchase_pay_offline",
      event_time: Math.floor(Date.now() / 1000),
      event_source_url: "https://www.fluencyjet.com/memory-masterclass/thank-you",
      user_data: { em: ["a".repeat(64)], client_user_agent: "OfflineFixture/1.0" },
      custom_data: { value: 99, currency: "INR" },
    }] }),
  };
}

test("Graph policy fixes standard Purchase, v26 Memory destination, auth and QA code", () => {
  assert.equal(inspectGraphRequest(MEMORY_GRAPH_ENDPOINT, graphOptions(), context).value, 99);
  for (const url of [MEMORY_GRAPH_ENDPOINT.replace("v26.0", "v19.0"),
    MEMORY_GRAPH_ENDPOINT.replace("1998316064175555", "1246171816816642"),
    MEMORY_GRAPH_ENDPOINT + "?access_token=placeholder"]) {
    assert.throws(() => inspectGraphRequest(url, graphOptions(), context));
  }
  for (const modify of [
    options => { options.redirect = "follow"; },
    options => { options.headers.Authorization = "Bearer foreign"; },
    options => { const body=JSON.parse(options.body); delete body.test_event_code; options.body=JSON.stringify(body); },
    options => { const body=JSON.parse(options.body); body.data[0].custom_data.value=1199; options.body=JSON.stringify(body); },
    options => { const body=JSON.parse(options.body); body.data[0].user_data.em=["fixture@example.test"]; options.body=JSON.stringify(body); },
  ]) {
    const options=graphOptions(); modify(options);
    assert.throws(() => inspectGraphRequest(MEMORY_GRAPH_ENDPOINT, options, context));
  }
});

test("mock transport enforces no redirects without changing actual helper payload", () => {
  const options = graphOptions(); delete options.redirect;
  const descriptor = prepareMockGraphReceipt(MEMORY_GRAPH_ENDPOINT, options, context);
  assert.equal(descriptor.options.redirect, "error");
  assert.equal(descriptor.options.body, options.body);
  assert.equal(options.redirect, undefined);
  assert.throws(() => prepareMockGraphReceipt(MEMORY_GRAPH_ENDPOINT, options, { ...context, mode: "real" }));
});

test("direct receipt execution refuses outside sealed private namespace", async () => {
  await assert.rejects(assertReceiptSandbox({}), /Refusing QA|manifest/);
});

test("scratch-only browser assembly preserves every baseline test and fails on shape drift", async () => {
  const original = await readFile(new URL("./memoryConversion.browser.test.mjs", import.meta.url), "utf8");
  const cases = await readFile(new URL("./memoryReceipt.browser.cases.mjs", import.meta.url), "utf8");
  const built = buildReceiptBrowserSuite(original, cases,
    new URL("./memoryReceiptPolicy.mjs", import.meta.url).href,
    new URL("./memoryReceiptFixture.mjs", import.meta.url).href,
    new URL("../../", import.meta.url));
  assert.equal(built.split('test("').length, original.split('test("').length + cases.split('test("').length - 1);
  assert.ok(built.includes("checkout.open BEFORE") === original.includes("checkout.open BEFORE"));
  assert.ok(built.includes("assertPixelDocuments(page)"));
  assert.ok(built.includes("delete window.fbq"));
  assert.throws(() => buildReceiptBrowserSuite(original.replace("  shortViewport = false,", ""), cases, "", "", new URL("../../", import.meta.url)));
});
