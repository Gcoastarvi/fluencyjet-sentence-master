import test from "node:test";
import assert from "node:assert/strict";
import { getMemoryScoreBand } from "./memoryScoreBand.js";

for (const [score, title] of [
  [0, "NEEDS A BOOST"], [39, "NEEDS A BOOST"], [39.9, "NEEDS A BOOST"],
  [40, "GOOD START"], [69, "GOOD START"], [69.9, "GOOD START"],
  [70, "STRONG START"], [100, "STRONG START"],
]) {
  for (const advanced of [false, true]) {
    test(`${score}: ${title} (${advanced ? "advanced" : "school"})`, () => {
      const band = getMemoryScoreBand(score, advanced);
      assert.equal(band.title, title);
      assert.equal(band.bridge, advanced
        ? "Your score shows WHERE you are. Now see HOW to improve it."
        : "Your score shows WHERE your child is. Now see HOW to improve it.");
      if (advanced) {
        assert.doesNotMatch(band.message, /your child/i);
        assert.match(band.message, /\byou\b/i);
      } else {
        assert.match(band.message, /Your child/i);
      }
    });
  }
}

test("invalid or missing scores do not invent a score band", () => {
  for (const value of [null, undefined, "", -1, 101, NaN, Infinity, "invalid"]) {
    assert.equal(getMemoryScoreBand(value), null);
  }
});

test("school band copy remains exact", () => {
  assert.equal(getMemoryScoreBand(0).message,
    "Your child is studying, but too much is getting forgotten before it is needed. The good news: memory can be trained.");
  assert.equal(getMemoryScoreBand(40).message,
    "Some things are sticking. Some are getting lost. With the right memory method, your child can remember more and recall it faster.");
  assert.equal(getMemoryScoreBand(70).message,
    "Your child already has a strong start. Now the goal is to make memory faster, stronger and more reliable for tests and exams.");
});
