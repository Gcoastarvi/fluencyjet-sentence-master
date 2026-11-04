// Offline runner (mandatory network isolation): node client/tests/runMemoryQa.mjs
// All API calls and external traffic are intercepted; no leads or payments are created.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPublicMemoryMasterclassEvent } from "../../server/config/memoryMasterclassEvent.js";
import { NavigationDiagnostics, cancelledInterception } from "./memoryNavigationDiagnostics.mjs";

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
  advertisingConsent = true,
  consentInitiallyVerified = advertisingConsent,
  holdConsentStatus = false,
  failConsentStatus = false,
  failConsentGrant = false,
  holdConsentGrant = false,
  declinedConsent = false,
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
  const consentStatusRequests = [];
  const consentGrantRequests = [];
  const diagnostics = new NavigationDiagnostics(null);
  const cancelledRequests = new Set();
  const interceptionChecks = new Set();

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
        import {ownsFunnelRoute} from "/src/lib/funnelDocument.js";
        import Original from "/src/components/RouteTracker.jsx?fixture_original=1";
        export default function Probe() {
          window.fixtureNavigate = useNavigate();
          window.fixtureOwnsRoute = () => ownsFunnelRoute(location.pathname);
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
      if (url.pathname.startsWith("/api/memory-meta/consent")) {
        const body = JSON.parse(request.postData || "{}");
        if (url.pathname.endsWith("/status")) {
          consentStatusRequests.push({ requestId, body });
          if (holdConsentStatus) return;
          if (failConsentStatus) return fulfill(requestId, JSON.stringify({
            ok: false, granted: false,
          }), "application/json", 503);
        } else if (body.granted === true) {
          consentGrantRequests.push({ requestId, body });
          if (holdConsentGrant) return;
          if (failConsentGrant) return fulfill(requestId, JSON.stringify({
            ok: false, granted: false,
          }), "application/json", 503);
        }
        return fulfill(requestId, JSON.stringify({
          ok: true, granted: body.granted ?? true, receipt: body.receipt || "a".repeat(64),
          version: "memory_meta_v1", expiresAt: "2099-01-01",
        }), "application/json");
      }
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
    if (message.method) {
      try { diagnostics.receive(message.method, message.params); }
      catch (error) { errors.push(`Navigation diagnostic: ${error.message}`); }
    }
    if (message.id) {
      const operation = pending.get(message.id);
      if (!operation) return;
      clearTimeout(operation.timeout);
      pending.delete(message.id);
      if (message.error) operation.reject(new Error(message.error.message));
      else operation.resolve(message.result);
    } else if (message.method === "Fetch.requestPaused") {
      intercept(message.params).catch(error => {
        // Navigation/unmount may invalidate a paused request before fulfillment.
        // Only an independently confirmed browser abort is benign.
        const requestUrl = new URL(message.params.request.url);
        if (error.message === "Invalid InterceptionId.") {
          // Network.loadingFailed is delivered asynchronously with the abort.
          // Accept only an independently confirmed cancellation, not a filename
          // exception or a general suppression of transport/SDK errors.
          const check = pause(100).then(() => {
            if (cancelledInterception(error, message.params, cancelledRequests)) {
              diagnostics.note("cancelled-interception", { path: requestUrl.pathname,
                resourceType: message.params.resourceType });
            } else {
              errors.push(`${requestUrl.origin}${requestUrl.pathname}: ${error.message}`);
            }
          });
          interceptionChecks.add(check);
          check.finally(() => interceptionChecks.delete(check));
          return;
        }
        errors.push(`${requestUrl.origin}${requestUrl.pathname}: ${error.message}`);
      });
    } else if (message.method === "Network.loadingFailed" && message.params.canceled) {
      cancelledRequests.add(message.params.requestId);
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
  await send("Page.enable");
  diagnostics.frameId = (await send("Page.getFrameTree")).frameTree.frame.id;
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Network.enable");
  await send("Runtime.addBinding", { name: "fixtureNavigationDiagnostic" });
  await send("Page.setLifecycleEventsEnabled", { enabled: true });
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
    window.memoryMetaConsentVerified = ${consentInitiallyVerified};
    ${advertisingConsent || declinedConsent ? `localStorage.setItem("brainodad_meta_consent_v1", JSON.stringify({
      granted: ${advertisingConsent && !declinedConsent}, receipt: "a".repeat(64), version: "memory_meta_v1", expiresAt: "2099-01-01"
    }));` : `localStorage.removeItem("brainodad_meta_consent_v1");`}
    window.fixtureNativePush = history.pushState.bind(history);
    window.metaCalls = [];
    window.fixturePageViews = [];
    window.fixtureCheckoutSequence = [];
    window.fixtureOpenSucceeded = false;
    const record = {id:window.fixtureDocumentId, initialPath:location.pathname, calls:[], leaks:[]};
    window.fixtureNavigationLifecycle = [];
    const diagnostic = data => window.fixtureNavigationDiagnostic(JSON.stringify({
      docId: record.id, initialPath: record.initialPath, path: location.pathname,
      timeOrigin: performance.timeOrigin, readyState: document.readyState, ...data
    }));
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
    diagnostic({kind:"boot"});
    for (const eventName of ["pageshow","pagehide","popstate","hashchange"]) {
      window.addEventListener(eventName, event => {
        const data = {kind:"lifecycle", event:event.type, trusted:event.isTrusted,
          persisted:event.persisted, path:location.pathname};
        window.fixtureNavigationLifecycle.push(data);
        diagnostic(data);
      }, true);
    }
    new MutationObserver(scan).observe(document, {childList:true,subtree:true});
    window.fbq = (...args) => {
      if (args[0] === "trackSingle" && args[2] === "PageView") {
        window.fixturePageViews.push({ pixel:args[1], href:location.href });
      }
      if (args[0] === "init" || args[0] === "set" || /^trackSingle/.test(args[0])) {
        diagnostic({kind:"sdk", command:args[0], pixel:args[0] === "set" ? args[3] : args[1],
          eventName:/^trackSingle/.test(args[0]) ? args[2] : undefined});
      }
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
  } else if (path.startsWith("/memory-products/")) {
    await waitFor('!!document.querySelector("#memory-route-not-found")');
  } else if (path.startsWith("/memory-challenge/video/")) {
    // Router availability is not checkout readiness: eventReady is still false
    // until the mocked public config has loaded. Even navigation-probe fixtures
    // must wait for the committed owned realm AND the real enabled CTA.
    await waitCommittedDocument(new URL(path, app).pathname, "1998316064175555");
    await waitFor(failEvent
      ? 'document.body.innerText.includes("Class details could not be loaded")'
      : `!!document.querySelector("[data-placement=below_video]:not([disabled])") &&
         document.body.innerText.includes(${JSON.stringify(event.dateLabel)})`);
  } else if (path === "/memory-masterclass/parents") {
    await waitFor(`location.pathname === "/memory-masterclass/parents" &&
      !!document.querySelector(".bdp-buy-hero:not([disabled])") &&
      document.body.innerText.includes(${JSON.stringify(event.dateLabel)})`);
  } else if (navigationProbe) {
    await waitFor('typeof window.fixtureNavigate === "function"');
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
    await Promise.all([...interceptionChecks]);
    assert.deepEqual(errors, []);
    socket.close();
    await fetch(`${debug}/json/close/${target.id}`);
  }
  async function settleDocument() {
    const id = await evaluate("window.fixtureDocumentId");
    const frame = (await send("Page.getFrameTree")).frameTree.frame;
    assert.equal(await evaluate("window.fixtureDocumentId"), id, "Navigation changed during settled snapshot");
    return diagnostics.settle(id, frame);
  }
  async function waitCommittedDocument(path, pixel, { freshFrom, probe = navigationProbe, expectPixel = advertisingConsent } = {}) {
    const ready = `location.pathname === ${JSON.stringify(path)} &&
      document.readyState === "complete" &&
      ${freshFrom ? `window.fixtureDocumentId !== ${JSON.stringify(freshFrom)} &&` : ""}
      window.metaCalls?.filter(c => c[0] === "init").length === ${expectPixel ? 1 : 0} &&
      ${expectPixel ? `window.metaCalls.some(c => c[0] === "init" && c[1] === ${JSON.stringify(pixel)}) &&` : ""}
      ${probe ? 'window.fixtureNavigate && window.fixtureOwnsRoute?.() &&' : ""}
      window.fixtureNavigationLifecycle?.some(e => e.event === "pageshow" &&
        e.trusted && e.path === ${JSON.stringify(path)})`;
    // Wait for two painted frames in the owned realm, not an arbitrary sleep or
    // an early URL/old-DOM match during browser history restoration. Keep this
    // inside the existing navigation-aware poll: CDP can detach a restored
    // execution context while resolving an awaited animation frame.
    await waitFor(`(async () => {
      if (!(${ready})) return false;
      const id = window.fixtureDocumentId;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return window.fixtureDocumentId === id && (${ready});
    })()`);
    const commit = await settleDocument();
    assert.equal(commit.expectedPixel, pixel, diagnostics.report());
    assert.equal(await evaluate("location.pathname"), path, diagnostics.report());
    if (probe) assert.equal(await evaluate("window.fixtureOwnsRoute()"), true, diagnostics.report());
    return evaluate("window.fixtureDocumentId");
  }
  return { evaluate, waitFor, submit, exit, escape, headlineVisible, close,
    leadRequests, apiRequests, checkoutRequests, diagnostics, settleDocument, waitCommittedDocument,
    consentStatusRequests, consentGrantRequests,
    tapClass: async text => {
      const point = await evaluate(`(() => {
        const button = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes(${JSON.stringify(text)}));
        if (!button || button.disabled) throw new Error("Class button unavailable");
        button.scrollIntoView({block:"center",behavior:"instant"});
        const r = button.getBoundingClientRect();
        return {x:r.x+r.width/2,y:r.y+r.height/2};
      })()`);
      await send("Input.dispatchTouchEvent", {type:"touchStart",touchPoints:[point]});
      await send("Input.dispatchTouchEvent", {type:"touchEnd",touchPoints:[]});
    },
    pressEnter: async () => {
      await send("Page.bringToFront");
      await send("Input.dispatchKeyEvent", {type:"keyDown",key:"Enter",code:"Enter",text:"\r",unmodifiedText:"\r",windowsVirtualKeyCode:13});
      await send("Input.dispatchKeyEvent", {type:"keyUp",key:"Enter",code:"Enter",windowsVirtualKeyCode:13});
    },
    releaseConsentStatus: async (index, granted = true) => {
      const request = consentStatusRequests[index];
      assert.ok(request, "Expected intercepted consent status request");
      await fulfill(request.requestId, JSON.stringify({ ok:true, granted }));
    },
    releaseConsentGrant: async index => {
      const request = consentGrantRequests[index];
      assert.ok(request, "Expected intercepted optional adult grant");
      await fulfill(request.requestId, JSON.stringify({ ...request.body, ok: true,
        granted: true, receipt: request.body.receipt || "a".repeat(64),
        version: "memory_meta_v1", expiresAt: "2099-01-01" }));
    },
    screenshot: async file => {
      const image = await send("Page.captureScreenshot", { format: "png" });
      await writeFile(file, Buffer.from(image.data, "base64"));
    } };
}

// Run through the unchanged network/capability gates in runMemoryQa.mjs.
// No real SDK, backend, consent record, order or payment is used.
async function parentsPrivacyFixture({ openThrows = false, ...options } = {}) {
  const page = await fixture({
    path: "/memory-masterclass/parents",
    advertisingConsent: false,
    ...options,
  });
  await page.evaluate(`window.Razorpay = function(options) {
    window.fixturePayment = options;
    this.on = function() {};
    this.open = function() {
      if (${openThrows}) throw new Error("Fixture open failed");
      window.fixtureCheckoutOpened = true;
      window.fixtureOpenSucceeded = true;
      window.fixtureCheckoutSequence.push("open succeeded");
    };
  }`);
  await page.evaluate('document.querySelector(".bdp-buy-hero:not([disabled])").click()');
  await page.waitFor('!!document.querySelector("dialog[open] #memory-purchaser-name")');
  return page;
}

test("Parents privacy management has no checkbox on desktop/mobile, even after review", async () => {
  for (const mobile of [false, true]) {
    const page = await parentsPrivacyFixture({ mobile });
    try {
      assert.equal(await page.evaluate('!!document.querySelector("dialog input[type=checkbox],dialog select")'), false);
      assert.equal(await page.evaluate('document.querySelector("dialog button[type=submit]").innerText'), "Continue to Payment — ₹99");
      await page.evaluate('document.querySelector("dialog button[aria-controls=memory-purchaser-privacy]").click()');
      await page.waitFor('document.activeElement?.tagName === "SUMMARY"');
      const result = await page.evaluate(`(() => {
        const d = document.querySelector("dialog[open]");
        const link = d.querySelector('a[href="/memory-challenge"]');
        return {
          fields: [...d.querySelectorAll("input")].map(i=>i.name),
          checkbox: !!d.querySelector("input[type=checkbox]"),
          explanation: d.innerText.includes("Payment does not give permission"),
          details: d.querySelector("details").open,
          focused: document.activeElement.tagName,
          link: {href:link.getAttribute("href"),target:link.target,rel:link.rel},
        };
      })()`);
      assert.deepEqual(result.fields, ["name", "email", "phone"]);
      assert.equal(result.checkbox, false);
      assert.equal(result.explanation, true);
      assert.equal(result.details, true);
      assert.equal(result.focused, "SUMMARY");
      assert.deepEqual(result.link, {href:"/memory-challenge",target:"_blank",rel:"noopener noreferrer"});
      assert.equal(page.consentGrantRequests.length, 0);
      assert.equal(page.checkoutRequests.length, 0);
      assert.equal(await page.evaluate('window.metaCalls.some(c=>/^(Lead|InitiateCheckout|Purchase)$/.test(c[2]))'), false);
      assert.equal(await page.evaluate('window.metaCalls.some(c=>c[0]==="init" || /^track/.test(c[0]))'), false,
        "An unconsented document must not initialize or dispatch to either Pixel");
    } finally { await page.close(); }
  }
});

test("Parents privacy management preserves no-choice/decline checkout without sharing", async () => {
  for (const declinedConsent of [false, true]) {
    const page = await parentsPrivacyFixture({ declinedConsent });
    try {
      const before = await page.evaluate('localStorage.getItem("brainodad_meta_consent_v1")');
      await registerPurchaser(page);
      await page.waitFor('window.fixtureCheckoutOpened === true');
      assert.equal(page.consentGrantRequests.length, 0);
      assert.equal(page.checkoutRequests.length, 1);
      const order = page.checkoutRequests[0];
      assert.equal(order.memoryMetaConsentReceipt, null);
      assert.equal(order.checkoutContext, "parents");
      assert.equal(order.audience, "school");
      assert.equal(Object.hasOwn(order, "schoolLevel"), false);
      assert.equal(Object.hasOwn(order, "amount"), false);
      assert.equal(Object.hasOwn(order, "formAScore"), false);
      assert.equal(Object.hasOwn(order, "responses"), false);
      assert.equal(await page.evaluate('localStorage.getItem("brainodad_meta_consent_v1")'), before);
      assert.deepEqual(await page.evaluate('window.fixtureCheckoutSequence'), ["open succeeded"]);
      assert.equal(await page.evaluate('window.metaCalls.some(c=>c[0]==="init" || /^track/.test(c[0]))'), false);
    } finally { await page.close(); }
  }
});

test("Parents privacy management reuses only an existing verified receipt; never browser Purchase", async () => {
  const page = await parentsPrivacyFixture({ advertisingConsent: true });
  try {
    await page.waitFor('window.memoryMetaConsentVerified === true');
    await registerPurchaser(page);
    await page.waitFor('window.fixtureCheckoutOpened === true');
    assert.equal(page.consentGrantRequests.length, 0);
    assert.equal(page.checkoutRequests[0].memoryMetaConsentReceipt, "a".repeat(64));
    assert.deepEqual(await page.evaluate('window.fixtureCheckoutSequence'), ["open succeeded", "InitiateCheckout"]);
    assert.equal(await page.evaluate('window.fixturePayment.amount'), 9900);
    assert.equal(await page.evaluate('window.fixturePayment.currency'), "INR");
    assert.equal(await page.evaluate('window.metaCalls.some(c=>c[1]==="1246171816816642" || c[2]==="Purchase" || c[2]==="Lead")'), false);
    await assertPixelDocuments(page);
  } finally { await page.close(); }
});

test("Parents privacy management respects withdrawal while registration stays open", async () => {
  const page = await parentsPrivacyFixture({ advertisingConsent: true });
  try {
    await page.waitFor('window.memoryMetaConsentVerified === true');
    await page.evaluate(`(() => {
      localStorage.removeItem("brainodad_meta_consent_v1");
      window.dispatchEvent(new StorageEvent("storage", {
        key:"brainodad_meta_consent_v1",storageArea:localStorage,newValue:null
      }));
    })()`);
    await page.waitFor('window.memoryMetaConsentVerified === false');
    await registerPurchaser(page);
    await page.waitFor('window.fixtureCheckoutOpened === true');
    assert.equal(page.checkoutRequests[0].memoryMetaConsentReceipt, null);
    assert.equal(page.consentGrantRequests.length, 0);
    assert.deepEqual(await page.evaluate('window.fixtureCheckoutSequence'), ["open succeeded"]);
    assert.equal(await page.evaluate('window.metaCalls.some(c=>c[2]==="Purchase" || c[2]==="Lead")'), false);
  } finally { await page.close(); }
});

test("Parents privacy management status outage fails closed without blocking booking", async () => {
  const page = await parentsPrivacyFixture({
    advertisingConsent: true, consentInitiallyVerified: false, failConsentStatus: true,
  });
  try {
    await registerPurchaser(page);
    await page.waitFor('window.fixtureCheckoutOpened === true');
    assert.equal(page.checkoutRequests[0].memoryMetaConsentReceipt, null);
    assert.equal(page.consentGrantRequests.length, 0);
    assert.deepEqual(await page.evaluate('window.fixtureCheckoutSequence'), ["open succeeded"]);
    assert.equal(await page.evaluate('window.metaCalls.some(c=>c[0]==="init" || /^track/.test(c[0]))'), false);
  } finally { await page.close(); }
});

test("Parents privacy management failed order or thrown checkout.open emits no conversion", async () => {
  for (const options of [{ failCheckout: true }, { openThrows: true }]) {
    const page = await parentsPrivacyFixture({ advertisingConsent: true, ...options });
    try {
      await page.waitFor('window.memoryMetaConsentVerified === true');
      await registerPurchaser(page);
      await page.waitFor('!!document.querySelector("dialog[open] [role=alert]")');
      assert.equal(page.consentGrantRequests.length, 0);
      assert.equal(page.checkoutRequests.length, 1);
      assert.deepEqual(await page.evaluate('window.fixtureCheckoutSequence'), []);
      assert.equal(await page.evaluate('window.metaCalls.some(c=>/^(Lead|InitiateCheckout|Purchase)$/.test(c[2]))'), false);
    } finally { await page.close(); }
  }
});

test("Parents privacy management leaves school/advanced/result consent controls unchanged", async () => {
  for (const audience of ["school", "advanced", "assessment"]) {
    const page = await checkoutConsentFixture(audience);
    try {
      assert.equal(await page.evaluate('!!document.querySelector("dialog #memory-purchaser-measurement")'), false);
      await revealPurchaserMeasurement(page);
      assert.equal(await page.evaluate('!!document.querySelector("dialog #memory-purchaser-measurement")'), true);
      assert.equal(await page.evaluate('document.querySelector("#memory-purchaser-measurement").checked'), false);
      assert.equal(page.consentGrantRequests.length, 0);
      assert.equal(page.checkoutRequests.length, 0);
    } finally { await page.close(); }
  }
});

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
    const expectedDateLabel = getPublicMemoryMasterclassEvent().dateLabel;
    assert.ok(await page.evaluate('document.body.innerText.includes(' + JSON.stringify(expectedDateLabel) + ')'));
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
    await page.waitFor('location.pathname === "/memory-challenge/start" && document.activeElement?.tagName === "H1"');
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

async function revealPurchaserMeasurement(page) {
  await page.waitFor(
    '!!document.querySelector("dialog[open] button[aria-controls=memory-purchaser-privacy]")'
  );

  await page.evaluate(
    'document.querySelector("dialog[open] button[aria-controls=memory-purchaser-privacy]").click()'
  );

  await page.waitFor(
    '!!document.querySelector("dialog[open] #memory-purchaser-measurement")'
  );
}

async function checkoutConsentFixture(audience, options = {}) {
  const path = audience === "assessment" ? "/memory-challenge/result"
    : `/memory-challenge/video/${audience}`;
  const page = await fixture({ path, saved: audience === "assessment", track: "advanced",
    advertisingConsent: false, ...options });
  await page.waitFor(`location.pathname === ${JSON.stringify(path)} &&
    document.body.innerText.includes(${JSON.stringify(getPublicMemoryMasterclassEvent().dateLabel)})`);
  await page.evaluate(`window.Razorpay = function(options) {
    window.fixturePayment = options;
    this.on = function() {};
    this.open = function() {
      window.fixtureCheckoutOpened = true;
      window.fixtureOpenSucceeded = true;
      window.fixtureCheckoutSequence.push("open succeeded");
    };
  }`);
  await page.waitFor(audience === "assessment"
    ? '[...document.querySelectorAll("button")].some(b => b.textContent.includes("Book My Seat") && !b.disabled)'
    : '!!document.querySelector("[data-placement=below_video]:not([disabled])")');
  await page.evaluate(audience === "assessment"
    ? '[...document.querySelectorAll("button")].find(b => b.textContent.includes("Book My Seat") && !b.disabled).click()'
    : 'document.querySelector("[data-placement=below_video]").click()');
  await page.waitFor('!!document.querySelector("dialog[open] #memory-purchaser-name")');
  if (audience === "school") await page.evaluate(`(() => {
    const select = document.querySelector("dialog select");
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(select, "6-8");
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  return page;
}

for (const audience of ["assessment", "school", "advanced"]) {
  test(`optional adult checkout grant confirms BEFORE ${audience} order, no duplicate PageView`, async () => {
    const page = await checkoutConsentFixture(audience, { holdConsentGrant: true });
    await revealPurchaserMeasurement(page);
    assert.equal(await page.evaluate('document.querySelector("#memory-purchaser-measurement").checked'), false);
    assert.equal(await page.evaluate('window.metaCalls.some(c=>c[0]==="init")'), false);
    await page.evaluate('document.querySelector("#memory-purchaser-measurement").click()');
    await registerPurchaser(page);
    await page.waitFor('document.querySelector("dialog button[type=submit]").disabled');
    for (let i = 0; i < 50 && !page.consentGrantRequests.length; i++) await pause(20);
    assert.equal(page.consentGrantRequests.length, 1);
    assert.deepEqual(page.consentGrantRequests[0].body, { granted: true, adultConfirmed: true });
    assert.equal(page.checkoutRequests.length, 0, "No order until consent confirmation");
    assert.equal(await page.evaluate('window.fixtureCheckoutOpened === true'), false);
    await page.releaseConsentGrant(0);
    await page.waitFor('window.fixtureCheckoutOpened === true');
    assert.equal(page.checkoutRequests[0].memoryMetaConsentReceipt, "a".repeat(64));
    assert.equal(page.checkoutRequests[0].purchaserEmail, "buyer@example.test");
    assert.equal(await page.evaluate('window.memoryMetaConsentVerified'), true);
    assert.deepEqual(await page.evaluate('window.fixtureCheckoutSequence'), ["open succeeded", "InitiateCheckout"]);
    const views = await page.evaluate('window.metaCalls.filter(c=>c[0]==="trackSingle" && c[2]==="PageView")');
    assert.equal(views.length, 1, "Only consenting current-route PageView");
    const path = audience === "assessment" ? "/memory-challenge/result" : `/memory-challenge/video/${audience}`;
    assert.equal(await page.evaluate('new URL(window.fixturePageViews[0].href).pathname'), path);
    assert.equal(await page.evaluate('window.metaCalls.some(c=>c[1]==="1246171816816642" || c[2]==="Purchase" || c[2]==="Lead")'), false);
    await page.waitFor('document.querySelector("footer[aria-label=\\"Privacy choices\\"]").innerText.includes("Your privacy choice is saved")');
    assert.equal(await page.evaluate('document.querySelector("footer[aria-label=\\"Privacy choices\\"]").innerText.includes("Your privacy choice is saved")'), true);
    await assertPixelDocuments(page);
    await page.close();
  });
  test(`unchecked or failed optional consent never blocks ${audience} checkout; no Meta`, async () => {
    for (const failure of [false, true]) {
      const page = await checkoutConsentFixture(audience, { failConsentGrant: failure });
      if (failure) {
        await revealPurchaserMeasurement(page);
        await page.evaluate('document.querySelector("#memory-purchaser-measurement").click()');
      }
      await registerPurchaser(page);
      await page.waitFor('window.fixtureCheckoutOpened === true');
      assert.equal(page.checkoutRequests[0].memoryMetaConsentReceipt, null);
      assert.equal(page.consentGrantRequests.length, failure ? 1 : 0);
      assert.equal(await page.evaluate('window.metaCalls.some(c=>c[0]==="init" || c[0]==="trackSingle" || c[0]==="trackSingleCustom")'), false);
      assert.deepEqual(await page.evaluate('window.fixtureCheckoutSequence'), ["open succeeded"]);
      await page.close();
    }
  });
}
test("saved decline is respected in registration; changing it requires separate choices and explicit adult check", async () => {
  const page = await checkoutConsentFixture("school", { declinedConsent: true });
  assert.equal(await page.evaluate('!!document.querySelector("#memory-purchaser-measurement")'), false);
  assert.equal(await page.evaluate('document.querySelector("dialog").innerText.includes("measurement is off")'), true);
  await page.evaluate('[...document.querySelectorAll("dialog button")].find(b=>b.textContent==="Privacy choices").click()');
  assert.equal(await page.evaluate('document.querySelector("#memory-purchaser-measurement").checked'), false);
  assert.equal(await page.evaluate('document.querySelector("dialog details").open'), true);
  await registerPurchaser(page);
  await page.waitFor('window.fixtureCheckoutOpened === true');
  assert.equal(page.consentGrantRequests.length, 0);
  assert.equal(page.checkoutRequests[0].memoryMetaConsentReceipt, null);
  assert.equal(await page.evaluate('window.metaCalls.some(c=>c[2]==="InitiateCheckout")'), false);
  await page.close();
});
test("verified adult grant needs no repeated checkout prompt or grant request", async () => {
  const page = await checkoutConsentFixture("advanced", { advertisingConsent: true });
  await page.waitFor('window.memoryMetaConsentVerified === true');
  assert.equal(await page.evaluate('!!document.querySelector("#memory-purchaser-measurement")'), false);
  await registerPurchaser(page);
  await page.waitFor('window.fixtureCheckoutOpened === true');
  assert.equal(page.consentGrantRequests.length, 0);
  assert.equal(page.checkoutRequests[0].memoryMetaConsentReceipt, "a".repeat(64));
  assert.equal(await page.evaluate('window.metaCalls.filter(c=>c[2]==="PageView").length'), 1);
  assert.deepEqual(await page.evaluate('window.fixtureCheckoutSequence'), ["open succeeded", "InitiateCheckout"]);
  await page.close();
});
test("withdrawal during pending checkout grant defeats late reply; booking remains available without Meta", async () => {
  const page = await checkoutConsentFixture("advanced", { holdConsentGrant: true });
  await revealPurchaserMeasurement(page);
  await page.evaluate('document.querySelector("#memory-purchaser-measurement").click()');
  await registerPurchaser(page);
  for (let i = 0; i < 50 && !page.consentGrantRequests.length; i++) await pause(20);
  assert.equal(page.consentGrantRequests.length, 1);
  await page.evaluate(`(() => {
    const f = document.createElement("iframe");
    document.body.appendChild(f);
    f.contentWindow.localStorage.setItem("brainodad_meta_consent_v1", JSON.stringify({
      receipt:"b".repeat(64), granted:false, version:"memory_meta_v1", expiresAt:"2099-01-01"
    }));
    f.remove();
  })()`);
  await page.waitFor('JSON.parse(localStorage.getItem("brainodad_meta_consent_v1")).granted === false');
  await pause(50); // allow the genuine cross-context storage event to reach listeners
  await page.releaseConsentGrant(0);
  await page.waitFor('window.fixtureCheckoutOpened === true');
  assert.equal(page.checkoutRequests[0].memoryMetaConsentReceipt, null);
  assert.equal(await page.evaluate('window.memoryMetaConsentVerified'), false);
  assert.equal(await page.evaluate('window.metaCalls.some(c=>c[0]==="init" || c[2]==="InitiateCheckout" || c[2]==="Purchase")'), false);
  await page.close();
});

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
    const beforeRefresh = await documentId(page);
    await page.evaluate('location.reload()');
    await page.waitCommittedDocument(`/memory-challenge/video/${audience}`, "1998316064175555",
      { freshFrom: beforeRefresh, probe: false });
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
  assert.ok(page.apiRequests.includes("/api/memory-masterclass/event"));
  // Check again at the action boundary and observe the native click. Never
  // enable a disabled control or substitute a dialog for the real React handler.
  const clicked = await page.evaluate(`(() => {
    const button = document.querySelector("[data-placement=below_video]");
    if (window.fixtureDocumentId !== ${JSON.stringify(originalDocument)} ||
        location.pathname !== "/memory-challenge/video/school" ||
        !window.fixtureOwnsRoute() || !button?.isConnected || button.disabled) return false;
    let clicked = false;
    button.addEventListener("click", () => { clicked = true; }, { once: true });
    button.click();
    return clicked;
  })()`);
  assert.equal(clicked, true, "Registration must start from a successful enabled-CTA click");
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
  await page.settleDocument();
  const records = await page.evaluate('JSON.parse(sessionStorage.getItem("fixture_pixel_documents"))');
  // Independent committed-navigation ownership is ADDITIONAL to the original
  // early-path assertions. Do not relabel a document based on observed SDK calls.
  page.diagnostics.assertRecords(records);
  for (const record of records) {
    const path = record.initialPath.toLowerCase();
    const memory = ["/memory-challenge","/memory-masterclass","/memory-retest","/memory-products"]
      .some(prefix => path === prefix || path.startsWith(prefix + "/"));
    const pixel = memory ? "1998316064175555" : "1246171816816642";
    assert.deepEqual(record.calls.filter(c => c[0] === "init"), [["init", pixel]],
      `Offending early-path record ${record.id}: ${page.diagnostics.report()}`);
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
  await page.waitCommittedDocument("/vocabulary-vsl", "1246171816816642");
  await page.waitFor('[...document.images].every(image => image.complete)');
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
  try {
  await page.waitCommittedDocument("/memory-challenge/video/school", "1998316064175555");
  const initial = await documentId(page);
  await page.evaluate('document.querySelector("#fixture-fj-link").click()');
  await page.waitCommittedDocument("/vocabulary-vsl", "1246171816816642", { freshFrom: initial });
  await page.evaluate("history.back()");
  await page.waitCommittedDocument("/memory-challenge/video/school", "1998316064175555");
  assert.ok(await page.evaluate('window.metaCalls.filter(c=>c[0]==="init").every(c=>c[1]==="1998316064175555")'));
  // This explicitly UNTRUSTED synthetic event covers the restore handler;
  // only CDP and trusted browser pageshow events prove actual restoration.
  const restored = await documentId(page);
  await page.evaluate('window.dispatchEvent(new PageTransitionEvent("pageshow",{persisted:true})); document.querySelector("#fixture-fj-link").click()');
  await page.waitCommittedDocument("/vocabulary-vsl", "1246171816816642", { freshFrom: restored });
  await page.evaluate("history.back()");
  await page.waitCommittedDocument("/memory-challenge/video/school", "1998316064175555");
  await page.evaluate("history.forward()");
  const fj = await page.waitCommittedDocument("/vocabulary-vsl", "1246171816816642");
  const beforeReplacement = await page.settleDocument();
  await page.evaluate('window.fixtureNativePush({}, "", "/memory-challenge/result"); window.dispatchEvent(new PopStateEvent("popstate"))');
  await page.waitCommittedDocument("/memory-challenge/result", "1998316064175555", { freshFrom: fj });
  const afterReplacement = await page.settleDocument();
  assert.notEqual(afterReplacement.loaderId, beforeReplacement.loaderId, page.diagnostics.report());
  await assertPixelDocuments(page);
  console.info("[memory history diagnostics]", JSON.stringify({
    commits: [...page.diagnostics.commits.values()],
    documents: [...page.diagnostics.documents.values()].map(d => ({
      docId: d.docId, initialPath: d.initialPath, loaderId: d.loaderId,
      sdkInit: d.sdk.filter(e => e.command === "init").map(e => e.pixel),
      lifecycle: d.lifecycle,
    })),
  }));
  } catch (error) {
    console.error("[memory history failure]", page.diagnostics.report());
    throw error;
  }
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

for (const audience of ["school", "advanced"]) test(`Memory ${audience}: default deny, post-consent PageView, withdrawal`, async () => {
  const page = await fixture({ path: `/memory-challenge/video/${audience}`, advertisingConsent: false });
  try {
    assert.equal(await page.evaluate('window.metaCalls.filter(c => c[0] === "init").length'), 0);
    assert.equal(await page.evaluate('window.metaCalls.filter(c => /^trackSingle/.test(c[0])).length'), 0);
    await page.evaluate(`Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("I am 18")).click()`);
    await page.waitFor('window.metaCalls.some(c => c[0] === "trackSingle" && c[2] === "PageView")');
    assert.equal(await page.evaluate('window.metaCalls.filter(c => c[0] === "init" && c[1] === "1998316064175555").length'), 1);
    assert.equal(await page.evaluate('window.metaCalls.filter(c => c[0] === "trackSingle" && c[2] === "PageView").length'), 1);
    await page.waitFor('!!Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim() === "Privacy choices")');
    assert.equal(await page.evaluate('!!Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("I am 18"))'), false);
    await page.evaluate(`Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim() === "Privacy choices").click()`);
    await page.waitFor('document.activeElement?.textContent.trim() === "Read the full disclosure"');
    await page.evaluate(`Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Withdraw measurement")).click()`);
    await page.waitFor('window.memoryMetaConsentVerified === false');
    assert.equal(await page.evaluate('window.metaCalls.filter(c => c[2] === "Lead" || c[2] === "InitiateCheckout" || c[2] === "Purchase").length'), 0);
  } finally { await page.close(); }
});

const disclaimer = "This website is independently operated by BrainoDad and is not affiliated with, sponsored by, or endorsed by Meta Platforms, Inc., Facebook, or Instagram. Facebook and Instagram are trademarks of Meta Platforms, Inc.";
for (const [path, mobile] of [["/memory-challenge", false], ["/memory-challenge/video/advanced", true]]) {
  test(`${path}: disclaimer and equal-choice consent are at bottom without covering content`, async () => {
    const page = await fixture({ path, mobile, advertisingConsent: false });
    try {
      assert.equal(await page.evaluate(`(() => {
        const f = document.querySelector('footer[aria-label="Privacy choices"]');
        return f && f === document.querySelector("#root").lastElementChild &&
          f.textContent.includes(${JSON.stringify(disclaimer)}) &&
          !["fixed","sticky"].includes(getComputedStyle(f).position);
      })()`), true);
      const styles = await page.evaluate('Array.from(document.querySelectorAll("#memory-measurement-choices button")).map(b=>b.className)');
      assert.equal(styles.length, 2); assert.equal(styles[0], styles[1]);
      assert.equal(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
      assert.equal(await page.evaluate('window.metaCalls.filter(c=>c[0]==="init" || /^trackSingle/.test(c[0])).length'), 0);
      await page.evaluate('document.querySelector("#memory-measurement-choices summary").click()');
      assert.equal(await page.evaluate('document.querySelector("#memory-measurement-choices details").open'), true);
      assert.equal(await page.evaluate('document.querySelector("#memory-measurement-choices details").innerText.includes("Your choice is remembered for 30 days.")'), true);
      await page.evaluate('document.querySelector("#memory-measurement-choices summary").click(); document.querySelector(\'footer[aria-label="Privacy choices"]\').scrollIntoView({block:"end",behavior:"instant"})');
      if (mobile) {
        // Crossing the video mounts the existing sticky CTA and its h-24 spacer.
        // Wait for that real layout change before taking the final footer position.
        await page.waitFor('!!document.querySelector("[data-placement=sticky_mobile]")');
        await page.evaluate('document.querySelector(\'footer[aria-label="Privacy choices"]\').scrollIntoView({block:"end",behavior:"instant"})');
      }
      await pause(100);
      await page.waitFor('document.querySelector(\'footer[aria-label="Privacy choices"]\').getBoundingClientRect().bottom <= innerHeight + 1');
      await page.screenshot(join(tmpdir(), `memory-footer-${mobile ? "mobile" : "desktop"}.png`));
      if (mobile) {
        const bounds = await page.evaluate(`(() => {
          const footer = document.querySelector('footer[aria-label="Privacy choices"]');
          const sticky = document.querySelector("[data-placement=sticky_mobile]")?.closest(".fixed.bottom-0");
          return {legalBottom:footer.lastElementChild.getBoundingClientRect().bottom,
            stickyTop:sticky?.getBoundingClientRect().top, padding:getComputedStyle(footer).paddingBottom,
            bottomLayers:Array.from(document.querySelectorAll(".fixed.bottom-0")).map(e=>({classes:e.className,top:e.getBoundingClientRect().top}))};
        })()`);
        assert.ok(bounds.stickyTop === undefined || bounds.legalBottom <= bounds.stickyTop,
          `Existing sticky checkout must not cover privacy: ${JSON.stringify(bounds)}`);
      }
      await page.evaluate('Array.from(document.querySelectorAll("#memory-measurement-choices button")).find(b=>b.textContent.includes("Decline")).click()');
      await page.waitFor('!!Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Privacy choices")');
      assert.equal(await page.evaluate('window.metaCalls.filter(c=>/^trackSingle/.test(c[0])).length'), 0);
      assert.equal(page.checkoutRequests.length, 0);
    } finally { await page.close(); }
  });
}
for (const [label, track] of [
  ["Class 6–8", "school_foundation"],
  ["Class 9–12", "school_advanced"],
  ["College & Competitive Exams", "advanced"],
]) test(`mobile ${label}: one real tap saves track, clears old assessment and navigates to instructions`, async () => {
  const page = await fixture({path:"/memory-challenge",mobile:true,navigationProbe:true});
  try {
    await page.waitFor('window.memoryMetaConsentVerified === true');
    const document = await page.evaluate("window.fixtureDocumentId");
    await page.tapClass(label);
    await page.waitFor('location.pathname === "/memory-challenge/start" && document.activeElement?.tagName === "H1"');
    assert.equal(await page.evaluate("sessionStorage.getItem('memory_track')"), track);
    assert.equal(await page.evaluate("sessionStorage.getItem('memory_form_a_result')"), null);
    assert.equal(await page.evaluate("sessionStorage.getItem('memory_form_a_owner_token')"), null);
    assert.equal(await page.evaluate("window.fixtureDocumentId"), document, "Same-memory navigation stays SPA");
    assert.equal(await page.evaluate('document.body.innerText.includes("Ready to test your memory?")'), true);
    assert.equal(await page.evaluate('window.metaCalls.filter(c=>c[2]==="memory_track_selected").length'), 1);
    assert.deepEqual(await page.evaluate('window.fixturePageViews.map(v=>new URL(v.href).pathname)'), ["/memory-challenge","/memory-challenge/start"]);
    await page.evaluate('window.fixtureNavigate("/memory-challenge/start?utm_source=fixture");');
    await pause(100);
    assert.equal(await page.evaluate('window.fixturePageViews.length'), 2, "Query-only change is not another PageView");
    assert.equal(await page.evaluate('window.metaCalls.some(c=>c[2]==="Lead"||c[2]==="InitiateCheckout"||c[2]==="Purchase")'), false);
    await page.evaluate('history.back()');
    await page.waitFor('location.pathname === "/memory-challenge/start" && !location.search');
    await page.evaluate('history.back()');
    await page.waitFor('location.pathname === "/memory-challenge" && document.body.innerText.includes("Choose your class")');
    assert.equal(await page.evaluate('window.fixturePageViews.length'), 3, "Returning to landing is a new visit");
    await assertPixelDocuments(page);
  } finally { await page.close(); }
});

test("keyboard class selection is not consent; grant on start emits only the current PageView", async () => {
  const page = await fixture({path:"/memory-challenge",advertisingConsent:false});
  try {
    await page.evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.includes("Class 6–8")).focus()');
    await page.pressEnter();
    await page.waitFor('location.pathname === "/memory-challenge/start" && document.activeElement?.tagName === "H1"');
    assert.equal(await page.evaluate('window.metaCalls.some(c=>c[0]==="init"||/^trackSingle/.test(c[0]))'), false);
    await page.evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.includes("I am 18")).click()');
    await page.waitFor('window.memoryMetaConsentVerified === true');
    assert.deepEqual(await page.evaluate('window.fixturePageViews.map(v=>new URL(v.href).pathname)'), ["/memory-challenge/start"]);
    await page.evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Privacy choices").click()');
    await page.evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.includes("I am 18")).click()');
    await page.waitFor('window.memoryMetaConsentVerified === true && !Array.from(document.querySelectorAll("button")).some(b=>b.textContent.includes("I am 18"))');
    assert.equal(await page.evaluate('window.fixturePageViews.length'), 1, "Review/regrant is not a new page visit");
    assert.equal(await page.evaluate('window.metaCalls.some(c=>c[2]==="Lead"||c[2]==="InitiateCheckout"||c[2]==="Purchase")'), false);
  } finally { await page.close(); }
});

test("real other-context unrelated storage writes preserve verified consent and saved-only Lead", async () => {
  const page = await fixture();
  try {
    await page.waitFor('window.memoryMetaConsentVerified === true');
    const count = page.consentStatusRequests.length;
    await page.evaluate(`window.fixtureStorageEvents=[]; addEventListener("storage",e=>window.fixtureStorageEvents.push({key:e.key,trusted:e.isTrusted}));
      window.fixtureStorageFrame=document.createElement("iframe"); document.body.append(window.fixtureStorageFrame);
      window.fixtureStorageFrame.contentWindow.localStorage.setItem("fj_meta_sent:1998316064175555:InitiateCheckout:fixture","1");`);
    await page.waitFor('window.fixtureStorageEvents.some(e=>e.key?.startsWith("fj_meta_sent:") && e.trusted)');
    assert.equal(await page.evaluate('window.memoryMetaConsentVerified'), true);
    assert.equal(page.consentStatusRequests.length, count);
    await page.evaluate('dispatchEvent(new StorageEvent("storage",{key:"brainodad_meta_consent_v1",storageArea:sessionStorage}));');
    assert.equal(await page.evaluate('window.memoryMetaConsentVerified'), true, "sessionStorage is not advertising consent");
    await page.submit();
    await page.waitFor('window.metaCalls.some(c=>c[0]==="trackSingle" && c[2]==="Lead")');
    assert.equal(await page.evaluate('window.metaCalls.filter(c=>c[2]==="Lead").length'), 1);
    assert.equal(await page.evaluate('window.fixturePageViews.length'), 1);
    assert.equal(await page.evaluate('window.metaCalls.some(c=>c[2]==="InitiateCheckout"||c[2]==="Purchase")'), false);
  } finally { await page.close(); }
});

test("changed cross-context grant is server-verified; repeated revalidation does not duplicate PageView", async () => {
  const page = await fixture({holdConsentStatus:true,consentInitiallyVerified:false});
  try {
    await page.waitFor('window.memoryMetaConsentVerified === false');
    await page.waitFor('document.readyState === "complete"');
    assert.equal(await page.evaluate('window.metaCalls.some(c=>c[0]==="init"||/^trackSingle/.test(c[0]))'), false);
    // StrictMode intentionally repeats the mount effect; only the current
    // request may activate. Fulfill all initial mocked requests, not just the stale first.
    assert.ok(page.consentStatusRequests.length > 0);
    for (let i=0;i<page.consentStatusRequests.length;i++) await page.releaseConsentStatus(i);
    await page.waitFor('window.memoryMetaConsentVerified === true');
    const initialRequests = page.consentStatusRequests.length;
    await page.evaluate(`window.fixtureStorageFrame=document.createElement("iframe"); document.body.append(window.fixtureStorageFrame);
      const r=JSON.parse(localStorage.getItem("brainodad_meta_consent_v1")); r.receipt="b".repeat(64);
      window.fixtureStorageFrame.contentWindow.localStorage.setItem("brainodad_meta_consent_v1",JSON.stringify(r));`);
    await page.waitFor('window.memoryMetaConsentVerified === false');
    for (let i=0;i<100 && page.consentStatusRequests.length<=initialRequests;i++) await pause(20);
    assert.equal(page.consentStatusRequests.length,initialRequests+1);
    await page.releaseConsentStatus(initialRequests);
    await page.waitFor('window.memoryMetaConsentVerified === true');
    assert.equal(await page.evaluate('window.fixturePageViews.length'), 1);
    assert.equal(await page.evaluate('window.metaCalls.filter(c=>c[0]==="init").length'), 1);
    assert.equal(await page.evaluate('window.metaCalls.some(c=>c[2]==="Lead"||c[2]==="InitiateCheckout"||c[2]==="Purchase")'), false);
  } finally { await page.close(); }
});

for (const clear of [false,true]) test(`late status replies cannot undo cross-context ${clear ? "clear" : "withdrawal"}`, async () => {
  const page = await fixture({holdConsentStatus:true,consentInitiallyVerified:false});
  try {
    await page.waitFor('document.readyState === "complete" && window.memoryMetaConsentVerified === false');
    await page.evaluate(`(() => { window.fixtureStorageFrame=document.createElement("iframe"); document.body.append(window.fixtureStorageFrame);
      const r=JSON.parse(localStorage.getItem("brainodad_meta_consent_v1")); r.receipt="b".repeat(64);
      window.fixtureStorageFrame.contentWindow.localStorage.setItem("brainodad_meta_consent_v1",JSON.stringify(r)); })()`);
    for (let i=0;i<100 && !page.consentStatusRequests.some(r=>r.body.receipt==="b".repeat(64));i++) await pause(20);
    assert.ok(page.consentStatusRequests.some(r=>r.body.receipt==="b".repeat(64)));
    await page.evaluate(clear
      ? 'window.fixtureStorageFrame.contentWindow.localStorage.clear()'
      : `(() => { const r=JSON.parse(localStorage.getItem("brainodad_meta_consent_v1")); r.granted=false;
         window.fixtureStorageFrame.contentWindow.localStorage.setItem("brainodad_meta_consent_v1",JSON.stringify(r)); })()`);
    await page.waitFor('window.metaCalls.some(c=>c[0]==="consent"&&c[1]==="revoke") && window.memoryMetaConsentVerified===false');
    await pause(100);
    for (let i=page.consentStatusRequests.length-1;i>=0;i--) await page.releaseConsentStatus(i);
    await pause(150);
    assert.equal(await page.evaluate('window.memoryMetaConsentVerified'), false);
    assert.equal(await page.evaluate('JSON.parse(localStorage.getItem("brainodad_meta_consent_v1")||"null")?.granted===true'), false);
    assert.equal(await page.evaluate('window.metaCalls.some(c=>c[0]==="init"||/^trackSingle/.test(c[0]))'), false);
  } finally { await page.close(); }
});

test("status outage fails closed without persisting a withdrawal", async () => {
  const page = await fixture({failConsentStatus:true,consentInitiallyVerified:false});
  try {
    await page.waitFor('document.body.innerText.includes("could not be verified")');
    assert.equal(await page.evaluate('window.memoryMetaConsentVerified'), false);
    assert.equal(await page.evaluate('JSON.parse(localStorage.getItem("brainodad_meta_consent_v1")).granted'), true);
    assert.equal(await page.evaluate('window.metaCalls.some(c=>c[0]==="init"||/^trackSingle/.test(c[0]))'), false);
    assert.equal(page.apiRequests.filter(p=>p==="/api/memory-meta/consent").length, 0);
  } finally { await page.close(); }
});

test("English pages never display the Memory disclaimer or privacy footer", async () => {
  const page = await fixture({ path: "/vocabulary-vsl", navigationProbe: true });
  try {
    assert.equal(await page.evaluate('!!document.querySelector("footer[aria-label=\\"Privacy choices\\"]")'), false);
    assert.equal(await page.evaluate(`document.body.innerText.includes(${JSON.stringify(disclaimer)})`), false);
    assert.equal(await page.evaluate('window.metaCalls.some(c=>c[0]==="init" && c[1]==="1998316064175555")'), false);
  } finally { await page.close(); }
});
