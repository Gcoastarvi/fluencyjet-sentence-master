import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "@jest/globals";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(testDirectory, "../..");

function readClientSource(relativePath) {
  return fs.readFileSync(path.join(workspaceRoot, relativePath), "utf8");
}

describe("Sentence Master payment-link checkout intent contract", () => {
  test.each([
    "client/src/pages/marketing/SpokenEnglishOffer.jsx",
    "client/src/pages/marketing/SpokenEnglishOfferV2.jsx",
    "client/src/components/marketing/LaunchOfferCard.jsx",
  ])("%s routes payment navigation through the shared intent helper", (file) => {
    const source = readClientSource(file);

    expect(source).toContain("startSentenceMasterPaymentRedirect");
    expect(source).not.toMatch(
      /onClick=\{trackSpokenEnglishInitiateCheckout\}/,
    );
  });

  test("the shared helper awaits bounded intent recording before every redirect branch", () => {
    const source = readClientSource("client/src/lib/checkoutIntent.js");
    const intentIndex = source.indexOf(
      "await recordSentenceMasterCheckoutIntent()",
    );
    const delayedRedirectIndex = source.indexOf(
      "window.setTimeout",
      intentIndex,
    );
    const immediateRedirectIndex = source.indexOf(
      "window.location.href = paymentUrl",
      delayedRedirectIndex + 1,
    );

    expect(intentIndex).toBeGreaterThan(-1);
    expect(delayedRedirectIndex).toBeGreaterThan(intentIndex);
    expect(immediateRedirectIndex).toBeGreaterThan(delayedRedirectIndex);
  });
});