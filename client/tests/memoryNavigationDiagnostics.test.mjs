import { test } from "node:test";
import assert from "node:assert/strict";
import { NavigationDiagnostics, navigationPath, expectedPixel, cancelledInterception, disableQaHmrTransport } from "./memoryNavigationDiagnostics.mjs";

function fixture(path = "/memory-challenge/video/school", earlyPath = path) {
  const ledger = new NavigationDiagnostics("frame");
  ledger.receive("Page.frameNavigated", { frame: { id: "frame", loaderId: "loader",
    url: `http://127.0.0.1:3000${path}?private=query#private` } });
  ledger.receive("Runtime.executionContextCreated", { context: { id: 1,
    auxData: { frameId: "frame", isDefault: true } } });
  function binding(data) {
    ledger.receive("Runtime.bindingCalled", { name: "fixtureNavigationDiagnostic", executionContextId: 1,
      payload: JSON.stringify({ docId: "doc", initialPath: earlyPath, path, timeOrigin: 1, ...data }) });
  }
  binding({ kind: "boot" });
  const pixel = expectedPixel(path);
  binding({ kind: "sdk", command: "init", pixel });
  const record = { id: "doc", initialPath: earlyPath,
    calls: pixel === "1998316064175555" ? [["set", "autoConfig", false, pixel], ["init", pixel]]
      : [["init", pixel]], leaks: [] };
  return { ledger, binding, record };
}

test("diagnostics remove query/hash values and classify encoded committed paths independently", () => {
  assert.equal(navigationPath("http://127.0.0.1:3000/memory-challenge/result?secret=x#token"), "/memory-challenge/result");
  assert.equal(expectedPixel("/%6demory-challenge/result"), "1998316064175555");
  const { ledger } = fixture();
  assert.ok(!ledger.report().includes("private"));
});

test("committed owner, not early fixture pathname, is authoritative", () => {
  const { ledger, record } = fixture("/memory-challenge/result", "/vocabulary-vsl");
  ledger.assertRecords([record]);
  assert.equal(ledger.commits.get("loader").expectedPixel, "1998316064175555");
});

test("real wrong-pixel initialization still fails with offending document evidence", () => {
  const { ledger, record } = fixture("/vocabulary-vsl");
  record.calls = [["init", "1998316064175555"]];
  assert.throws(() => ledger.assertRecords([record]), /Offending document doc/);
});

test("second pixel, duplicate init, wrong dispatch or DOM exposure cannot pass", () => {
  for (const mutate of [
    r => r.calls.push(["init", "1246171816816642"]),
    r => r.calls.push(["init", "1998316064175555"]),
    r => r.calls.push(["trackSingle", "1246171816816642", "PageView"]),
    r => r.leaks.push("FJ could inspect memory DOM"),
  ]) {
    const { ledger, record } = fixture();
    mutate(record);
    assert.throws(() => ledger.assertRecords([record]));
  }
});

test("missing commit/context association fails closed", () => {
  const { ledger, record } = fixture();
  ledger.commits.clear();
  assert.throws(() => ledger.assertRecords([record]), /Missing independent navigation evidence/);
});

test("interception errors are ignored only with confirmed browser cancellation", () => {
  const error = new Error("Invalid InterceptionId.");
  assert.equal(cancelledInterception(error, { networkId: "cancelled" }, new Set(["cancelled"])), true);
  assert.equal(cancelledInterception(error, { networkId: "other" }, new Set(["cancelled"])), false);
  assert.equal(cancelledInterception(error, {}, new Set(["cancelled"])), false);
  assert.equal(cancelledInterception(new Error("SDK failed"), { networkId: "cancelled" }, new Set(["cancelled"])), false);
});
test("two fixture records cannot masquerade as distinct documents for one loader", () => {
  const { ledger, record } = fixture();
  assert.throws(() => ledger.assertRecords([record, record]), /Multiple fixture documents/);
});

test("QA removes only the recognized dev socket bootstrap and preserves style helpers", () => {
  const connect = "socket = setupWebSocket(socketProtocol, socketHost, fallback);";
  const source = `export function updateStyle() {}\n${connect}\nexport function removeStyle() {}`;
  const result = disableQaHmrTransport(source);
  assert.ok(!result.includes(connect));
  assert.ok(result.startsWith("export function updateStyle() {}"));
  assert.ok(result.endsWith("export function removeStyle() {}"));
  assert.throws(() => disableQaHmrTransport("unknown bootstrap"));
  assert.throws(() => disableQaHmrTransport(connect + connect));
});

test("BFCache restoration and same-document history never rewrite birth ownership", () => {
  const { ledger, binding, record } = fixture();
  ledger.receive("Page.navigatedWithinDocument", { frameId: "frame",
    url: "http://127.0.0.1:3000/vocabulary-vsl?private=x" });
  ledger.receive("Page.frameNavigated", { type: "BackForwardCacheRestore",
    frame: { id: "frame", loaderId: "loader", url: "http://127.0.0.1:3000/vocabulary-vsl" } });
  binding({ kind: "lifecycle", event: "pageshow", trusted: true, persisted: true });
  binding({ kind: "lifecycle", event: "pageshow", trusted: false, persisted: true });
  assert.equal(ledger.commits.get("loader").committedPath, "/memory-challenge/video/school");
  assert.deepEqual(ledger.documents.get("doc").lifecycle.map(e => e.trusted), [true, false]);
  ledger.assertRecords([record]);
});

test("settled snapshot rejects a different loader and SDK binding cannot hide behind storage", () => {
  const { ledger, binding, record } = fixture();
  assert.throws(() => ledger.settle("doc", { id: "frame", loaderId: "other", url: "/" }));
  binding({ kind: "sdk", command: "init", pixel: "1246171816816642" });
  assert.throws(() => ledger.assertRecords([record]));
});
