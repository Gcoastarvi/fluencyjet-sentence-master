import { test } from "node:test";
import assert from "node:assert/strict";
import { qaEnvironment, assertNetworkIsolation, launchSandbox } from "./runMemoryQa.mjs";
import { memoryQaViteConfig } from "./memoryQa.vite.config.mjs";

const devices = "Inter-| Receive\n face |bytes\n lo: 0 0 0\n";

test("child environment has only explicit non-secret test settings", () => {
  assert.deepEqual(qaEnvironment("/tmp/fixture", "/fixture/bin"), {
    PATH: "/fixture/bin", HOME: "/tmp/fixture", TMPDIR: "/tmp/fixture",
    XDG_CACHE_HOME: "/tmp/fixture", LANG: "C.UTF-8", NODE_ENV: "test",
  });
});

test("network gate rejects host namespace and any non-loopback interface", () => {
  assert.throws(() => assertNetworkIsolation("net:[1]", "net:[1]", devices));
  assert.throws(() => assertNetworkIsolation("net:[1]", "net:[2]", devices + "eth0: 0\n"));
  assert.throws(() => assertNetworkIsolation("net:[1]", "net:[2]", ""));
  assert.doesNotThrow(() => assertNetworkIsolation("net:[1]", "net:[2]", devices));
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
