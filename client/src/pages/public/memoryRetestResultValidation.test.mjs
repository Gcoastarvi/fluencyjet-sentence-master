import test from "node:test";
import assert from "node:assert/strict";

import {
  isValidMemoryRetestResult,
} from "./memoryRetestResultValidation.mjs";

const COMPLETE = {
  ok: true,
  trackId: "school_foundation",
  formAScore: 40,
  formBScore: 75,
  improvementPoints: 35,
  formBCompletedAt: "2026-10-31T10:00:00.000Z",
};

const B_ONLY = {
  ...COMPLETE,
  formAScore: null,
  improvementPoints: null,
};

test("accepts a valid Before/After result", () => {
  assert.equal(
    isValidMemoryRetestResult(COMPLETE),
    true,
  );
});

test("accepts a genuine Form B-only result", () => {
  assert.equal(
    isValidMemoryRetestResult(B_ONLY),
    true,
  );
});

test("accepts Form B-only zero score", () => {
  assert.equal(
    isValidMemoryRetestResult({
      ...B_ONLY,
      formBScore: 0,
    }),
    true,
  );
});

test("accepts all three supported tracks", () => {
  for (const trackId of [
    "school_foundation",
    "school_advanced",
    "advanced",
  ]) {
    assert.equal(
      isValidMemoryRetestResult({
        ...B_ONLY,
        trackId,
      }),
      true,
    );
  }
});

test("accepts legitimate zero baseline", () => {
  assert.equal(
    isValidMemoryRetestResult({
      ...COMPLETE,
      formAScore: 0,
      improvementPoints: 75,
    }),
    true,
  );
});

test("accepts negative score difference", () => {
  assert.equal(
    isValidMemoryRetestResult({
      ...COMPLETE,
      formAScore: 90,
      formBScore: 75,
      improvementPoints: -15,
    }),
    true,
  );
});

test("rejects missing baseline rather than inventing zero", () => {
  assert.equal(
    isValidMemoryRetestResult({
      ...B_ONLY,
      formAScore: undefined,
    }),
    false,
  );
});

test("rejects missing improvement field", () => {
  assert.equal(
    isValidMemoryRetestResult({
      ...B_ONLY,
      improvementPoints: undefined,
    }),
    false,
  );
});

test("rejects incomplete comparison", () => {
  assert.equal(
    isValidMemoryRetestResult({
      ...COMPLETE,
      improvementPoints: null,
    }),
    false,
  );
});

test("rejects mixed baseline and missing difference", () => {
  assert.equal(
    isValidMemoryRetestResult({
      ...B_ONLY,
      formAScore: 40,
    }),
    false,
  );
});

test("rejects missing Form B score", () => {
  assert.equal(
    isValidMemoryRetestResult({
      ...B_ONLY,
      formBScore: null,
    }),
    false,
  );
});

test("rejects forged score above 100", () => {
  assert.equal(
    isValidMemoryRetestResult({
      ...B_ONLY,
      formBScore: 150,
    }),
    false,
  );
});

test("rejects negative Form B score", () => {
  assert.equal(
    isValidMemoryRetestResult({
      ...B_ONLY,
      formBScore: -1,
    }),
    false,
  );
});

test("rejects numeric scores encoded as strings", () => {
  assert.equal(
    isValidMemoryRetestResult({
      ...B_ONLY,
      formBScore: "75",
    }),
    false,
  );
});

test("rejects invalid tracks", () => {
  assert.equal(
    isValidMemoryRetestResult({
      ...B_ONLY,
      trackId: "other_track",
    }),
    false,
  );
});

test("rejects unsuccessful API responses", () => {
  assert.equal(
    isValidMemoryRetestResult({
      ...B_ONLY,
      ok: false,
    }),
    false,
  );
});

test("rejects invalid completion date", () => {
  assert.equal(
    isValidMemoryRetestResult({
      ...B_ONLY,
      formBCompletedAt: "invalid-date",
    }),
    false,
  );
});

test("rejects empty response", () => {
  assert.equal(
    isValidMemoryRetestResult(null),
    false,
  );
});
