import test from "node:test";
import assert from "node:assert/strict";
import { MEMORY_MASTERCLASS_CONFIG, getMemoryVslId } from "./masterclassConfig.js";

test("both school tracks use the new parent VSL default; advanced uses its own", () => {
  assert.equal(getMemoryVslId("school_foundation"), "1234364593");
  assert.equal(getMemoryVslId("school_advanced"), "1234364593");
  assert.equal(getMemoryVslId("advanced"), "1234364777");
  assert.equal(MEMORY_MASTERCLASS_CONFIG.price, 99);
});

test("configured VSL overrides and missing-ID behavior remain supported", () => {
  const overrides = { parentVimeoId: "111111111", advancedVimeoId: "222222222" };
  assert.equal(getMemoryVslId("school_foundation", overrides), "111111111");
  assert.equal(getMemoryVslId("school_advanced", overrides), "111111111");
  assert.equal(getMemoryVslId("advanced", overrides), "222222222");
  assert.equal(getMemoryVslId("advanced", { advancedVimeoId: "" }), "");
});

test("frontend static config does not duplicate the server schedule or weekly link", () => {
  for (const key of ["dateISO", "dateLabel", "startTime", "endTime", "timezone", "whatsappGroupUrl"]) {
    assert.equal(Object.hasOwn(MEMORY_MASTERCLASS_CONFIG, key), false);
  }
});
