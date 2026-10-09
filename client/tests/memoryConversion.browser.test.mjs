// Run with the existing Vite workflow: node --test client/tests/memoryConversion.browser.test.mjs
// All API calls and external traffic are intercepted; no leads or payments are created.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPublicMemoryMasterclassEvent } from "../../server/config/memoryMasterclassEvent.js";

const app = "http://127.0.0.1:3000";
const debug = "http://127.0.0.1:9223";
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let browser, profile;

before(async () => {
  profile = await mkdtemp(join(tmpdir(), "memory-conversion-"));
  const executable = existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : "chromium";
  browser = spawn(executable, [
    "--headless", "--no-sandbox", "--disable-dev-shm-usage",
    "--remote-debugging-port=9223", `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore" });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${debug}/json/version`)).ok) return; } catch {}
    await pause(100);
  }
  throw new Error("Chromium did not start");
});

after(async () => {
  browser?.kill();
  if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 5 });
});

async function fixture({
  track = "school_foundation", score = 39, video = true, vslOverrides = false,
  mobile = false, saved = false, failLead = false, failEvent = false,
  event = getPublicMemoryMasterclassEvent(), path = "/memory-challenge/result",
  heroAvailable = false,
} = {}) {
  const target = await (await fetch(`${debug}/json/new?about:blank`, { method: "PUT" })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener("open", resolve, { once: true }));
  let sequence = 0;
  const pending = new Map();
  const errors = [];
  const leadRequests = [];
  const apiRequests = [];

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 10000);
      pending.set(id, { resolve, reject, timeout });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function fulfill(requestId, body, type = "application/json", status = 200) {
    return send("Fetch.fulfillRequest", {
      requestId, responseCode: status,
      responseHeaders: [{ name: "Content-Type", value: type }],
      body: Buffer.from(body).toString("base64"),
    });
  }
  async function intercept({ requestId, request, resourceType }) {
    const url = new URL(request.url);
    if (url.pathname === "/images/memory-challenge-hero.webp") {
      // Exercise the layout without pretending the real portrait has been uploaded.
      return heroAvailable
        ? fulfill(requestId, '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="275"><rect width="220" height="275" fill="#e0e7ff"/></svg>', "image/svg+xml")
        : fulfill(requestId, "", "text/plain", 404);
    }
    if (url.pathname === "/src/pages/public/MemoryChallengeResult.jsx") {
      const source = (await (await fetch(request.url)).text()).replace(
        /const MEMORY_SESSION_PERSISTENCE_ENABLED =[\s\S]*?;/,
        "const MEMORY_SESSION_PERSISTENCE_ENABLED = true;",
      );
      return fulfill(requestId, source, "application/javascript");
    }
    if (url.pathname === "/src/data/memory/masterclassConfig.js") {
      const source = (await (await fetch(request.url)).text())
        .replace(/parentVimeoId:[\s\S]*?,/, `parentVimeoId: "${video ? (vslOverrides ? "111111111" : "1234364593") : ""}",`)
        .replace(/advancedVimeoId:[\s\S]*?,/, `advancedVimeoId: "${video ? (vslOverrides ? "222222222" : "1234364777") : ""}",`);
      return fulfill(requestId, source, "application/javascript");
    }
    if (url.pathname.startsWith("/api/")) {
      apiRequests.push(url.pathname);
      if (url.pathname === "/api/memory-masterclass/event") {
        return fulfill(requestId, JSON.stringify(failEvent
          ? { ok: false, message: "Fixture event unavailable" }
          : { ok: true, event }), "application/json", failEvent ? 503 : 200);
      }
      if (url.pathname.endsWith("/memory/session/lead")) {
        leadRequests.push(JSON.parse(request.postData || "{}"));
        return fulfill(requestId, JSON.stringify(failLead
          ? { ok: false, message: "Fixture save failed" }
          : { ok: true, lead: { saved: true } }), "application/json", failLead ? 500 : 200);
      }
      return fulfill(requestId, JSON.stringify({
        ok: true, details: { name: "Fixture purchaser", email: "fixture@example.test", phone: "9876543210" },
      }));
    }
    if (url.origin !== app) {
      return resourceType === "Document"
        ? fulfill(requestId, "<!doctype html><title>External fixture</title>", "text/html")
        : fulfill(requestId, "", resourceType === "Script" ? "application/javascript" : "text/plain");
    }
    return send("Fetch.continueRequest", { requestId });
  }
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const operation = pending.get(message.id);
      if (!operation) return;
      clearTimeout(operation.timeout);
      pending.delete(message.id);
      if (message.error) operation.reject(new Error(message.error.message));
      else operation.resolve(message.result);
    } else if (message.method === "Fetch.requestPaused") {
      intercept(message.params).catch(error => {
        // StrictMode/unmount aborts the event fetch. Chromium can invalidate its
        // paused request before fulfillment; this is not an application error.
        if (error.message === "Invalid InterceptionId." &&
            new URL(message.params.request.url).pathname === "/api/memory-masterclass/event") {
          return;
        }
        errors.push(`${message.params.request.url}: ${error.message}`);
      });
    } else if (message.method === "Runtime.exceptionThrown") {
      errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    } else if (message.method === "Log.entryAdded" && message.params.entry.text.includes("module script")) {
      errors.push(message.params.entry.text);
    }
  });
  async function evaluate(expression) {
    const response = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  }
  async function waitFor(expression) {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(`document.body && (${expression})`)) return;
      await pause(50);
    }
    const state = await evaluate('({url:location.href, text:document.body.innerText.slice(0,500), keys:Object.keys(sessionStorage), desktop:matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)").matches, pointer:matchMedia("(pointer: fine)").matches, hover:matchMedia("(hover: hover)").matches})');
    throw new Error(`Condition not met: ${expression}\n${JSON.stringify(state)}\n${errors.join("\n")}`);
  }
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Page.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
  await send("Emulation.setDeviceMetricsOverride", {
    width: mobile ? 390 : 1280, height: mobile ? 844 : 900,
    deviceScaleFactor: 1, mobile,
  });
  await send("Emulation.setTouchEmulationEnabled", { enabled: mobile });
  const modules = Object.fromEntries(["immediate", "ordered", "association", "academic", "delayed"].map(
    key => [key, { correct: 2, maxRaw: 5, percentage: 40, weightedScore: 8, maxWeighted: 20 }],
  ));
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    // Headless Chromium has no physical mouse. Model desktop hardware only;
    // leave viewport/reduced-motion queries and the production logic intact.
    ${!mobile ? `
      const nativeMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = query => nativeMatchMedia(query
        .replace(/\\(hover:\\s*hover\\)/g, "(min-width: 0px)")
        .replace(/\\(pointer:\\s*fine\\)/g, "(min-width: 0px)"));
    ` : ""}
    sessionStorage.clear();
    sessionStorage.setItem("memory_track", ${JSON.stringify(track)});
    sessionStorage.setItem("memory_form_a_owner_token", "fixture-owner-token");
    sessionStorage.setItem("memory_form_a_result", ${JSON.stringify(JSON.stringify({
      trackId: track, form: "A", totalScore: score, maxScore: 100, modules, retentionRatio: 1,
    }))});
    ${saved ? 'sessionStorage.setItem("memory_form_a_lead_saved", "true");' : ""}
  ` });
  await send("Page.navigate", { url: `${app}${path}` });
  if (path === "/memory-challenge/result") {
    await waitFor(saved ? '!!document.querySelector("#memory-masterclass-saved-score")' : '!!document.querySelector("#memory-whatsapp-form")');
  } else if (path === "/memory-masterclass/thank-you") {
    await waitFor('document.body.innerText.toLowerCase().includes("registration received")');
  } else {
    await waitFor('document.body.innerText.includes("Choose your class or study level")');
  }

  async function submit() {
    await evaluate(`(() => {
      const form = document.querySelector("#memory-whatsapp-form");
      for (const input of form.querySelectorAll("input,select")) {
        if (input.type === "checkbox") { if (!input.checked) input.click(); continue; }
        const value = input.tagName === "SELECT"
          ? [...input.options].find(option => option.value)?.value
          : input.name === "whatsappNumber" ? "9876543210" : input.type === "email" ? "fixture@example.test" : "Fixture learner";
        const prototype = input.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, "value").set.call(input, value);
        input.dispatchEvent(new Event(input.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
      }
    })()`);
    await evaluate('document.querySelector("#memory-whatsapp-form").requestSubmit()');
  }
  async function exit() {
    await evaluate('document.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, clientY: -1, relatedTarget: null }))');
    await pause(100);
  }
  async function escape() {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  }
  async function headlineVisible() {
    await waitFor('!document.querySelector("dialog[open]") && document.activeElement.id === "memory-masterclass-saved-score"');
    await pause(600);
    const top = await evaluate('document.querySelector("#memory-masterclass-saved-score").getBoundingClientRect().top');
    assert.ok(top >= 0 && top < 180, `Headline must be visible, not FAQ (top=${top})`);
    assert.equal(await evaluate('document.body.style.overflow'), "");
  }
  async function close() {
    assert.deepEqual(errors, []);
    socket.close();
    await fetch(`${debug}/json/close/${target.id}`);
  }
  return { evaluate, waitFor, submit, exit, escape, headlineVisible, close, leadRequests, apiRequests };
}

for (const track of ["school_foundation", "school_advanced", "advanced"]) {
  test(`${track}: save opens correct VSL; X/Escape and replay target saved headline`, async () => {
    const page = await fixture({ track, score: track === "advanced" ? 70 : track === "school_advanced" ? 40 : 39 });
    assert.equal(await page.evaluate('!!document.querySelector("[name=parentGuardianName]")'), false);
    assert.equal(await page.evaluate('document.body.innerText.includes("Parent / guardian name")'), false);
    await page.submit();
    await page.waitFor('!!document.querySelector("dialog[open] iframe")');
    assert.equal(page.leadRequests.length, 1);
    assert.equal(page.leadRequests[0].ownerToken, "fixture-owner-token");
    assert.equal(page.leadRequests[0].whatsappConsent, true);
    assert.ok(!("score" in page.leadRequests[0]));
    assert.ok(!("parentGuardianName" in page.leadRequests[0]));
    const video = await page.evaluate('document.querySelector("dialog iframe").src');
    assert.ok(video.includes(track === "advanced" ? "/1234364777?" : "/1234364593?"));
    assert.equal(await page.evaluate('!!document.querySelector("#memory-whatsapp-form")'), false);
    assert.equal(await page.evaluate('sessionStorage.getItem("memory_form_a_lead_saved")'), "true");
    assert.equal(await page.evaluate('document.querySelector("dialog").innerText.includes("₹99")'), false);
    assert.equal(await page.evaluate('document.querySelector("dialog").innerText.includes("FAQ")'), false);
    await page.exit();
    assert.equal(await page.evaluate('document.querySelectorAll("dialog[open]").length'), 1);
    await page.evaluate('document.querySelector("dialog button[aria-label=Close]").click()');
    await page.headlineVisible();
    // Testimonial videos remain; only the just-closed VSL must be absent.
    assert.equal(await page.evaluate(
      `[...document.querySelectorAll("iframe")].some(frame => frame.src === ${JSON.stringify(video)})`,
    ), false);
    await page.evaluate('[...document.querySelectorAll("button")].find(button => button.textContent.includes("Watch the 4-minute video again")).click()');
    await page.waitFor('!!document.querySelector("dialog[open] iframe")');
    await page.escape();
    await page.headlineVisible();
    await page.close();
  });
}

test("missing Vimeo ID skips modal, failed save does not open it", async () => {
  const missing = await fixture({ video: false });
  await missing.submit();
  await missing.headlineVisible();
  assert.equal(await missing.evaluate('document.body.innerText.includes("Watch the 4-minute video again")'), false);
  await missing.close();
  const failed = await fixture({ failLead: true });
  await failed.submit();
  await failed.waitFor('document.body.innerText.includes("Fixture save failed")');
  assert.equal(await failed.evaluate('!!document.querySelector("dialog[open]")'), false);
  assert.equal(await failed.evaluate('!!document.querySelector("#memory-whatsapp-form")'), true);
  await failed.close();
});

test("desktop exit rescue is once per tab; primary scrolls/focuses form without submitting", async () => {
  const page = await fixture();
  await page.exit();
  await page.waitFor('!!document.querySelector("dialog[open]")');
  assert.equal(await page.evaluate('sessionStorage.getItem("memory_score_rescue_shown")'), "true");
  await page.evaluate('[...document.querySelectorAll("dialog button")].find(button => button.textContent.includes("SAVE MY SCORE")).click()');
  await page.waitFor('!document.querySelector("dialog[open]") && document.activeElement.name === "learnerName"');
  assert.equal(page.leadRequests.length, 0);
  await page.exit();
  assert.equal(await page.evaluate('!!document.querySelector("dialog[open]")'), false);
  // SPA navigation/remount keeps the tab's shown-once flag.
  await page.evaluate(`window.history.pushState({}, "", "/memory-challenge"); window.dispatchEvent(new PopStateEvent("popstate"));`);
  await pause(100);
  await page.evaluate(`window.history.pushState({}, "", "/memory-challenge/result"); window.dispatchEvent(new PopStateEvent("popstate"));`);
  await page.waitFor('!!document.querySelector("#memory-whatsapp-form")');
  await page.exit();
  assert.equal(await page.evaluate('!!document.querySelector("dialog[open]")'), false);
  await page.close();
});

test("rescue supports No thanks and Escape, and never appears on mobile or saved results", async () => {
  for (const dismiss of ["No thanks", "Escape"]) {
    const page = await fixture();
    await page.exit();
    await page.waitFor('!!document.querySelector("dialog[open]")');
    if (dismiss === "Escape") await page.escape();
    else await page.evaluate('[...document.querySelectorAll("dialog button")].find(button => button.textContent === "No thanks").click()');
    await page.waitFor('!document.querySelector("dialog[open]")');
    await page.exit();
    assert.equal(await page.evaluate('!!document.querySelector("dialog[open]")'), false);
    await page.close();
  }
  for (const options of [{ mobile: true }, { saved: true }]) {
    const page = await fixture(options);
    await page.exit();
    assert.equal(await page.evaluate('!!document.querySelector("dialog[open]")'), false);
    await page.close();
  }
});

test("mobile VSL fits viewport and existing ₹99 CTA still opens purchaser details", async () => {
  const page = await fixture({ mobile: true, track: "advanced" });
  await page.submit();
  await page.waitFor('!!document.querySelector("dialog[open] iframe")');
  assert.equal(await page.evaluate('document.querySelector("dialog").getBoundingClientRect().width <= innerWidth'), true);
  await page.escape();
  await page.headlineVisible();
  await page.evaluate('[...document.querySelectorAll("button")].find(button => button.textContent.includes("₹99") && !button.disabled).click()');
  await page.waitFor('document.querySelector("dialog[open]")?.innerText.includes("Registration details")');
  assert.equal(page.apiRequests.some(path => path.endsWith("/create-order")), false);
  assert.equal(await page.evaluate('document.querySelectorAll("dialog input[required]").length'), 3);
  await page.close();
});

test("VSL configuration overrides still map both school tracks and advanced correctly", async () => {
  for (const track of ["school_foundation", "school_advanced", "advanced"]) {
    const page = await fixture({ track, vslOverrides: true });
    await page.submit();
    await page.waitFor('!!document.querySelector("dialog[open] iframe")');
    const source = await page.evaluate('document.querySelector("dialog iframe").src');
    assert.ok(source.includes(track === "advanced" ? "/222222222?" : "/111111111?"));
    await page.close();
  }
});

const nextWeeklyEvent = {
  key: "2026-10-25_1800_ist",
  startsAt: "2026-10-25T12:30:00.000Z",
  endsAt: "2026-10-25T14:30:00.000Z",
  timezone: "Asia/Kolkata",
  dateISO: "2026-10-25",
  dateLabel: "Sunday, 25 October",
  startTime: "6:00 PM",
  endTime: "8:00 PM",
  timezoneLabel: "IST",
  whatsappGroupUrl: "https://chat.whatsapp.com/NextWeeklyGroup",
};

test("offer uses the public weekly schedule everywhere, not old hardcoded dates", async () => {
  const page = await fixture({ saved: true, event: nextWeeklyEvent });
  await page.waitFor('document.body.innerText.includes("Sunday, 25 October")');
  const text = await page.evaluate('document.body.innerText');
  assert.ok(text.includes("6:00 PM–8:00 PM IST"));
  assert.ok(text.includes("Sunday, 25 October · 6:00 PM IST · ₹99"));
  assert.ok(!text.includes("18 October"));
  assert.ok(!text.includes("5:00 PM"));
  assert.ok(page.apiRequests.includes("/api/memory-masterclass/event"));
  assert.equal(page.apiRequests.some(path => path.endsWith("/create-order")), false);
  await page.close();
});

test("thank-you uses current weekly schedule and a prominent safe WhatsApp group CTA", async () => {
  const page = await fixture({ path: "/memory-masterclass/thank-you", event: nextWeeklyEvent });
  await page.waitFor('!![...document.querySelectorAll("a")].find(a => a.textContent.includes("JOIN THE WHATSAPP GROUP"))');
  const link = await page.evaluate(`(() => {
    const a = [...document.querySelectorAll("a")].find(a => a.textContent.includes("JOIN THE WHATSAPP GROUP"));
    return { text: a.textContent.trim(), href: a.href, target: a.target, rel: a.rel };
  })()`);
  assert.equal(link.text, "JOIN THE WHATSAPP GROUP →");
  assert.equal(link.href, nextWeeklyEvent.whatsappGroupUrl);
  assert.equal(link.target, "_blank");
  assert.ok(link.rel.includes("noopener") && link.rel.includes("noreferrer"));
  const text = await page.evaluate('document.body.innerText');
  assert.ok(text.includes("Sunday, 25 October"));
  assert.ok(text.includes("6:00 PM–8:00 PM IST"));
  assert.ok(text.includes("class reminders and joining updates"));
  assert.ok(text.includes("Return to my Study Memory Score"));
  assert.ok(!text.includes("18 October"));
  assert.equal(page.leadRequests.length, 0);
  assert.equal(page.apiRequests.some(path => path.endsWith("/create-order")), false);
  await page.close();
});

test("unavailable public event fails explicitly without an old schedule or unsafe group link", async () => {
  const page = await fixture({ path: "/memory-masterclass/thank-you", failEvent: true });
  await page.waitFor('document.body.innerText.includes("Class details could not be loaded")');
  assert.equal(await page.evaluate('!![...document.querySelectorAll("a")].find(a => a.textContent.includes("JOIN THE WHATSAPP GROUP"))'), false);
  assert.equal(await page.evaluate('document.body.innerText.includes("18 October")'), false);
  await page.evaluate('[...document.querySelectorAll("button")].find(b => b.textContent.includes("Retry class details")).click()');
  await page.waitFor('document.body.innerText.includes("Class details could not be loaded")');
  assert.ok(page.apiRequests.filter(path => path === "/api/memory-masterclass/event").length >= 2);
  await page.close();
});

test("landing hero gracefully handles the pending portrait and preserves level selection on desktop/mobile", async () => {
  for (const mobile of [false, true]) {
    const page = await fixture({ path: "/memory-challenge", mobile });
    await page.waitFor('!document.querySelector("img[src=\\"/images/memory-challenge-hero.webp\\"]")');
    assert.equal(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    await page.evaluate('[...document.querySelectorAll("button")].find(b => b.textContent.includes("Class 6–8")).click()');
    await page.waitFor('!!document.querySelector("a[href=\\"/memory-challenge/start\\"]")');
    assert.equal(await page.evaluate('sessionStorage.getItem("memory_track")'), "school_foundation");
    assert.equal(page.leadRequests.length, 0);
    await page.close();
  }
});

test("uploaded portrait has the exact credibility caption and stays compact on mobile", async () => {
  for (const mobile of [false, true]) {
    const page = await fixture({ path: "/memory-challenge", mobile, heroAvailable: true });
    await page.waitFor('document.querySelector("img[src=\\"/images/memory-challenge-hero.webp\\"]")?.naturalWidth > 0');
    assert.ok(await page.evaluate(`document.body.innerText.includes("Aravind Pasupathy — Memory Coach & Guinness World Record Holder")`));
    assert.equal(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    if (mobile) {
      const width = await page.evaluate('document.querySelector("img[src=\\"/images/memory-challenge-hero.webp\\"]").getBoundingClientRect().width');
      assert.ok(width <= 120, `Mobile portrait must be compact, got ${width}`);
    }
    await page.close();
  }
});
