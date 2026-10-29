import { test } from "node:test";
import assert from "node:assert/strict";
import { reportSavedMemoryCompletion } from "./memorySavedCompletion.js";

test("scoring-only, failed or missing saved session produces no completion", () => {
  for (const savedSessionKey of [null, undefined, "", false]) {
    assert.equal(reportSavedMemoryCompletion({ savedSessionKey }, () => assert.fail("No saved session"), {}), false);
  }
});
test("saved completion emits once across callback retries and reloads without sharing its key", () => {
  const storage = new Map(), events = [];
  const fixture = () => ({ sessionStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v) } });
  const w = fixture(), input = { savedSessionKey: "private-session", track: "school_foundation", form: "A" };
  const emit = (...args) => events.push(args);
  assert.equal(reportSavedMemoryCompletion(input, emit, w), true);
  assert.equal(reportSavedMemoryCompletion(input, emit, w), false);
  assert.equal(reportSavedMemoryCompletion(input, emit, fixture()), false);
  assert.deepEqual(events, [["memory_test_completed", { funnel: "amaze_memory", track: "school_foundation", form: "A" }]]);
  assert.ok(!JSON.stringify(events).includes("private-session"));
});
test("a new legitimately saved session is a new completion", () => {
  const w = {}, events = [];
  for (const savedSessionKey of ["first", "second"]) {
    assert.equal(reportSavedMemoryCompletion({ savedSessionKey }, (...e) => events.push(e), w), true);
  }
  assert.equal(events.length, 2);
});
