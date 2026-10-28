import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { installFunnelDocumentBoundary, ownsFunnelRoute } from "./funnelDocument.js";
import { bootMetaDocument } from "./metaDocument.js";
import { dispatchMetaEvent, dispatchMetaPageView } from "./metaPixel.js";

const originalWindow = globalThis.window;
afterEach(() => { globalThis.window = originalWindow; });

function fixture(path = "/vocabulary-course", storage = new Map(), host = "www.fluencyjet.com") {
  const moves = [], nativeCalls = [], listeners = {}, calls = [], scripts = [], nodes = [];
  const w = {
    memoryMetaConsentVerified: true,
    localStorage: { getItem: () => JSON.stringify({
      granted: true, version: "memory_meta_v1", expiresAt: "2099-01-01",
    }) },
    sessionStorage: {
      getItem: key => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
    document: {
      createElement: tag => ({ tagName: tag, remove() { nodes.splice(nodes.indexOf(this), 1); } }),
      querySelector: () => nodes.find(node => node.name === "referrer"),
      head: { appendChild: node => { nodes.push(node); if (node.tagName === "script") scripts.push(node); } },
    },
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
    history: { state: null },
  };
  const setLocation = href => {
    w.location = Object.assign(new URL(href, `https://${host}`), {
      assign: href => moves.push(["assign", href]),
      replace: href => moves.push(["replace", href]),
    });
  };
  setLocation(path);
  for (const method of ["pushState", "replaceState"]) {
    w.history[method] = (state, unused, url) => {
      const next = url == null ? w.location : new URL(url, w.location);
      if (next.origin !== w.location.origin) throw new DOMException("Wrong origin", "SecurityError");
      nativeCalls.push([method, state, url]);
      w.history.state = state;
      if (url != null) setLocation(next.href);
    };
  }
  const emit = (type, extra = {}) => {
    let stopped = false;
    for (const fn of listeners[type] || []) {
      if (stopped) break;
      fn({ type, ...extra, stopImmediatePropagation: () => { stopped = true; } });
    }
    return stopped;
  };
  return { w, storage, moves, nativeCalls, listeners, calls, scripts, setLocation, emit };
}

test("same-funnel pushes/replacements keep native state, query/hash and return values", () => {
  const f = fixture();
  installFunnelDocumentBoundary(f.w);
  f.w.history.pushState({ usr: { source: "vsl" } }, "", "/spoken-english-offer?utm_source=wa#seat");
  f.w.history.replaceState({ idx: 2 }, "", "/german-live-class");
  f.w.history.replaceState({ idx: 2 }, "", undefined);
  assert.equal(f.nativeCalls.length, 3);
  assert.equal(f.moves.length, 0);
  assert.equal(f.w.location.pathname, "/german-live-class");
  assert.equal(ownsFunnelRoute("/spoken-english-vsl", f.w), true);
  assert.equal(ownsFunnelRoute("/memory-challenge", f.w), false);
});

test("restored documents can cross again; FJ referrer policy is restored and memory URLs stay private", () => {
  const f = fixture();
  installFunnelDocumentBoundary(f.w);
  f.w.history.pushState(null, "", "/memory-challenge");
  assert.equal(f.w.document.querySelector().content, "no-referrer");
  f.emit("pageshow", { persisted: true });
  assert.equal(f.w.document.querySelector(), undefined);
  f.w.history.pushState(null, "", "/memory-challenge/video/school");
  assert.equal(f.moves.length, 2);
  const memory = fixture("/memory-challenge/result?reference=fixture");
  installFunnelDocumentBoundary(memory.w);
  assert.equal(memory.w.document.querySelector().content, "no-referrer");
  const anchor = { href: "https://www.fluencyjet.com/vocabulary-course" };
  memory.listeners.click[0]({ target: { closest: () => anchor } });
  assert.equal(anchor.referrerPolicy, "no-referrer");
  assert.equal(memory.moves.length, 0);
});

test("BFCache restoration does not duplicate a recent owned PageView or conversions", () => {
  const f = fixture("/memory-masterclass/parents");
  globalThis.window = f.w;
  f.w.fbq = (...args) => f.calls.push(args);
  bootMetaDocument(f.w); bootMetaDocument(f.w);
  dispatchMetaPageView("/memory-masterclass/parents");
  f.emit("pageshow", { persisted: false });
  assert.equal(f.calls.filter(c => c[2] === "PageView").length, 1);
  f.emit("pageshow", { persisted: true });
  assert.equal(f.calls.filter(c => c[2] === "PageView").length, 1);
  assert.equal(f.calls.filter(c => c[0] === "init").length, 1);
  assert.ok(f.calls.every(c => !["Lead", "Purchase"].includes(c[2])));
});

for (const [method, expected] of [["pushState", "assign"], ["replaceState", "replace"]]) {
  test(`${method} crosses funnels without changing the old document URL or calling native history`, () => {
    const f = fixture();
    installFunnelDocumentBoundary(f.w);
    f.w.history[method]({ usr: { from: "/vocabulary-course" }, idx: 1 }, "",
      "/Memory-Challenge/video/school?utm_source=wa#video");
    assert.deepEqual(f.moves, [[expected, "https://www.fluencyjet.com/Memory-Challenge/video/school?utm_source=wa#video"]]);
    assert.equal(f.w.location.pathname, "/vocabulary-course");
    assert.equal(f.nativeCalls.length, 0);
    // A new document restores auth/return state before Router initialization.
    const next = fixture("/Memory-Challenge/video/school?utm_source=wa#video", f.storage);
    installFunnelDocumentBoundary(next.w);
    assert.deepEqual(next.w.history.state, { usr: { from: "/vocabulary-course" }, idx: 1 });
    assert.equal(f.storage.has("fj_funnel_navigation"), false);
  });
}

test("unrelated/stale handoffs cannot apply state to another destination", () => {
  const f = fixture();
  f.storage.set("fj_funnel_navigation", JSON.stringify({
    href: "https://www.fluencyjet.com/memory-challenge", state: { usr: "wrong" }, createdAt: Date.now(),
  }));
  installFunnelDocumentBoundary(f.w);
  assert.equal(f.w.history.state, null);
  assert.equal(f.storage.size, 0);
  const old = fixture("/memory-challenge");
  old.storage.set("fj_funnel_navigation", JSON.stringify({
    href: old.w.location.href, state: { usr: "old" }, createdAt: Date.now() - 60_000,
  }));
  installFunnelDocumentBoundary(old.w);
  assert.equal(old.w.history.state, null);
});

test("back/forward or restored foreign entries stop later Router/SDK listeners and replace the document", () => {
  for (const type of ["popstate", "pageshow"]) {
    const f = fixture();
    installFunnelDocumentBoundary(f.w);
    let sdkRuns = 0;
    f.w.addEventListener(type, () => { sdkRuns += 1; });
    f.setLocation("/memory-masterclass/thank-you?reference=fixture");
    assert.equal(f.emit(type), true);
    assert.equal(sdkRuns, 0);
    assert.deepEqual(f.moves, [["replace", f.w.location.href]]);
  }
  const own = fixture("/memory-challenge");
  installFunnelDocumentBoundary(own.w);
  own.setLocation("/memory-challenge/result");
  assert.equal(own.emit("popstate"), false);
  assert.equal(own.moves.length, 0);
});

test("invalid/cross-origin history URLs retain native exceptions; meaningful blocked state fails explicitly", () => {
  const f = fixture();
  installFunnelDocumentBoundary(f.w);
  assert.throws(() => f.w.history.pushState({}, "", "https://other.example/memory-challenge"), { name: "SecurityError" });
  assert.throws(() => f.w.history.pushState({}, "", "https://["), TypeError);
  f.w.sessionStorage.setItem = () => { throw new Error("blocked"); };
  assert.throws(() => f.w.history.pushState({ usr: { from: "/course" } }, "", "/memory-challenge"), { name: "DataCloneError" });
  assert.equal(f.moves.length, 0);
  f.w.history.pushState(null, "", "/memory-challenge");
  assert.equal(f.moves.length, 1);
});

test("document bootstrap registers only its Pixel; FJ is not forced into manual-only mode", () => {
  for (const [path, pixel] of [["/german-live-class", "1246171816816642"], ["/memory-masterclass/parents", "1998316064175555"]]) {
    const f = fixture(path);
    f.w.fbq = (...args) => f.calls.push(args);
    bootMetaDocument(f.w); bootMetaDocument(f.w);
    assert.deepEqual(f.calls.filter(c => c[0] === "init"), [["init", pixel]]);
    assert.deepEqual(f.calls.filter(c => c[0] === "set"),
      path.startsWith("/memory") ? [["set", "autoConfig", false, pixel]] : []);
    assert.ok(f.calls.every(c => !["track", "trackSingle"].includes(c[0])));
    globalThis.window = f.w;
    f.setLocation(path.startsWith("/memory") ? "/vocabulary-course" : "/memory-challenge");
    assert.equal(dispatchMetaEvent("Lead", {}, { memory: !path.startsWith("/memory") }), false);
    assert.equal(f.calls.filter(c => c[0] === "init").length, 1);
  }
});

test("Preview boots no real SDK by default; per-tab opt-in loads one queue after the boundary", () => {
  const offline = fixture("/memory-masterclass/parents", new Map(), "spock.replit.dev");
  assert.equal(bootMetaDocument(offline.w), false);
  assert.equal(offline.scripts.length, 0);
  assert.equal(offline.w.fbq, undefined);
  assert.equal(ownsFunnelRoute("/memory-challenge/result", offline.w), true);
  offline.storage.set("fj_meta_qa_opt_in", "true");
  assert.equal(bootMetaDocument(offline.w), true);
  assert.equal(offline.scripts.length, 1);
  assert.deepEqual(offline.w.fbq.queue, [
    ["set", "autoConfig", false, "1998316064175555"], ["init", "1998316064175555"],
  ]);
});

