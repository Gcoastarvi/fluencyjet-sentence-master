// Production-bundle browser checks. All page requests are fulfilled from the
// local build or fixtures. Closed proxy also denies browser background traffic.
// No live app server, payment, Meta endpoint or credentials are used.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { dirname, resolve, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
const { chromium } = await import(process.env.BRAINODAD_PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.BRAINODAD_PLAYWRIGHT_MODULE).href : "playwright");
let browser;
before(async () => {
  if (!process.env.BRAINODAD_CHROMIUM) throw new Error("Explicit offline Chromium executable required");
  browser = await chromium.launch({ executablePath: process.env.BRAINODAD_CHROMIUM, headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--disable-background-networking",
      "--disable-component-update", "--no-first-run", "--proxy-server=http://127.0.0.1:9", "--proxy-bypass-list=<-loopback>"] });
});
after(async () => { await browser?.close(); });
const synthetic = { key: "MOCK_ONLY_2030", startsAt: "2030-01-02T11:30:00Z", endsAt: "2030-01-02T13:30:00Z",
  dateISO: "2030-01-02", dateLabel: "MOCK APPROVED TEST SCHEDULE", startTime: "5:00 PM", endTime: "7:00 PM",
  timezone: "Asia/Kolkata", timezoneLabel: "IST", whatsappGroupUrl: "https://chat.whatsapp.com/OfflineFixture" };
const expired = { ...synthetic, startsAt: "2026-10-25T11:30:00Z", endsAt: "2026-10-25T13:30:00Z", dateISO: "2026-10-25", dateLabel: "EXPIRED TEST SCHEDULE" };

async function fixture({ granted = true, schedule = synthetic, width = 390, failedOrder = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block" });
  const requests = [], errors = [];
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    const reply = (body, status = 200, contentType = "application/json") => route.fulfill({ status, contentType, body: typeof body === "string" ? body : JSON.stringify(body) });
    if (url.origin !== "http://brainodad.test") {
      // No external request is continued, including provider scripts/frames.
      return reply("", 200, url.pathname.endsWith(".js") ? "application/javascript" : "text/html");
    }
    if (url.pathname.startsWith("/api/")) {
      requests.push({ path: url.pathname, body: request.postData() ? JSON.parse(request.postData()) : null });
      if (url.pathname === "/api/memory-masterclass/event") return reply({ ok: true, event: schedule });
      if (url.pathname.startsWith("/api/memory-meta/consent")) {
        const body = request.postDataJSON();
        return reply({ ok: true, granted: body.granted ?? granted, receipt: body.receipt || "a".repeat(64), version: "memory_meta_v1", expiresAt: "2099-01-01" });
      }
      if (url.pathname.endsWith("/create-order")) return failedOrder
        ? reply({ ok: false, message: "Mock payment unavailable" }, 503)
        : reply({ ok: true, keyId: "offline-public-fixture", orderId: "order_offline", amount: 9900, currency: "INR" });
      return reply({ ok: false }, 401);
    }
    if (url.pathname.startsWith("/assets/")) {
      const path = resolve(root, "." + url.pathname);
      if (!path.startsWith(root + "/")) return reply("", 403);
      const contentType = extname(path) === ".js" ? "application/javascript" : "text/css";
      return route.fulfill({ body: await readFile(path), contentType });
    }
    if (/\.(png|jpe?g|webp|svg|ico)$/.test(url.pathname)) return reply("", 404, "text/plain");
    return route.fulfill({ body: await readFile(resolve(root, "index.html")), contentType: "text/html" });
  });
  await context.addInitScript(({ granted }) => {
    window.metaCalls = []; window.gtag = () => {};
    window.fbq = (...args) => window.metaCalls.push(args);
    if (granted) localStorage.setItem("brainodad_meta_consent_v1", JSON.stringify({ granted: true,
      receipt: "a".repeat(64), version: "memory_meta_v1", expiresAt: "2099-01-01" }));
    window.offlineOpens = 0;
    window.Razorpay = class { on() {} open() { window.offlineOpens++; } };
  }, { granted });
  const page = await context.newPage();
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("http://brainodad.test/memory-masterclass/parents");
  await page.locator(".bdp-header").waitFor();
  await page.waitForFunction(() => document.body.textContent.includes("TEST SCHEDULE"));
  if (granted) await page.waitForFunction(() => window.memoryMetaConsentVerified === true);
  return { context, page, requests, errors, close: () => context.close() };
}
const meta = page => page.evaluate(() => window.metaCalls.filter(c => /^trackSingle/.test(c[0])));

for (const width of [390, 1280]) test(`Parents production layout, live schedule and correct Pixel at ${width}px`, async () => {
  const f = await fixture({ width });
  try {
    assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    assert.equal(await f.page.getByText("MOCK APPROVED TEST SCHEDULE", { exact: false }).count() > 0, true);
    assert.equal(await f.page.getByRole("button", { name: /Book My Child's Seat/ }).first().isEnabled(), true);
    const calls = await f.page.evaluate(() => window.metaCalls);
    assert.deepEqual(calls.filter(c => c[0] === "init"), [["init", "1998316064175555"]]);
    assert.equal((await meta(f.page)).filter(c => c[2] === "PageView").length, 1);
    assert.ok(calls.every(c => c[1] !== "1246171816816642"));
    if (process.env.BRAINODAD_SCREENSHOTS) {
      await mkdir(process.env.BRAINODAD_SCREENSHOTS, { recursive: true });
      await f.page.screenshot({ path: resolve(process.env.BRAINODAD_SCREENSHOTS, `parents-${width}.png`) });
    }
    assert.deepEqual(f.errors, []);
  } finally { await f.close(); }
});

test("expired approved event disables booking without inventing another schedule", async () => {
  const f = await fixture({ schedule: expired });
  try {
    assert.equal(await f.page.getByRole("button", { name: /Book My Child's Seat/ }).first().isDisabled(), true);
    assert.match(await f.page.locator(".bdp-event-status").innerText(), /schedule needs confirmation/);
    assert.equal(f.requests.some(r => r.path.endsWith("/create-order")), false);
  } finally { await f.close(); }
});

test("registration stays checkbox-free; verified adult CTA and mocked Razorpay opening do not produce Purchase", async () => {
  const f = await fixture();
  try {
    await f.page.getByRole("button", { name: /Book My Child's Seat/ }).first().click();
    const dialog = f.page.getByRole("dialog"); await dialog.waitFor();
    assert.equal(await dialog.getByRole("checkbox").count(), 0);
    await dialog.getByRole("button", { name: "Privacy choices", exact: true }).click();
    assert.equal(await dialog.getByText("What is shared?", { exact: true }).isVisible(), true);
    await dialog.getByLabel("Name", { exact: true }).fill("Adult Fixture");
    await dialog.getByLabel("Email", { exact: true }).fill("adult@example.test");
    await dialog.getByLabel("Phone", { exact: true }).fill("9111111111");
    await dialog.getByRole("button", { name: /Continue to Payment/ }).click();
    await f.page.waitForFunction(() => window.offlineOpens === 1);
    const calls = await meta(f.page);
    assert.equal(calls.filter(c => c[2] === "memory_offer_click").length, 1);
    assert.equal(calls.filter(c => c[2] === "InitiateCheckout").length, 1);
    assert.equal(calls.filter(c => c[2] === "Purchase").length, 0);
    assert.equal(f.requests.filter(r => r.path.endsWith("/create-order")).length, 1);
    assert.deepEqual(f.errors, []);
  } finally { await f.close(); }
});

test("no-choice booking remains available without browser Meta or auto-consent", async () => {
  const f = await fixture({ granted: false });
  try {
    await f.page.getByRole("button", { name: /Book My Child's Seat/ }).first().click();
    const dialog = f.page.getByRole("dialog");
    await dialog.getByLabel("Name", { exact: true }).fill("Adult Fixture");
    await dialog.getByLabel("Email", { exact: true }).fill("adult@example.test");
    await dialog.getByLabel("Phone", { exact: true }).fill("9111111111");
    await dialog.getByRole("button", { name: /Continue to Payment/ }).click();
    await f.page.waitForFunction(() => window.offlineOpens === 1);
    assert.deepEqual(await f.page.evaluate(() => window.metaCalls.filter(c => c[0] === "init" || /^trackSingle/.test(c[0]))), []);
    assert.equal(f.requests.some(r => r.path === "/api/memory-meta/consent" && r.body?.granted === true), false);
    assert.equal(f.requests.find(r => r.path.endsWith("/create-order")).body.memoryMetaConsentReceipt, null);
  } finally { await f.close(); }
});

test("failed mocked order cannot emit InitiateCheckout or Purchase", async () => {
  const f = await fixture({ failedOrder: true });
  try {
    await f.page.getByRole("button", { name: /Book My Child's Seat/ }).first().click();
    const d = f.page.getByRole("dialog");
    await d.getByLabel("Name", { exact: true }).fill("Adult Fixture");
    await d.getByLabel("Email", { exact: true }).fill("adult@example.test");
    await d.getByLabel("Phone", { exact: true }).fill("9111111111");
    await d.getByRole("button", { name: /Continue to Payment/ }).click();
    await f.page.getByText(/Mock payment unavailable|Unable to start secure checkout/).waitFor();
    assert.ok((await meta(f.page)).every(c => !["InitiateCheckout", "Purchase"].includes(c[2])));
  } finally { await f.close(); }
});

test("class CTA preserves school track and navigates without student Meta telemetry", async () => {
  const f = await fixture();
  try {
    await f.page.getByRole("button", { name: "6th", exact: true }).click();
    await f.page.getByRole("button", { name: /Start 6th Memory Test/ }).click();
    await f.page.waitForURL("**/memory-challenge/start");
    assert.equal(await f.page.evaluate(() => sessionStorage.getItem("memory_track")), "school_foundation");
    const calls = await meta(f.page);
    assert.equal(calls.filter(c => c[2] === "memory_track_selected").length, 1);
    assert.ok(calls.every(c => !JSON.stringify(c[3]).includes("school_foundation")));
    assert.equal(calls.filter(c => c[2] === "PageView").length, 1);
    assert.deepEqual(f.errors, []);
  } finally { await f.close(); }
});

test("privacy decline/withdrawal remains available without enabling student measurement", async () => {
  const f = await fixture();
  try {
    await f.page.goto("http://brainodad.test/memory-challenge");
    await f.page.getByRole("button", { name: "Privacy choices", exact: true }).click();
    await f.page.getByRole("button", { name: "Withdraw measurement consent", exact: true }).click();
    await f.page.waitForFunction(() => JSON.parse(localStorage.getItem("brainodad_meta_consent_v1")).granted === false);
    assert.equal((await meta(f.page)).length, 0);
  } finally { await f.close(); }
});

for (const path of ["/spoken-english-vsl", "/vocabulary-vsl", "/german-live-class"]) test(`other product keeps only FluencyJet Pixel: ${path}`, async () => {
  const f = await fixture();
  try {
    await f.page.goto("http://brainodad.test" + path);
    await f.page.waitForFunction(() => window.metaCalls.some(c => c[0] === "init"));
    const calls = await f.page.evaluate(() => window.metaCalls);
    assert.deepEqual(calls.filter(c => c[0] === "init"), [["init", "1246171816816642"]]);
    assert.equal(await f.page.getByRole("contentinfo", { name: "Privacy choices" }).count(), 0);
    assert.deepEqual(f.errors, []);
  } finally { await f.close(); }
});
