import { test } from "node:test";
import assert from "node:assert/strict";
import { qaEnvironment, assertNetworkIsolation, launchSandbox } from "./runMemoryQa.mjs";
import { memoryQaViteConfig } from "./memoryQa.vite.config.mjs";
import { assertSealed, verifiedStart } from "./memoryQaIsolation.mjs";

const base = () => ({
  complete: true, namespace: "net:[2]",
  links: [{ name: "lo", index: 1, hardware: 772, flags: 9, master: 0, linked: 0 },
    { name: "sit0", index: 2, hardware: 776, flags: 128, master: 0, linked: 0 }],
  addresses: [{ index: 1, family: 2, prefix: 8, scope: 254, values: ["127.0.0.1"] }],
  routes: [{ index: 1, family: 2, prefix: 8, sourcePrefix: 0, tos: 0, flags: 0,
    table: 255, protocol: 2, scope: 254, type: 2, destination: "127.0.0.0",
    preferredSource: "127.0.0.1", attributeTypes: [1, 4, 7] }],
});
const status = ["CapInh", "CapPrm", "CapEff", "CapBnd", "CapAmb"]
  .map(key => `${key}:\t0000000000000000`).join("\n") + "\nNoNewPrivs:\t1\n";

test("child environment has only explicit non-secret test settings", () => {
  assert.deepEqual(qaEnvironment("/tmp/fixture", "/fixture/bin"), {
    PATH: "/fixture/bin", HOME: "/tmp/fixture", TMPDIR: "/tmp/fixture",
    XDG_CACHE_HOME: "/tmp/fixture", LANG: "C.UTF-8", NODE_ENV: "test",
  });
});

test("network gate accepts genuine loopback with optional inert SIT, before/after setup", () => {
  assert.doesNotThrow(() => assertNetworkIsolation("net:[1]", base(), { configured: true }));
  const unconfigured = base();
  unconfigured.links[0].flags = 8;
  unconfigured.addresses = []; unconfigured.routes = [];
  assert.doesNotThrow(() => assertNetworkIsolation("net:[1]", unconfigured));
  unconfigured.links.pop();
  assert.doesNotThrow(() => assertNetworkIsolation("net:[1]", unconfigured));
});

const unsafe = {
  "host namespace": s => { s.namespace = "net:[1]"; },
  "malformed namespace": s => { s.namespace = "host"; },
  "incomplete dump": s => { s.complete = false; },
  "missing route dump": s => { delete s.routes; },
  "malformed flags": s => { s.links[1].flags = "128"; },
  "wrong tunnel type": s => { s.links[1].hardware = 1; },
  "UP sit0": s => { s.links[1].flags |= 1; },
  "running sit0": s => { s.links[1].flags |= 64; },
  "other DOWN interface": s => { s.links[1].name = "eth0"; },
  "other UP interface": s => { s.links[1].name = "eth0"; s.links[1].flags |= 1; },
  "fake loopback": s => { s.links[0].hardware = 1; },
  "missing loopback": s => { s.links.shift(); },
  "loopback DOWN after setup": s => { s.links[0].flags = 8; },
  "master interface": s => { s.links[0].master = 2; },
  "linked tunnel": s => { s.links[1].linked = 3; },
  "addressed sit0": s => { s.addresses[0].index = 2; },
  "IPv6 addressed sit0": s => { s.addresses.push({ index: 2, family: 10, prefix: 128, scope: 254, values: ["::1"] }); },
  "foreign IPv4": s => { s.addresses[0].values = ["10.0.0.1"]; },
  "foreign IPv6": s => { s.addresses.push({ index: 1, family: 10, prefix: 128, scope: 254, values: ["2001:db8::1"] }); },
  "routed sit0": s => { s.routes[0].index = 2; },
  "IPv6 routed sit0": s => { Object.assign(s.routes[0], { family: 10, prefix: 128,
    index: 2, destination: "::1", preferredSource: "::1" }); },
  "default IPv4 route": s => { s.routes[0].prefix = 0; s.routes[0].destination = null; },
  "default IPv6 route": s => { s.routes[0].family = 10; s.routes[0].prefix = 0; },
  "foreign destination": s => { s.routes[0].destination = "10.0.0.1"; },
  "gateway": s => { s.routes[0].attributeTypes.push(5); },
  "multipath route": s => { s.routes[0].attributeTypes.push(9); },
  "foreign route table": s => { s.routes[0].table = 123; },
  "unknown route metadata": s => { s.routes[0].attributeTypes.push(99); },
};
for (const [name, mutate] of Object.entries(unsafe)) {
  test(`fails before launch: ${name}`, async () => {
    const current = base(); mutate(current);
    let started = false;
    await assert.rejects(verifiedStart({
      parent: "net:[1]", expected: base(), inspect: async () => current,
      status: async () => status, start: async () => { started = true; },
    }), /Refusing QA/);
    assert.equal(started, false);
  });
}

test("all capability sets must be empty and no-new-privileges mandatory", () => {
  assert.doesNotThrow(() => assertSealed(status));
  for (const key of ["CapInh", "CapPrm", "CapEff", "CapBnd", "CapAmb"]) {
    assert.throws(() => assertSealed(status.replace(`${key}:\t0000000000000000`, `${key}:\t0000000000000001`)));
  }
  assert.throws(() => assertSealed(status.replace("NoNewPrivs:\t1", "NoNewPrivs:\t0")));
  assert.throws(() => assertSealed(""));
});

test("changed post-setup inventory is rejected even if individually loopback-safe", async () => {
  const current = base(); current.routes = [];
  let started = false;
  await assert.rejects(verifiedStart({
    parent: "net:[1]", expected: base(), inspect: async () => current,
    status: async () => status, start: async () => { started = true; },
  }), /post-setup network changed/);
  assert.equal(started, false);
});

test("privilege drop failure rejects before launch", async () => {
  let started = false;
  await assert.rejects(verifiedStart({
    parent: "net:[1]", expected: base(), inspect: async () => base(),
    status: async () => "", start: async () => { started = true; },
  }), /capabilities remain/);
  assert.equal(started, false);
});

test("sealed unchanged inventory permits launch", async () => {
  let started = false;
  await verifiedStart({
    parent: "net:[1]", expected: base(), inspect: async () => base(),
    status: async () => status, start: async () => { started = true; },
  });
  assert.equal(started, true);
});

test("genuine IPv6 loopback address and kernel local route are safe", () => {
  const state = base();
  state.addresses.push({ index: 1, family: 10, prefix: 128, scope: 254, values: ["::1"] });
  state.routes.push({ ...state.routes[0], family: 10, prefix: 128,
    destination: "::1", preferredSource: "::1" });
  assert.doesNotThrow(() => assertNetworkIsolation("net:[1]", state, { configured: true }));
});

test("unavailable isolation stops without launching a fallback server or browser", async () => {
  const calls = [];
  await assert.rejects(launchSandbox("/tmp/fixture", "net:[1]", "/fixture/bin",
    async (...args) => { calls.push(args); return 1; }), /No non-isolated fallback/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "unshare");
  assert.deepEqual(calls[0][1].slice(0, 4), ["--user", "--map-root-user", "--net", "--fork"]);
  assert.deepEqual(calls[0][2], qaEnvironment("/tmp/fixture", "/fixture/bin"));
});

test("test Vite config is loopback only, proxy free and uses scratch env/cache", () => {
  const config = memoryQaViteConfig("/tmp/fixture");
  assert.equal(config.configFile, false);
  assert.equal(config.server.host, "127.0.0.1");
  assert.equal(config.server.strictPort, true);
  assert.deepEqual(config.server.proxy, {});
  assert.equal(config.envDir, "/tmp/fixture/empty-env");
  assert.equal(config.cacheDir, "/tmp/fixture/vite-cache");
});
