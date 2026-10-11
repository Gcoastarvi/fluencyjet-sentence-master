// Offline runner (mandatory network isolation): node client/tests/runMemoryQa.mjs
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
    "--disable-background-networking", "--disable-component-update",
    "--no-first-run", "--no-default-browser-check",
    "--remote-debugging-address=127.0.0.1",
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
  failCheckout = false,
  navigationProbe = false,
  shortViewport = false,
} = {}) {
  const target = await (await fetch(`${debug}/json/new?about:blank`, { method: "PUT" })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener("open", resolve, { once: true }));
  let sequence = 0;
  const pending = new Map();
  const errors = [];
  const leadRequests = [];
  const apiRequests = [];
  const checkoutRequests = [];

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
    if (navigationProbe && url.pathname === "/src/components/RouteTracker.jsx" &&
        !url.searchParams.has("fixture_original")) {
      // Test-only wrapper inside the REAL Router: exercise Link/useNavigate
      // without adding QA routes or hooks to application source.
      const compiled = await (await fetch(request.url)).text();
      const react = compiled.match(/from\s*["']([^"']*\/react\.js[^"']*)["']/)[1];
      const router = compiled.match(/from\s*["']([^"']*\/react-router-dom\.js[^"']*)["']/)[1];
      return fulfill(requestId, `
        import React from ${JSON.stringify(react)};
        import {Link,useNavigate} from ${JSON.stringify(router)};
        import Original from "/src/components/RouteTracker.jsx?fixture_original=1";
        export default function Probe() {
          window.fixtureNavigate = useNavigate();
          return React.createElement(React.Fragment, null, React.createElement(Original),
            React.createElement(Link, {id:"fixture-memory-link", to:"/memory-challenge/video/school?utm_source=fixture#video"}, "Fixture Memory"),
            React.createElement(Link, {id:"fixture-fj-link", to:"/vocabulary-vsl?utm_source=fixture#video"}, "Fixture English"));
        }
      `, "application/javascript");
    }
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
      let source = (await (await fetch(request.url)).text());
      // Default page/modal tests exercise the real application config.
      // Inject alternate IDs only for explicit fixture/missing-ID cases.
      if (!video || vslOverrides) {
        source = source
          .replace(/parentVimeoId:[\s\S]*?,/, `parentVimeoId: "${video ? "111111111" : ""}",`)
          .replace(/advancedVimeoId:[\s\S]*?,/, `advancedVimeoId: "${video ? "222222222" : ""}",`);
      }
      return fulfill(requestId, source, "application/javascript");
    }
    if (url.pathname.startsWith("/api/")) {
      apiRequests.push(url.pathname);
      if (url.pathname === "/api/memory-masterclass/standalone/create-order" ||
          url.pathname === "/api/memory-masterclass/create-order") {
        checkoutRequests.push(JSON.parse(request.postData || "{}"));
        return fulfill(requestId, JSON.stringify(failCheckout ? {
          ok: false, message: "Fixture checkout unavailable",
        } : {
          ok: true, orderId: "order_fixture_standalone", keyId: "fixture_key",
          amount: 9900, currency: "INR",
        }), "application/json", failCheckout ? 503 : 200);
      }
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
        const requestUrl = new URL(message.params.request.url);
        if (error.message === "Invalid InterceptionId." &&
            (requestUrl.pathname === "/api/memory-masterclass/event" ||
             requestUrl.hostname === "player.vimeo.com")) {
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
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result.value;
  }
  async function waitFor(expression) {
    for (let i = 0; i < 200; i++) {
      try {
        if (await evaluate(`document.body && (${expression})`)) return;
      } catch (error) {
        if (!/context|navigat|reading 'value'/i.test(error.message)) throw error;
      }
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
    width: mobile ? 390 : 1280, height: shortViewport ? 400 : mobile ? 844 : 900,
    deviceScaleFactor: 1, mobile,
  });
  await send("Emulation.setTouchEmulationEnabled", { enabled: mobile });
  const modules = Object.fromEntries(["immediate", "ordered", "association", "academic", "delayed"].map(
    key => [key, { correct: 2, maxRaw: 5, percentage: 40, weightedScore: 8, maxWeighted: 20 }],
  ));
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    // about:blank iframe documents can inherit parent sessionStorage.
    // Record only application documents, not transient video-frame documents.
    if (window.top === window) {
    // Capture dispatch only. No real SDK, ad-account requests or conversions.
    const fixtureFirstLoad = !sessionStorage.getItem("memory_fixture_seeded");
    if (fixtureFirstLoad) {
      localStorage.clear(); sessionStorage.clear();
      sessionStorage.setItem("memory_fixture_seeded", "true");
      sessionStorage.setItem("fixture_pixel_documents", "[]");
    }
    // Stub SDK; all external requests remain intercepted. Persist document
    // records across reloads to catch second-Pixel init/foreign DOM exposure.
    sessionStorage.setItem("fj_meta_qa_opt_in", "true");
    window.fixtureDocumentId = crypto.randomUUID();
    window.fixtureNativePush = history.pushState.bind(history);
    window.metaCalls = [];
    window.fixtureCheckoutSequence = [];
    window.fixtureOpenSucceeded = false;
    const record = {id:window.fixtureDocumentId, initialPath:location.pathname, calls:[], leaks:[]};
    const persist = () => {
      const records = JSON.parse(sessionStorage.getItem("fixture_pixel_documents"));
      const i = records.findIndex(r => r.id === record.id);
      if (i < 0) records.push(record); else records[i] = record;
      sessionStorage.setItem("fixture_pixel_documents", JSON.stringify(records));
    };
    const scan = () => {
      if (record.calls.some(c => c[0] === "init" && c[1] === "1246171816816642") &&
          document.querySelector("#memory-whatsapp-form,#memory-masterclass-saved-score,[data-placement=below_video],#memory-route-not-found")) {
        record.leaks.push("FJ could inspect memory DOM"); persist();
      }
    };
    new MutationObserver(scan).observe(document, {childList:true,subtree:true});
    window.fbq = (...args) => {
      if (args[0] === "trackSingle" && args[2] === "InitiateCheckout") {
        window.fixtureCheckoutSequence.push("InitiateCheckout");
        if (!window.fixtureOpenSucceeded) throw new Error("InitiateCheckout preceded successful open()");
      }
      window.metaCalls.push(args); record.calls.push(args); scan(); persist();
    };
    persist();
    // Headless Chromium has no physical mouse. Model desktop hardware only;
    // leave viewport/reduced-motion queries and the production logic intact.
    ${!mobile ? `
      const nativeMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = query => nativeMatchMedia(query
        .replace(/\\(hover:\\s*hover\\)/g, "(min-width: 0px)")
        .replace(/\\(pointer:\\s*fine\\)/g, "(min-width: 0px)"));
    ` : ""}
    ${!path.startsWith("/memory-challenge/video/") ? `if (fixtureFirstLoad) {
    sessionStorage.setItem("memory_track", ${JSON.stringify(track)});
    sessionStorage.setItem("memory_form_a_owner_token", "fixture-owner-token");
    sessionStorage.setItem("memory_form_a_result", ${JSON.stringify(JSON.stringify({
      trackId: track, form: "A", totalScore: score, maxScore: 100, modules, retentionRatio: 1,
    }))});
    ${saved ? 'sessionStorage.setItem("memory_form_a_lead_saved", "true");' : ""}
    }
    ` : ""}
    }
  ` });
  await send("Page.navigate", { url: `${app}${path}` });
  if (path === "/memory-challenge/result") {
    await waitFor(saved ? '!!document.querySelector("#memory-masterclass-saved-score")' : '!!document.querySelector("#memory-whatsapp-form")');
  } else if (path.startsWith("/memory-masterclass/thank-you")) {
    await waitFor('document.body.innerText.toLowerCase().includes("registration received")');
  } else if (navigationProbe) {
    await waitFor('typeof window.fixtureNavigate === "function"');
  } else if (path.startsWith("/memory-products/")) {
    await waitFor('!!document.querySelector("#memory-route-not-found")');
  } else if (path.startsWith("/memory-challenge/video/")) {
    await waitFor(failEvent
      ? 'document.body.innerText.includes("Class details could not be loaded")'
      : '!!document.querySelector("[data-placement=below_video]:not([disabled])")');
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
  return { evaluate, waitFor, submit, exit, escape, headlineVisible, close, leadRequests, apiRequests, checkoutRequests };
}

for (const [audience, schoolLevel, videoId] of [
  ["school", "6-8", "1234364593"],
  ["school", "9-12", "1234364593"],
  ["advanced", null, "1234364777"],
]) {
  test(`standalone ${audience}/${schoolLevel}: fresh device video, registration and secure checkout`, async () => {
    const page = await fixture({
      path: `/memory-challenge/video/${audience}`, mobile: true, heroAvailable: true,
    });
    assert.equal(await page.evaluate('Object.keys(sessionStorage).filter(k=>/^memory_(track|form_)/.test(k)).length'), 0);
    assert.equal(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    assert.ok(await page.evaluate(`document.querySelector("iframe").src.includes(${JSON.stringify(videoId)})`));
    assert.ok(await page.evaluate(`document.querySelector("h1").textContent.includes(${JSON.stringify(
      audience === "school" ? "Your child’s Study Memory Score" : "Your Study Memory Score",
    )})`));
    assert.ok(await page.evaluate('document.body.innerText.includes("Sunday, 18 October")'));
    assert.ok(await page.evaluate('document.body.innerText.includes("270")'));
    assert.ok(await page.evaluate('document.body.innerText.includes("2011")'));
    assert.equal(page.leadRequests.length, 0);
    assert.equal(page.apiRequests.some(path => path.includes("/memory/session")), false);
    await page.evaluate(`
      window.Razorpay = class {
        constructor(options) { window.fixturePayment = options; }
        on() {}
        open() {
          window.fixtureCheckoutOpened = true;
          window.fixtureOpenSucceeded = true;
          window.fixtureCheckoutSequence.push("open succeeded");
        }
      };
      document.querySelector("[data-placement=below_video]").click();
    `);
    await page.waitFor('!!document.querySelector("dialog[open]")');
    assert.equal(await page.evaluate('document.querySelectorAll("dialog input[required]").length'), 3);
    assert.equal(await page.evaluate('!!document.querySelector("dialog select[required]")'), audience === "school");
    assert.equal(page.apiRequests.includes("/api/memory-masterclass/checkout-details"), false);
    await page.evaluate('document.querySelector("dialog form").requestSubmit()');
    assert.equal(page.checkoutRequests.length, 0);
    await page.evaluate(`(() => {
      const form = document.querySelector("dialog form");
      const values = {name:"VSL Buyer",email:"vsl@example.test",phone:"9876543210"};
      for (const input of form.querySelectorAll("input")) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, values[input.name]);
        input.dispatchEvent(new Event("input", {bubbles:true}));
      }
      const select = form.querySelector("select");
      if (select) {
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(select, ${JSON.stringify(schoolLevel)});
        select.dispatchEvent(new Event("change", {bubbles:true}));
      }
    })()`);
    await page.evaluate('document.querySelector("dialog form").requestSubmit()');
    await page.waitFor('window.fixtureCheckoutOpened === true');
    assert.deepEqual(await page.evaluate('window.metaCalls.filter(c => c[0] === "trackSingle" && c[2] === "InitiateCheckout").map(c => [c[1], c[3].value, c[4].eventID])'),
      [["1998316064175555", 99, "memory_checkout_order_fixture_standalone"]]);
    assert.deepEqual(await page.evaluate('window.fixtureCheckoutSequence'), ["open succeeded", "InitiateCheckout"]);
    assert.equal(await page.evaluate('window.metaCalls.some(c => /^trackSingle/.test(c[0]) && c[1] === "1246171816816642")'), false);
    assert.equal(page.checkoutRequests.length, 1);
    assert.deepEqual(
      Object.fromEntries(Object.entries(page.checkoutRequests[0]).filter(([key]) =>
        ["audience", "schoolLevel", "purchaserName", "purchaserEmail", "purchaserPhone"].includes(key))),
      {
        audience, ...(schoolLevel ? { schoolLevel } : {}),
        purchaserName: "VSL Buyer", purchaserEmail: "vsl@example.test", purchaserPhone: "9876543210",
      },
    );
    for (const field of ["ownerToken", "amount", "trackId", "eventKey", "score", "memoryAssessmentSessionId"]) {
      assert.equal(page.checkoutRequests[0][field], undefined);
    }
    assert.deepEqual(await page.evaluate('window.fixturePayment.prefill'),
      {name:"VSL Buyer",email:"vsl@example.test",contact:"9876543210"});
    assert.equal(await page.evaluate('window.fixturePayment.amount'), 9900);
    assert.equal(await page.evaluate('window.fixturePayment.order_id'), "order_fixture_standalone");
    assert.equal(await page.evaluate('!!document.querySelector("dialog[open]")'), false);
    await page.evaluate('window.fixturePayment.modal.ondismiss()');
    await page.waitFor('!document.querySelector("[data-placement=below_video]").disabled');
    await page.evaluate('document.querySelector("[data-placement=after_credibility]").click()');
    await page.waitFor('!!document.querySelector("dialog[open]")');
    assert.equal(await page.evaluate('document.querySelector("[name=name]").value'), "VSL Buyer");
    await page.escape();
    await page.waitFor('!document.querySelector("dialog[open]")');
    await page.evaluate('window.fixturePayment.handler({razorpay_payment_id:"pay_fixture",razorpay_order_id:"order_fixture_standalone"})');
    await page.waitFor('document.body.innerText.includes("Explore the Memory Challenge")');
    assert.equal(await page.evaluate('new URLSearchParams(location.search).get("source")'), "standalone_vsl");
    assert.equal(await page.evaluate('!!document.querySelector("a[href=\\"/memory-challenge/result\\"]")'), false);
    await page.waitFor('!!document.querySelector("a[href^=\\"https://chat.whatsapp.com/\\"]")');
    assert.ok(await page.evaluate('!!document.querySelector("a[href^=\\"https://chat.whatsapp.com/\\"]")'));
    assert.equal(await page.evaluate('window.metaCalls.some(c => c[2] === "Purchase")'), false);
    await page.close();
  });
}

test("standalone event failure disables both checkout CTAs without assessment requests", async () => {
  const page = await fixture({ path: "/memory-challenge/video/advanced", failEvent: true });
  assert.equal(await page.evaluate('document.querySelectorAll("[data-placement][disabled]").length'), 2);
  assert.equal(page.checkoutRequests.length, 0);
  assert.equal(page.leadRequests.length, 0);
  await page.close();
});

test("standalone mobile sticky CTA stays away from video and hides for registration", async () => {
  const page = await fixture({ path: "/memory-challenge/video/school", mobile: true });
  assert.equal(await page.evaluate('!!document.querySelector("[data-placement=sticky_mobile]")'), false);
  await page.evaluate('document.querySelector("[data-placement=after_credibility]").scrollIntoView()');
  await page.waitFor('!!document.querySelector("[data-placement=sticky_mobile]")');
  assert.ok(await page.evaluate('document.querySelector("iframe").getBoundingClientRect().bottom <= 0'));
  await page.evaluate('document.querySelector("[data-placement=sticky_mobile]").click()');
  await page.waitFor('!!document.querySelector("dialog[open]")');
  assert.equal(await page.evaluate('!!document.querySelector("[data-placement=sticky_mobile]")'), false);
  await page.escape();
  await page.waitFor('!document.querySelector("dialog[open]")');
  await page.close();
});

test("standalone registration preserves editable details after a failed order", async () => {
  const page = await fixture({ path: "/memory-challenge/video/advanced", failCheckout: true });
  await page.evaluate('document.querySelector("[data-placement=below_video]").click()');
  await page.waitFor('!!document.querySelector("dialog[open]")');
  await page.evaluate(`(() => {
    const values = {name:"Test purchaser",email:"purchaser@example.test",phone:"9876543210"};
    for (const input of document.querySelectorAll("dialog input")) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, values[input.name]);
      input.dispatchEvent(new Event("input", {bubbles:true}));
    }
  })()`);
  await page.evaluate('document.querySelector("dialog form").requestSubmit()');
  await page.waitFor('!!document.querySelector("dialog [role=alert]")');
  assert.equal(page.checkoutRequests.length, 1);
  assert.equal(await page.evaluate('document.querySelector("[name=name]").value'), "Test purchaser");
  assert.equal(await page.evaluate('document.querySelector("dialog button[type=submit]").disabled'), false);
  await page.close();
});

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

test("memory Lead fires only on saved success, once, and never reaches FJ", async () => {
  const failed = await fixture({ failLead: true });
  assert.equal(await failed.evaluate('window.metaCalls.some(c => c[2] === "Lead")'), false);
  await failed.submit();
  await failed.waitFor('document.body.innerText.includes("Fixture save failed")');
  assert.equal(await failed.evaluate('window.metaCalls.some(c => c[2] === "Lead")'), false);
  await failed.close();

  for (const track of ["school_foundation", "school_advanced", "advanced"]) {
    const page = await fixture({ track });
    assert.equal(await page.evaluate('window.metaCalls.some(c => c[2] === "Lead")'), false);
    await page.submit();
    await page.waitFor('window.metaCalls.some(c => c[0] === "trackSingle" && c[2] === "Lead")');
    const leads = await page.evaluate('window.metaCalls.filter(c => c[0] === "trackSingle" && c[2] === "Lead")');
    assert.equal(leads.length, 1);
    assert.equal(leads[0][1], "1998316064175555");
    assert.match(leads[0][4].eventID, /^memory_lead_[a-f0-9]{64}$/);
    assert.ok(!JSON.stringify(leads).includes("fixture-owner-token"));
    assert.equal(await page.evaluate('window.metaCalls.some(c => /^trackSingle/.test(c[0]) && c[1] === "1246171816816642")'), false);
    await page.close();
  }
});

async function registerPurchaser(page) {
  await page.evaluate(`(() => {
    const form = document.querySelector("dialog form");
    for (const [name, value] of [["name","Memory Buyer"],["email","buyer@example.test"],["phone","9876543210"]]) {
      const input = form.querySelector("[name="+name+"]");
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
      input.dispatchEvent(new Event("input", {bubbles:true}));
    }
  })()`);
  await page.evaluate('document.querySelector("dialog form").requestSubmit()');
}

test("result modal events and offer views reflect visibility, not mounting, for school and advanced", async () => {
  for (const track of ["school_foundation", "school_advanced", "advanced"]) {
    const page = await fixture({ track });
    await page.submit();
    await page.waitFor('!!document.querySelector("dialog[open] iframe")');
    await page.evaluate('document.querySelector("[data-memory-offer-visibility]").scrollIntoView({block:"center"})');
    await pause(550);
    assert.equal(await page.evaluate('window.metaCalls.filter(c => c[2] === "memory_offer_view").length'), 0);
    const opened = await page.evaluate('window.metaCalls.filter(c => c[2] === "memory_vsl_open")');
    assert.equal(opened.length, 1);
    assert.equal(opened[0][3].opening, "automatic");
    assert.equal(opened[0][3].track, track);
    await page.escape();
    await page.headlineVisible();
    await page.evaluate('document.querySelector("[data-memory-offer-visibility]").scrollIntoView({block:"center"})');
    await page.waitFor('window.metaCalls.some(c => c[2] === "memory_offer_view")');
    await page.evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.includes("video again")).click()');
    await page.waitFor('!!document.querySelector("dialog[open] iframe")');
    await page.evaluate('document.querySelector("dialog button[aria-label=Close]").click()');
    await page.headlineVisible();
    await page.evaluate('document.querySelector("[data-memory-offer-visibility]").scrollIntoView({block:"center"})');
    await pause(550);
    const calls = await page.evaluate('window.metaCalls.filter(c=>/^trackSingle/.test(c[0]))');
    assert.equal(calls.filter(c=>c[2]==="memory_offer_view").length, 1);
    assert.deepEqual(calls.filter(c=>c[2]==="memory_vsl_open").map(c=>c[3].opening), ["automatic", "replay"]);
    assert.deepEqual(calls.filter(c=>c[2]==="memory_vsl_close").map(c=>c[3].opening), ["automatic", "replay"]);
    assert.equal(calls.filter(c=>c[2]==="Lead").length, 1);
    assert.ok(calls.every(c=>c[1]==="1998316064175555"));
    assert.ok(calls.every(c=>!("score" in c[3])));
    assert.ok(!calls.some(c=>["InitiateCheckout","Purchase"].includes(c[2])));
    await page.close();
  }
});

test("standalone offers require viewport visibility, deduplicate scrolling, and count a refreshed visit", async () => {
  for (const audience of ["school", "advanced"]) {
    const page = await fixture({ path: `/memory-challenge/video/${audience}`, mobile: true, shortViewport: true });
    // Keep the below-video CTA outside the viewport before testing visibility.
    await page.evaluate('window.scrollTo(0,0)');
    await pause(550);
    assert.equal(await page.evaluate('window.metaCalls.filter(c=>c[2]==="memory_offer_view").length'), 0);
    await page.evaluate('document.querySelector("[data-memory-offer-visibility]").scrollIntoView({block:"center"})');
    await page.waitFor('window.metaCalls.some(c=>c[2]==="memory_offer_view")');
    await page.evaluate('window.scrollTo(0,0)');
    await pause(100);
    await page.evaluate('document.querySelector("[data-memory-offer-visibility]").scrollIntoView({block:"center"})');
    await pause(550);
    const views = await page.evaluate('window.metaCalls.filter(c=>c[2]==="memory_offer_view")');
    assert.equal(views.length, 1);
    assert.equal(views[0][0], "trackSingleCustom");
    assert.equal(views[0][1], "1998316064175555");
    assert.deepEqual(views[0][3], {
      funnel:"amaze_memory", source:"standalone_vsl", track:audience,
      segment:audience, placement:"below_video", page_path:`/memory-challenge/video/${audience}`, price:99,
    });
    assert.equal(await page.evaluate('window.metaCalls.some(c=>["Lead","InitiateCheckout","Purchase"].includes(c[2]))'), false);
    await page.evaluate('location.reload()');
    await page.waitFor('!!document.querySelector("[data-memory-offer-visibility]")');
    await page.evaluate('document.querySelector("[data-memory-offer-visibility]").scrollIntoView({block:"center"})');
    await page.waitFor('window.metaCalls.some(c=>c[2]==="memory_offer_view")');
    assert.equal(await page.evaluate('window.metaCalls.filter(c=>c[2]==="memory_offer_view").length'), 1);
    await page.close();
  }
});

test("result offer below the viewport is not a view or a conversion", async () => {
  const page = await fixture({ saved: true, mobile: true });
  await pause(550);
  assert.equal(await page.evaluate('window.metaCalls.some(c=>["memory_offer_view","Lead","InitiateCheckout","Purchase"].includes(c[2]))'), false);
  await page.evaluate('document.querySelector("[data-memory-offer-visibility]").scrollIntoView({block:"center"})');
  await page.waitFor('window.metaCalls.some(c=>c[2]==="memory_offer_view")');
  const view = await page.evaluate('window.metaCalls.find(c=>c[2]==="memory_offer_view")[3]');
  assert.equal(view.placement, "result_offer");
  assert.equal(view.source, "assessment");
  assert.equal(view.track, "school_foundation");
  assert.equal(view.segment, "school");
  await page.close();
});

test("standalone registration occludes offers; school to advanced SPA navigation starts a new offer visit", async () => {
  const page = await fixture({
    path: "/memory-challenge/video/school", mobile: true, shortViewport: true, navigationProbe: true,
  });
  const originalDocument = await page.evaluate("window.fixtureDocumentId");
  await page.evaluate('document.querySelector("[data-placement=below_video]").click()');
  await page.waitFor('!!document.querySelector("dialog[open]")');
  await page.evaluate('document.querySelector("[data-memory-offer-visibility]").scrollIntoView({block:"center"})');
  await pause(550);
  assert.equal(await page.evaluate('window.metaCalls.some(c=>c[2]==="memory_offer_view")'), false);
  await page.escape();
  await page.evaluate('document.querySelector("[data-memory-offer-visibility]").scrollIntoView({block:"center"})');
  await page.waitFor('window.metaCalls.some(c=>c[2]==="memory_offer_view")');
  await page.evaluate('window.fixtureNavigate("/memory-challenge/video/advanced?utm_source=fixture")');
  await page.waitFor('location.pathname.endsWith("/advanced") && document.body.innerText.includes("BOOK MY SEAT")');
  await page.evaluate('document.querySelector("[data-memory-offer-visibility]").scrollIntoView({block:"center"})');
  await page.waitFor('window.metaCalls.filter(c=>c[2]==="memory_offer_view").length===2');
  assert.equal(await page.evaluate("window.fixtureDocumentId"), originalDocument);
  assert.deepEqual(await page.evaluate('window.metaCalls.filter(c=>c[2]==="memory_offer_view").map(c=>[c[3].segment,c[3].page_path])'), [
    ["school", "/memory-challenge/video/school"], ["advanced", "/memory-challenge/video/advanced"],
  ]);
  assert.equal(await page.evaluate('window.metaCalls.some(c=>["Lead","InitiateCheckout","Purchase"].includes(c[2]))'), false);
  await assertPixelDocuments(page);
  await page.close();
});

test("assessment-linked checkout emits InitiateCheckout only after order creation and SDK open", async () => {
  const page = await fixture({ saved: true, track: "advanced" });
  await page.waitFor(`document.body.innerText.includes(${JSON.stringify(getPublicMemoryMasterclassEvent().dateLabel)})`);
  await page.evaluate(`window.Razorpay = function(options) {
    window.fixturePayment = options;
    this.on = function() {};
    this.open = function() {
      window.fixtureCheckoutOpened = true;
      window.fixtureOpenSucceeded = true;
      window.fixtureCheckoutSequence.push("open succeeded");
    };
  }`);
  await page.evaluate('[...document.querySelectorAll("button")].find(b => b.textContent.includes("Book My Seat") && !b.disabled).click()');
  await page.waitFor('document.querySelector("dialog[open]")?.innerText.includes("Registration details")');
  assert.equal(await page.evaluate('window.metaCalls.some(c => c[2] === "InitiateCheckout")'), false);
  await registerPurchaser(page);
  await page.waitFor('window.fixtureCheckoutOpened === true');
  const events = await page.evaluate('window.metaCalls.filter(c => c[0] === "trackSingle" && c[2] === "InitiateCheckout")');
  assert.equal(events.length, 1);
  assert.equal(events[0][1], "1998316064175555");
  assert.equal(events[0][3].value, 99);
  assert.deepEqual(await page.evaluate('window.fixtureCheckoutSequence'), ["open succeeded", "InitiateCheckout"]);
  assert.equal(page.checkoutRequests[0].ownerToken, "fixture-owner-token");
  await page.close();
});

test("failed create-order or SDK open does not count a memory checkout", async () => {
  for (const audience of ["school", "advanced", "assessment"]) {
  for (const failOrder of [true, false]) {
    const page = await fixture({
      path: audience === "assessment" ? "/memory-challenge/result" : `/memory-challenge/video/${audience}`,
      saved: audience === "assessment", track: "advanced", failCheckout: failOrder,
    });
    // The result offer mounts before its public schedule request completes.
    // Wait for real readiness, just as the successful assessment checkout test does.
    await page.waitFor(`document.body.innerText.includes(${JSON.stringify(getPublicMemoryMasterclassEvent().dateLabel)})`);
    await page.evaluate(`window.Razorpay = function() {
      this.on = function() {};
      this.open = function() {
        window.fixtureCheckoutSequence.push("open throws");
        throw new Error("Fixture open failed");
      };
    }`);
    if (audience === "assessment") {
      await page.evaluate('[...document.querySelectorAll("button")].find(b => b.textContent.includes("Book My Seat") && !b.disabled).click()');
    } else {
      await page.evaluate('document.querySelector("[data-placement=below_video]").click()');
    }
    await page.waitFor('!!document.querySelector("dialog[open]")');
    if (audience === "school") {
      await page.evaluate(`(() => {
        const select = document.querySelector("dialog select");
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(select, "6-8");
        select.dispatchEvent(new Event("change", {bubbles:true}));
      })()`);
    }
    await registerPurchaser(page);
    const errorMessage = audience === "assessment"
      ? "Secure checkout could not be opened. Please try again."
      : failOrder ? "Fixture checkout unavailable" : "Fixture open failed";
    await page.waitFor(`document.body.innerText.includes(${JSON.stringify(errorMessage)})`);
    assert.equal(page.checkoutRequests.length, 1);
    assert.equal(await page.evaluate('window.metaCalls.some(c => c[2] === "InitiateCheckout" || c[2] === "memory_checkout_open")'), false);
    assert.equal(await page.evaluate('window.metaCalls.some(c => c[2] === "Purchase")'), false);
    assert.deepEqual(await page.evaluate('window.fixtureCheckoutSequence'), failOrder ? [] : ["open throws"]);
    await page.close();
  }
  }
});

async function documentId(page) {
  return page.evaluate("window.fixtureDocumentId");
}
async function assertPixelDocuments(page) {
  await page.waitFor('window.metaCalls.some(c => c[0] === "init")');
  const records = await page.evaluate('JSON.parse(sessionStorage.getItem("fixture_pixel_documents"))');
  for (const record of records) {
    const path = record.initialPath.toLowerCase();
    const memory = ["/memory-challenge","/memory-masterclass","/memory-retest","/memory-products"]
      .some(prefix => path === prefix || path.startsWith(prefix + "/"));
    const pixel = memory ? "1998316064175555" : "1246171816816642";
    assert.deepEqual(record.calls.filter(c => c[0] === "init"), [["init", pixel]]);
    assert.deepEqual(record.calls.filter(c => c[0] === "set"), memory ? [["set","autoConfig",false,pixel]] : []);
    assert.ok(record.calls.filter(c => /^trackSingle/.test(c[0])).every(c => c[1] === pixel));
    assert.deepEqual(record.leaks, []);
  }
}

test("real Link and navigate cross documents; same-funnel SPA retains document, data and attribution", async () => {
  const page = await fixture({ path: "/memory-challenge/video/school", navigationProbe: true });
  const initial = await documentId(page);
  await page.evaluate(`sessionStorage.setItem("memory_form_a_owner_token","fixture-owned");
    localStorage.setItem("fixture_auth_marker","retained");
    document.cookie="_fbc=fixture-click; path=/";
    window.fixtureNavigate("/memory-challenge/video/advanced?utm_source=wa#video")`);
  await page.waitFor('location.pathname === "/memory-challenge/video/advanced"');
  assert.equal(await documentId(page), initial);
  await page.evaluate('document.querySelector("#fixture-fj-link").click()');
  await page.waitFor(`window.fixtureDocumentId !== ${JSON.stringify(initial)} && location.pathname === "/vocabulary-vsl" && window.fixtureNavigate`);
  const fj = await documentId(page);
  assert.equal(await page.evaluate('document.referrer'), "");
  assert.equal(await page.evaluate('location.search + location.hash'), "?utm_source=fixture#video");
  assert.equal(await page.evaluate('sessionStorage.getItem("memory_form_a_owner_token")'), "fixture-owned");
  assert.equal(await page.evaluate('localStorage.getItem("fixture_auth_marker")'), "retained");
  assert.ok(await page.evaluate('document.cookie.includes("_fbc=fixture-click")'));
  await page.evaluate('window.fixtureNavigate("/spoken-english-offer")');
  await page.waitFor('location.pathname === "/spoken-english-offer"');
  assert.equal(await documentId(page), fj);
  await page.evaluate('document.querySelector("#fixture-memory-link").click()');
  await page.waitFor(`window.fixtureDocumentId !== ${JSON.stringify(fj)} && location.pathname === "/memory-challenge/video/school" && window.fixtureNavigate`);
  await assertPixelDocuments(page);
  await page.close();
});

test("cross-funnel replace redirects preserve Router return state and URL without registering another Pixel", async () => {
  const page = await fixture({ path: "/vocabulary-vsl", navigationProbe: true });
  const before = await documentId(page);
  await page.evaluate('window.fixtureNavigate("/memory-challenge/video/advanced?utm_campaign=return#video",{replace:true,state:{from:"/vocabulary-vsl",source:"fixture"}})');
  await page.waitFor(`window.fixtureDocumentId !== ${JSON.stringify(before)} && location.pathname === "/memory-challenge/video/advanced" && window.fixtureNavigate`);
  assert.deepEqual(await page.evaluate("history.state.usr"), {from:"/vocabulary-vsl",source:"fixture"});
  assert.equal(await page.evaluate("location.search + location.hash"), "?utm_campaign=return#video");
  await assertPixelDocuments(page);
  await page.close();
});

test("browser back/forward restores the correct document owner; legacy foreign popstate reloads before DOM exposure", async () => {
  const page = await fixture({ path: "/memory-challenge/video/school", navigationProbe: true });
  await page.evaluate('document.querySelector("#fixture-fj-link").click()');
  await page.waitFor('location.pathname === "/vocabulary-vsl" && window.fixtureNavigate');
  await page.evaluate("history.back()");
  await page.waitFor('location.pathname === "/memory-challenge/video/school" && document.querySelector("#fixture-fj-link") && window.metaCalls.some(c=>c[0]==="init"&&c[1]==="1998316064175555")');
  assert.ok(await page.evaluate('window.metaCalls.filter(c=>c[0]==="init").every(c=>c[1]==="1998316064175555")'));
  // Let the real history restoration finish before simulating another
  // pageshow and clicking; restored DOM can precede the navigation lifecycle.
  await pause(300);
  // Exercise BFCache pageshow even if this Chromium/debugger evicts the page.
  await page.evaluate('window.dispatchEvent(new PageTransitionEvent("pageshow",{persisted:true})); document.querySelector("#fixture-fj-link").click()');
  await page.waitFor('location.pathname === "/vocabulary-vsl" && document.querySelector("#fixture-memory-link") && window.metaCalls.some(c=>c[0]==="init"&&c[1]==="1246171816816642")');
  await page.evaluate("history.back()");
  await page.waitFor('location.pathname === "/memory-challenge/video/school" && document.querySelector("#fixture-fj-link") && window.metaCalls.some(c=>c[0]==="init"&&c[1]==="1998316064175555")');
  await page.evaluate("history.forward()");
  await page.waitFor('location.pathname === "/vocabulary-vsl" && window.fixtureNavigate');
  const fj = await documentId(page);
  await page.evaluate('window.fixtureNativePush({}, "", "/memory-challenge/result"); window.dispatchEvent(new PopStateEvent("popstate"))');
  await page.waitFor(`window.fixtureDocumentId !== ${JSON.stringify(fj)} && location.pathname === "/memory-challenge/result"`);
  await assertPixelDocuments(page);
  await page.close();
});

test("native cross-funnel links preserve browser semantics while redacting memory referrers", async () => {
  const page = await fixture({ path: "/memory-challenge/video/school", navigationProbe: true });
  const before = await documentId(page);
  await page.evaluate(`const link=document.createElement("a"); link.href="/vocabulary-vsl?utm_source=native";
    link.textContent="Native"; document.body.append(link); link.click()`);
  await page.waitFor(`window.fixtureDocumentId !== ${JSON.stringify(before)} && location.pathname === "/vocabulary-vsl" && window.fixtureNavigate`);
  assert.equal(await page.evaluate("document.referrer"), "");
  assert.equal(await page.evaluate("location.search"), "?utm_source=native");
  await assertPixelDocuments(page);
  await page.close();
});

test("unknown memory routes stay in memory's document, never the English Home fallback", async () => {
  const page = await fixture({ path: "/memory-products/future" });
  await page.waitFor('!!document.querySelector("#memory-route-not-found")');
  await assertPixelDocuments(page);
  assert.equal(await page.evaluate('window.metaCalls.some(c=>c[2]==="Lead"||c[2]==="Purchase")'), false);
  await page.close();
});
