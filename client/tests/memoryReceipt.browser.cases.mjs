// Appended to an unchanged-source copy of the existing browser suite IN SCRATCH.
// Identifiers belong to synthetic fixtures; all requests are fulfilled offline.
for (const track of ["school_foundation", "school_advanced", "advanced"]) {
  test(`mock receipt: result ${track} saved-only Lead then opened checkout`, async () => {
    const page = await fixture({ track, receiptMock: true });
    try {
      await page.waitFor("window.fixtureSdkReady === true");
      assert.equal(page.receiptRequests.filter(r => r.event === "Lead").length, 0);
      await page.submit();
      await page.waitFor('window.metaCalls.some(c => c[2] === "Lead")');
      await page.waitFor('!!document.querySelector("dialog[open] iframe") && document.activeElement === document.querySelector(\'dialog[open] button[aria-label="Close"]\')');
      await page.escape();
      await page.waitFor('!document.querySelector("dialog[open]")');
      // The result's inline CTA mounts before its shared schedule is loaded.
      // A usable registration click requires that real UI prerequisite too.
      await page.waitFor(`document.body.innerText.includes(${JSON.stringify(getPublicMemoryMasterclassEvent().dateLabel)})`);
      await page.waitFor('[...document.querySelectorAll("button")].some(b => /Book My (Child.s )?Seat/i.test(b.textContent) && !b.disabled)');
      await page.evaluate(`
        window.Razorpay = class {
          constructor() {} on() {}
          open() { window.fixtureOpenSucceeded=true; window.fixtureCheckoutSequence.push("open succeeded"); }
        };
        [...document.querySelectorAll("button")].find(b => /Book My (Child.s )?Seat/i.test(b.textContent) && !b.disabled).click();
      `);
      await page.waitFor('!!document.querySelector("dialog[open]")');
      await registerPurchaser(page);
      await page.waitFor('window.metaCalls.some(c => c[2] === "InitiateCheckout")');
      await pause(100);
      assert.equal(page.receiptRequests.filter(r => r.event === "Lead").length, 1);
      assert.equal(page.receiptRequests.filter(r => r.event === "InitiateCheckout").length, 1);
      assert.deepEqual(await page.evaluate("window.fixtureCheckoutSequence"),
        ["open succeeded", "InitiateCheckout"]);
      assert.ok(page.receiptRequests.every(r => r.pixel === "1998316064175555" &&
        r.path === "/memory-challenge/result"));
      assert.equal(await page.evaluate("window.fixtureReceiptError || null"), null);
      const documentId = await page.evaluate("window.fixtureDocumentId");
      await page.evaluate("location.reload()");
      await page.waitCommittedDocument("/memory-challenge/result", "1998316064175555",
        { freshFrom: documentId, probe: false });
      assert.equal(page.receiptRequests.filter(r => r.event === "Lead").length, 1);
      assert.equal(await page.evaluate('window.metaCalls.some(c => c[2] === "Purchase")'), false);
      await assertPixelDocuments(page);
    } finally { await page.close(); }
  });
}

for (const audience of ["school", "advanced"]) {
  test(`mock receipt: standalone ${audience} opens before standard checkout`, async () => {
    const page = await fixture({
      path: `/memory-challenge/video/${audience}`, receiptMock: true,
    });
    try {
      await page.waitFor("window.fixtureSdkReady === true");
      await page.evaluate(`
        window.Razorpay = class {
          constructor() {} on() {}
          open() { window.fixtureOpenSucceeded=true; window.fixtureCheckoutSequence.push("open succeeded"); }
        };
        document.querySelector("[data-placement=below_video]:not([disabled])").click();
      `);
      await page.waitFor('!!document.querySelector("dialog[open]")');
      if (audience === "school") {
        await page.evaluate(`(() => {
          const select=document.querySelector("dialog select");
          Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value").set.call(select,"6-8");
          select.dispatchEvent(new Event("change",{bubbles:true}));
        })()`);
      }
      await registerPurchaser(page);
      await page.waitFor('window.metaCalls.some(c => c[2] === "InitiateCheckout")');
      await pause(100);
      assert.equal(page.leadRequests.length, 0);
      assert.equal(page.receiptRequests.filter(r => r.event === "Lead").length, 0);
      assert.equal(page.receiptRequests.filter(r => r.event === "InitiateCheckout").length, 1);
      assert.deepEqual(await page.evaluate("window.fixtureCheckoutSequence"),
        ["open succeeded", "InitiateCheckout"]);
      assert.ok(page.receiptRequests.every(r => r.pixel === "1998316064175555" &&
        r.path === `/memory-challenge/video/${audience}`));
      assert.equal(await page.evaluate("window.fixtureReceiptError || null"), null);
      assert.equal(await page.evaluate('window.metaCalls.some(c => c[2] === "Purchase")'), false);
      await assertPixelDocuments(page);
    } finally { await page.close(); }
  });
}

test("mock SDK receipt: rejected lead save produces no Lead", async () => {
  const page = await fixture({ receiptMock: true, failLead: true });
  try {
    await page.waitFor("window.fixtureSdkReady === true");
    await page.submit();
    await page.waitFor('document.body.innerText.includes("Fixture save failed")');
    assert.equal(page.receiptRequests.filter(r => r.event === "Lead").length, 0);
    assert.equal(await page.evaluate('window.metaCalls.some(c => ["Lead","InitiateCheckout","Purchase"].includes(c[2]))'), false);
    await assertPixelDocuments(page);
  } finally { await page.close(); }
});

for (const audience of ["assessment", "school", "advanced"]) {
  test(`mock SDK receipt: ${audience} open throws suppresses checkout`, async () => {
    const page = await fixture({
      receiptMock: true, saved: audience === "assessment",
      path: audience === "assessment" ? "/memory-challenge/result" : `/memory-challenge/video/${audience}`,
    });
    try {
      await page.waitFor("window.fixtureSdkReady === true");
      await page.waitFor('[...document.querySelectorAll("button")].some(b => /Book My (Child.s )?Seat/i.test(b.textContent) && !b.disabled)');
      await page.evaluate(`
        window.Razorpay = class {
          constructor() {} on() {}
          open() { window.fixtureCheckoutSequence.push("open throws"); throw new Error("Offline mock open refused"); }
        };
        [...document.querySelectorAll("button")].find(b => /Book My (Child.s )?Seat/i.test(b.textContent) && !b.disabled).click();
      `);
      await page.waitFor('!!document.querySelector("dialog[open]")');
      if (audience === "school") {
        await page.evaluate(`(() => {
          const select=document.querySelector("dialog select");
          Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value").set.call(select,"6-8");
          select.dispatchEvent(new Event("change",{bubbles:true}));
        })()`);
      }
      await registerPurchaser(page);
      await page.waitFor('window.fixtureCheckoutSequence.includes("open throws")');
      assert.deepEqual(await page.evaluate("window.fixtureCheckoutSequence"), ["open throws"]);
      assert.equal(page.receiptRequests.filter(r => r.event === "InitiateCheckout").length, 0);
      assert.equal(await page.evaluate('window.metaCalls.some(c => ["Lead","InitiateCheckout","Purchase"].includes(c[2]))'), false);
      await assertPixelDocuments(page);
    } finally { await page.close(); }
  });
}
