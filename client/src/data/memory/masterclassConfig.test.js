import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MEMORY_MASTERCLASS_CONFIG, getMemoryVslId } from "./masterclassConfig.js";

test("both school tracks use the new parent VSL default; advanced uses its own", () => {
  assert.equal(getMemoryVslId("school_foundation"), "1234364593");
  assert.equal(getMemoryVslId("school_advanced"), "1234364593");
  assert.equal(getMemoryVslId("advanced"), "1234364777");
  assert.equal(MEMORY_MASTERCLASS_CONFIG.price, 99);
});

test("production config ignores stale Vite VSL environment overrides", async () => {
  const staleBuildEnv = {
    VITE_MEMORY_PARENT_VSL_ID: "111111111",
    VITE_MEMORY_ADVANCED_VSL_ID: "222222222",
  };
  // Simulate Vite substituting build-time env values without changing any
  // actual environment variables or env files.
  const source = readFileSync(new URL("./masterclassConfig.js", import.meta.url), "utf8")
    .replaceAll("import.meta.env", `(${JSON.stringify(staleBuildEnv)})`);
  const config = await import(`data:text/javascript,${encodeURIComponent(source)}`);
  assert.equal(config.getMemoryVslId("school_foundation"), "1234364593");
  assert.equal(config.getMemoryVslId("school_advanced"), "1234364593");
  assert.equal(config.getMemoryVslId("advanced"), "1234364777");
});

test("explicit config injection and missing-ID behavior remain supported", () => {
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
