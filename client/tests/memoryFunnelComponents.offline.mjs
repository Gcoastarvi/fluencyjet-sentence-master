import { memoryScheduleLabel } from "../src/lib/memorySchedule.js";
// Mocked React hooks/DOM and providers, executing real component handlers.
// No HTTP server, database, payment SDK download or network access.
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
async function transform(source, filename) {
  if (process.env.BRAINODAD_QA_BABEL_BUNDLE) {
    return createRequire(import.meta.url)(process.env.BRAINODAD_QA_BABEL_BUNDLE)
      .babelTransform(source, filename, true, [], []).code;
  }
  const { transformWithEsbuild } = await import("vite");
  return (await transformWithEsbuild(source, filename, { loader: "jsx", jsx: "automatic" })).code;
}
async function fixture({ failedOrder = false, failedOpen = false, consent = true } = {}) {
  const states = [], refs = [], effects = [], events = [], orderCalls = [], orderOfActions = [];
  let stateIndex = 0, refIndex = 0, controller, visible;
  const react = {
    useState(initial) { const i = stateIndex++; if (!(i in states)) states[i] = initial; return [states[i], v => { states[i] = v; }]; },
    useRef(initial) { const i = refIndex++; return refs[i] ||= { current: initial }; },
    useEffect(fn) { effects.push(fn); },
  };
  const context = vm.createContext({ console, URLSearchParams, requestAnimationFrame: fn => fn(), innerHeight: 900,
    document: { activeElement: null, visibilityState: "visible", addEventListener() {}, removeEventListener() {}, elementFromPoint: () => ({}) },
    setTimeout: fn => { fn(); return 1; }, clearTimeout() {},
    window: { location: { pathname: "/memory-masterclass/parents" }, addEventListener() {}, removeEventListener() {},
      IntersectionObserver: class { constructor(cb) { visible = cb; } observe() {} disconnect() {} },
      Razorpay: class { constructor(options) { this.options = options; } on() {} open() { orderOfActions.push("open"); if (failedOpen) throw new Error("mock open failure"); } },
    },
  });
  context.IntersectionObserver = context.window.IntersectionObserver;
  const modules = new Map();
  const jsx = (type, props) => ({ type, props });
  const mocks = {
    "../../lib/memorySchedule": { memoryScheduleLabel },
    react, "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "../../api/apiClient": { api: { post: async (...args) => {
      orderCalls.push(args); return failedOrder ? { ok: false } : { ok: true, data: { orderId: "order_mock", amount: 9900, currency: "INR", keyId: "offline" } };
    } } },
    "./MemoryMasterclassOffer": { buildMemoryCheckoutAttribution: () => ({}), loadRazorpayCheckout: async () => {} },
    "./MemoryPurchaserDetails": { default: "details" },
    "../../lib/tracking": { trackEvent: (name, params) => events.push({ name, params }) },
    "../../lib/metaPixel": { trackMemoryCheckout: params => { orderOfActions.push("InitiateCheckout"); events.push({ name: "InitiateCheckout", params }); } },
    "../../lib/memoryMetaConsent": { memoryConsentGranted: () => consent },
  };
  async function moduleFor(name) {
    if (modules.has(name)) return modules.get(name);
    const exports = mocks[name];
    const mod = new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
    modules.set(name, mod); return mod;
  }
  async function component(name) {
    const filename = resolve(root, `components/memory/${name}.jsx`);
    const mod = new vm.SourceTextModule(await transform(await readFile(filename, "utf8"), filename), { context });
    await mod.link(moduleFor); await mod.evaluate(); return mod.namespace.default;
  }
  const Checkout = await component("MemoryStandaloneCheckout");
  const render = () => {
    stateIndex = refIndex = 0;
    return Checkout({ audience: "school", parentsMode: true, event: { dateISO: "fixture", dateLabel: "Fixture", startTime: "5 PM", timezoneLabel: "IST" },
      children: value => { controller = value; return null; } });
  };
  function findDetails(node) {
    if (!node) return null;
    if (node.type === "details") return node;
    const children = node.props?.children;
    for (const child of Array.isArray(children) ? children : [children]) { const found = findDetails(child); if (found) return found; }
    return null;
  }
  async function pay() {
    render(); controller.openCheckout();
    const details = findDetails(render());
    await details.props.onSubmit({ name: "Adult", email: "adult@example.test", phone: "9111111111" });
  }
  return { events, orderCalls, orderOfActions, pay, render, component, effects, refs, get controller() { return controller; },
    intersect() { visible([{ isIntersecting: true, intersectionRatio: 1 }]); } };
}

test("booking click is custom only; Razorpay open precedes InitiateCheckout", async () => {
  const f = await fixture(); await f.pay();
  assert.deepEqual(f.orderOfActions, ["open", "InitiateCheckout"]);
  assert.equal(f.events.filter(e => e.name === "memory_offer_click").length, 1);
  assert.equal(f.events.filter(e => e.name === "InitiateCheckout").length, 1);
  assert.ok(f.events.every(e => e.name !== "Purchase"));
});
for (const opts of [{ failedOrder: true }, { failedOpen: true }]) {
  test(`failed checkout never initiates or purchases: ${JSON.stringify(opts)}`, async () => {
    const f = await fixture(opts); await f.pay();
    assert.ok(!f.events.some(e => ["Purchase", "InitiateCheckout"].includes(e.name)));
  });
}
test("no-choice purchaser submits without granting measurement", async () => {
  const f = await fixture({ consent: false }); await f.pay();
  assert.equal(f.orderCalls.length, 1);
  assert.equal(f.orderCalls[0][1].memoryMetaConsentReceipt, null);
  assert.equal(f.orderCalls[0][1].checkoutContext, "parents");
});
for (const consent of [true, false]) {
  test(`visible offer emits at most once, only with permission: ${consent}`, async () => {
    const f = await fixture({ consent }); const Visibility = await f.component("MemoryOfferVisibility");
    Visibility({ ready: true, blocked: false, source: "memory_masterclass_parents", placement: "parents", children: null });
    f.refs[0].current = { getBoundingClientRect: () => ({ left: 0, top: 0, bottom: 100, width: 100 }), contains: () => true };
    f.effects[0](); f.intersect(); f.intersect();
    assert.equal(f.events.filter(e => e.name === "memory_offer_view").length, consent ? 1 : 0);
  });
}
