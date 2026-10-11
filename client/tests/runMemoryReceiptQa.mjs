// Separate MOCK-ONLY runner. Does not modify or relax runMemoryQa.mjs.
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readlink, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { qaEnvironment } from "./runMemoryQa.mjs";
import { assertNetworkIsolation, verifiedStart } from "./memoryQaIsolation.mjs";
import { assertMockLaunch, requireMockReceipt, MOCK_RECEIPT_CONTEXT } from "./memoryReceiptPolicy.mjs";
import { buildReceiptBrowserSuite } from "./memoryReceiptFixture.mjs";

const runner = fileURLToPath(import.meta.url);
const root = new URL("../../", import.meta.url);
const networkScript = fileURLToPath(new URL("./memoryQaNetwork.py", import.meta.url));

async function inventory(env, setup = false) {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", [networkScript, ...(setup ? ["--setup"] : [])],
      { env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const timeout = setTimeout(() => child.kill("SIGKILL"), 10000);
    child.stdout.on("data", chunk => { output += chunk; });
    child.stderr.resume(); // do not print a child's potentially sensitive output
    child.once("error", error => { clearTimeout(timeout); reject(error); });
    child.once("exit", code => {
      clearTimeout(timeout);
      if (code !== 0) return reject(new Error("Namespace inventory failed; no fallback"));
      try { resolve(JSON.parse(output)); } catch { reject(new Error("Invalid netlink inventory")); }
    });
  });
}

async function run(command, args, env, detached = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, detached, stdio: "inherit", cwd: fileURLToPath(root) });
    const stop = () => {
      if (!child.pid) return;
      try { detached ? process.kill(-child.pid, "SIGTERM") : child.kill("SIGTERM"); } catch {}
    };
    const timeout = setTimeout(stop, 240000);
    process.once("SIGINT", stop); process.once("SIGTERM", stop);
    const cleanup = () => {
      clearTimeout(timeout); process.removeListener("SIGINT", stop);
      process.removeListener("SIGTERM", stop);
    };
    child.once("error", error => { cleanup(); reject(error); });
    child.once("exit", code => { if (detached) stop(); cleanup(); resolve(code ?? 1); });
  });
}

async function main() {
  const phase = process.argv[2];
  if (["--isolated", "--sealed"].includes(phase)) {
    const [scratch, parent] = process.argv.slice(3);
    const env = qaEnvironment(scratch, process.env.PATH);
    requireMockReceipt(MOCK_RECEIPT_CONTEXT);
    if (phase === "--isolated") {
      assertNetworkIsolation(parent, await inventory(env));
      const expected = await inventory(env, true);
      assertNetworkIsolation(parent, expected, { configured: true });
      await writeFile(`${scratch}/network.json`, JSON.stringify(expected), { mode: 0o600 });
      const code = await run("setpriv", [
        "--bounding-set=-all", "--inh-caps=-all", "--ambient-caps=-all", "--no-new-privs",
        process.execPath, runner, "--sealed", scratch, parent,
      ], env);
      if (code !== 0) throw new Error("Sealed mock receipt QA failed; no fallback");
      return;
    }
    const expected = JSON.parse(await readFile(`${scratch}/network.json`, "utf8"));
    const verify = start => verifiedStart({
      parent, expected, inspect: () => inventory(env),
      status: () => readFile("/proc/self/status", "utf8"), start,
    });
    await verify(async () => {});
    // Actual Vite is imported only after namespace and capability validation.
    const { createServer } = await import("vite");
    const { memoryQaViteConfig } = await import("./memoryQa.vite.config.mjs");
    const source = await readFile(new URL("./memoryConversion.browser.test.mjs", import.meta.url), "utf8");
    const cases = await readFile(new URL("./memoryReceipt.browser.cases.mjs", import.meta.url), "utf8");
    const suite = `${scratch}/receipt.browser.test.mjs`;
    await writeFile(suite, buildReceiptBrowserSuite(source, cases,
      new URL("./memoryReceiptPolicy.mjs", import.meta.url).href,
      new URL("./memoryReceiptFixture.mjs", import.meta.url).href, root), { mode: 0o600 });
    const server = await createServer(memoryQaViteConfig(scratch));
    try {
      await verify(() => server.listen());
      console.log("MOCK receipt QA: loopback namespace; no actual Meta receipt or internet.");
      const testEnv = { ...env, MEMORY_RECEIPT_QA_SCRATCH: scratch,
        MEMORY_RECEIPT_QA_PARENT_NAMESPACE: parent };
      const code = await verify(() => run(process.execPath, ["--test", suite], testEnv));
      if (code !== 0) throw new Error("Mock receipt browser tests failed");
    } finally { await server.close(); }
    const config = JSON.stringify({
      rootDir: fileURLToPath(new URL("server/", root)),
      testEnvironment: "node", transform: {}, testTimeout: 10000,
      testMatch: ["**/memoryMetaReceiptQa.receipt.mjs"],
      cacheDirectory: `${scratch}/jest-cache`,
    });
    const jest = fileURLToPath(new URL("server/node_modules/jest/bin/jest.js", root));
    const code = await verify(() => run(process.execPath, [
      "--experimental-vm-modules", jest, "--config", config, "--runInBand",
      "--runTestsByPath", fileURLToPath(new URL("server/__tests__/memoryMetaReceiptQa.receipt.mjs", root)),
    ], { ...env, MEMORY_RECEIPT_QA_SCRATCH: scratch,
      MEMORY_RECEIPT_QA_PARENT_NAMESPACE: parent }));
    if (code !== 0) throw new Error("Mock signed Purchase receipt tests failed");
    return;
  }
  // No default launch and no live/secret flags. Importing this file never starts.
  assertMockLaunch(process.argv.slice(2));
  if (process.platform !== "linux") throw new Error("Linux network namespaces required");
  const scratch = await mkdtemp("/tmp/memory-receipt-qa-");
  try {
    await mkdir(`${scratch}/empty-env`);
    const parent = await readlink("/proc/self/ns/net");
    const code = await run("unshare", [
      "--user", "--map-root-user", "--net", "--fork",
      process.execPath, runner, "--isolated", scratch, parent,
    ], qaEnvironment(scratch, process.env.PATH), true);
    if (code !== 0) throw new Error("Isolated mock receipt QA failed; refusing nonisolated execution");
  } finally { await rm(scratch, { recursive: true, force: true }); }
}

if (process.argv[1] === runner) {
  main().catch(() => {
    // Do not leak credential/input/path-bearing exception details in QA output.
    console.error("Receipt QA refused or failed; MOCK ONLY, no nonisolated/live fallback.");
    process.exitCode = 1;
  });
}
