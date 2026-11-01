import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getPublicMemoryMasterclassEvent } from
  "../../server/config/memoryMasterclassEvent.js";

const source = readFileSync(
  new URL(
    "../src/pages/public/MemoryMasterclassParents.jsx",
    import.meta.url
  ),
  "utf8"
);

const event = getPublicMemoryMasterclassEvent();

test("Parents page matches approved backend event", () => {
  assert.equal(event.dateISO, "2026-11-15");

  assert.ok(source.includes(
    `const EVENT_DATE = "${event.dateISO}";`
  ));

  assert.ok(source.includes(
    "event && String(event.dateISO).slice(0, 10) === EVENT_DATE"
  ));
});

test("all Parents date references show November 15", () => {
  assert.ok(source.includes(
    "LIVE ONLINE · SUNDAY, 15 NOVEMBER 2026 · 5–7 PM IST"
  ));

  assert.equal(
    source.split("Sunday, 15 November · 5–7 PM IST").length - 1,
    2
  );

  assert.ok(source.includes(
    "Sunday, 15 November 2026 · 5–7 PM IST"
  ));

  assert.ok(source.includes(
    "Confirm the November 15 event in the existing scheduling system."
  ));

  assert.doesNotMatch(
    source,
    /2026-10-25|25 October|25 OCTOBER|October 25/
  );
});
