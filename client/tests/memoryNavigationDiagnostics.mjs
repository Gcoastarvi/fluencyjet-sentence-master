// Test-only CDP ledger. Expected ownership comes from committed top-frame
// navigation, never from the SDK destination being asserted.
import assert from "node:assert/strict";

export function navigationPath(url) {
  return new URL(url, "http://127.0.0.1:3000").pathname;
}

export function expectedPixel(path) {
  let decoded = path;
  try { decoded = decodeURIComponent(path); } catch {}
  decoded = decoded.toLowerCase();
  return ["/memory-challenge", "/memory-masterclass", "/memory-retest", "/memory-products"]
    .some(prefix => decoded === prefix || decoded.startsWith(prefix + "/"))
    ? "1998316064175555" : "1246171816816642";
}

export function cancelledInterception(error, request, cancelled) {
  return error.message === "Invalid InterceptionId." &&
    Boolean(request.networkId && cancelled.has(request.networkId));
}

export function disableQaHmrTransport(source) {
  // Vite's dev client is not shipped by the production build. Keep its style
  // helpers intact, but do not let BFCache socket reconnects reload QA documents.
  // The exact installed bootstrap must be recognized; never guess or patch app JS.
  const bootstrap = "socket = setupWebSocket(socketProtocol, socketHost, fallback);";
  assert.equal(source.split(bootstrap).length, 2, "Unrecognized Vite client socket bootstrap");
  return source.replace(bootstrap, "socket = undefined; // offline QA: no dev-client reconnect reload");
}

export class NavigationDiagnostics {
  constructor(frameId) {
    this.frameId = frameId;
    this.loader = null;
    this.commits = new Map();
    this.contexts = new Map();
    this.documents = new Map();
    this.events = [];
  }

  note(type, data) {
    this.events.push({ sequence: this.events.length + 1, type, ...data });
  }

  receive(method, params) {
    if (method === "Network.requestWillBeSent" && params.frameId === this.frameId &&
        params.type === "Document") {
      this.note("document-request", { loaderId: params.loaderId,
        path: navigationPath(params.request.url), initiator: params.initiator?.type,
        stack: params.initiator?.stack?.callFrames?.map(f => ({
          function: f.functionName, path: navigationPath(f.url),
        })) });
    } else if (method === "Runtime.consoleAPICalled" &&
        params.args?.some(a => a.value === "[vite] server connection lost. Polling for restart...")) {
      this.note("vite-reconnect-reload", { loaderId: this.loader });
    } else if (method === "Page.frameNavigated" && params.frame.id === this.frameId) {
      const { loaderId, url } = params.frame;
      if (!loaderId || !url.startsWith("http://127.0.0.1:3000/")) return;
      this.loader = loaderId;
      const path = navigationPath(url);
      if (!this.commits.has(loaderId)) {
        this.commits.set(loaderId, { loaderId, frameId: this.frameId,
          committedPath: path, expectedPixel: expectedPixel(path) });
      }
      this.note("commit", { loaderId, path, navigationType: params.type || "Navigation" });
    } else if (method === "Page.navigatedWithinDocument" && params.frameId === this.frameId) {
      this.note("same-document", { loaderId: this.loader, path: navigationPath(params.url),
        navigationType: params.navigationType });
    } else if (method === "Runtime.executionContextCreated") {
      const context = params.context;
      if (context.auxData?.isDefault && context.auxData.frameId === this.frameId) {
        this.contexts.set(context.id, { loaderId: this.loader, uniqueId: context.uniqueId });
        this.note("context", { contextId: context.id, loaderId: this.loader });
      }
    } else if (method === "Page.lifecycleEvent" && params.frameId === this.frameId) {
      this.note("cdp-lifecycle", { loaderId: params.loaderId, event: params.name });
    } else if (method === "Runtime.bindingCalled" && params.name === "fixtureNavigationDiagnostic") {
      const value = JSON.parse(params.payload);
      const context = this.contexts.get(params.executionContextId);
      const { docId, initialPath, path, timeOrigin, kind, event, trusted, persisted,
        command, pixel, eventName, readyState } = value;
      if (!docId || !path || path.includes("?") || path.includes("#")) {
        throw new Error("Invalid/unsanitized navigation diagnostic");
      }
      let document = this.documents.get(docId);
      if (!document) {
        document = { docId, initialPath, timeOrigin, loaderId: context?.loaderId,
          contextId: params.executionContextId, sdk: [], lifecycle: [] };
        this.documents.set(docId, document);
      }
      const item = { path, kind, event, trusted, persisted, command, pixel, eventName, readyState };
      if (kind === "sdk") document.sdk.push(item);
      if (kind === "lifecycle") document.lifecycle.push(item);
      this.note("document", { docId, loaderId: document.loaderId, ...item });
    }
  }

  settle(docId, frame) {
    const document = this.documents.get(docId);
    const commit = this.commits.get(frame.loaderId);
    assert.ok(document && commit && frame.id === this.frameId,
      `Cannot establish committed document ownership: ${this.report()}`);
    assert.ok(!document.loaderId || document.loaderId === frame.loaderId,
      `Context/committed-loader mismatch: ${this.report()}`);
    document.loaderId = frame.loaderId;
    this.note("settled", { docId, loaderId: frame.loaderId, path: navigationPath(frame.url) });
    return commit;
  }

  assertRecords(records) {
    const recordedLoaders = new Set();
    for (const record of records) {
      const document = this.documents.get(record.id);
      const commit = this.commits.get(document?.loaderId);
      const diagnostic = `Offending document ${record.id}: ${this.report()}`;
      assert.ok(document && commit, `Missing independent navigation evidence. ${diagnostic}`);
      assert.ok(!recordedLoaders.has(commit.loaderId),
        `Multiple fixture documents for one committed loader. ${diagnostic}`);
      recordedLoaders.add(commit.loaderId);
      assert.deepEqual(record.calls.filter(c => c[0] === "init"),
        [["init", commit.expectedPixel]], diagnostic);
      assert.deepEqual(record.calls.filter(c => c[0] === "set"),
        commit.expectedPixel === "1998316064175555"
          ? [["set", "autoConfig", false, commit.expectedPixel]] : [], diagnostic);
      assert.ok(record.calls.filter(c => /^trackSingle/.test(c[0]))
        .every(c => c[1] === commit.expectedPixel), diagnostic);
      assert.deepEqual(record.leaks, [], diagnostic);
      // Preserve the separate binding stream as a cross-check against fixture storage.
      assert.deepEqual(document.sdk.filter(c => c.command === "init").map(c => c.pixel),
        [commit.expectedPixel], diagnostic);
    }
  }

  report() {
    return JSON.stringify({
      commits: [...this.commits.values()],
      documents: [...this.documents.values()],
      chronology: this.events,
    });
  }
}
