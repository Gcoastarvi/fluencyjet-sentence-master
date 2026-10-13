import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const consent = readFileSync(new URL("./MemoryMetaConsent.jsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../../App.jsx", import.meta.url), "utf8");
const disclaimer = "This website is independently operated by BrainoDad and is not affiliated with, sponsored by, or endorsed by Meta Platforms, Inc., Facebook, or Instagram. Facebook and Instagram are trademarks of Meta Platforms, Inc.";
test("footer includes exact disclaimer once, after consent", () => {
  assert.equal(consent.split(disclaimer).length-1, 1);
  assert.ok(consent.indexOf(disclaimer)>consent.indexOf("Read the full disclosure"));
});
test("consent follows routed content inside Memory document boundary", () => {
  assert.equal(app.split("<MemoryMetaConsent />").length-1, 1);
  assert.ok(app.indexOf("<MemoryMetaConsent />")>app.lastIndexOf("</Suspense>"));
  assert.ok(app.indexOf("<MemoryMetaConsent />")<app.lastIndexOf("</FunnelDocumentBoundary>"));
});
test("footer is Memory-only with explicit adult opt-in and withdrawal", () => {
  for (const text of ['if (!memory || pathname !== "/memory-challenge") return null',"I am 18 or older — allow measurement","Withdraw measurement consent","Decline measurement","Your choice is remembered for 30 days."]) assert.ok(consent.includes(text));
});
