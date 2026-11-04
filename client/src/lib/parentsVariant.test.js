import { test } from "node:test";
import assert from "node:assert/strict";
import { PARENTS_VARIANT_KEY, parentsVariant } from "./parentsVariant.js";

function store(initial = {}) {
  const map = new Map(Object.entries(initial));
  return { map, getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
}

test("no tag and no saved choice shows the original page (A)", () => {
  assert.equal(parentsVariant("", store()), "a");
  assert.equal(parentsVariant("?utm_source=fb&utm_content=other_ad", store()), "a");
});

test("utm_content=parents_b shows B and remembers it for the session", () => {
  const s = store();
  assert.equal(parentsVariant("?utm_source=fb&utm_content=parents_b", s), "b");
  assert.equal(s.map.get(PARENTS_VARIANT_KEY), "b");
  assert.equal(parentsVariant("", s), "b");
});

test("utm_content=parents_a overrides an earlier B choice", () => {
  const s = store({ [PARENTS_VARIANT_KEY]: "b" });
  assert.equal(parentsVariant("?utm_content=parents_a", s), "a");
  assert.equal(parentsVariant("", s), "a");
});

test("tag matching ignores case and spaces", () => {
  assert.equal(parentsVariant("?utm_content=%20Parents_B%20", store()), "b");
});

test("unknown saved values and broken storage fall back to A", () => {
  assert.equal(parentsVariant("", store({ [PARENTS_VARIANT_KEY]: "c" })), "a");
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.equal(parentsVariant("", broken), "a");
  assert.equal(parentsVariant("?utm_content=parents_b", broken), "b");
  assert.equal(parentsVariant("?utm_content=parents_b", undefined), "b");
});
