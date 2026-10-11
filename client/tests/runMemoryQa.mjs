// Linux-only, fail-closed runner. No backend, credentials, normal Vite config,
// or production environment files. Network isolation is mandatory, not optional.
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readlink, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { assertNetworkIsolation, verifiedStart } from "./memoryQaIsolation.mjs";
export { assertNetworkIsolation } from "./memoryQaIsolation.mjs";

const runner = fileURLToPath(import.meta.url);
const suite = fileURLToPath(new URL("./memoryConversion.browser.test.mjs", import.meta.url));

export function qaEnvironment(scratch, path) {
  // Deliberately do NOT spread process.env or enumerate/read secrets.
  return {
    PATH: path,
    HOME: scratch,
    TMPDIR: scratch,
    XDG_CACHE_HOME: scratch,
    LANG: "C.UTF-8",
    NODE_ENV: "test",
  };
}

const inventoryScript = fileURLToPath(new URL("./memoryQaNetwork.py", import.meta.url));

async function inspectNetwork(env, setup = false) {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", [inventoryScript, ...(setup ? ["--setup"] : [])],
      { env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "", error = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), 10_000);
    child.stdout.on("data", chunk => { output += chunk; });
    child.stderr.on("data", chunk => { error += chunk; });
    child.once("error", err => { clearTimeout(timer); reject(err); });
    child.once("exit", code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`Kernel inventory failed: ${error}`));
      try { resolve(JSON.parse(output)); } catch { reject(new Error("Malformed kernel inventory")); }
    });
  });
}

async function runProcess(command, args, env, { detached = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit", detached });
    let finished = false;
    const stop = () => {
      if (!finished && child.pid) {
        try {
          if (detached) process.kill(-child.pid, "SIGTERM");
          else child.kill("SIGTERM");
        } catch {}
      }
    };
    const timer = setTimeout(stop, 180_000);
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    const clean = () => {
      finished = true;
      clearTimeout(timer);
      process.removeListener("SIGINT", stop);
      process.removeListener("SIGTERM", stop);
    };
    child.once("error", error => { clean(); reject(error); });
    child.once("exit", code => {
      // Also clean up descendants if a test failed before its Chromium teardown.
      if (detached && child.pid) {
        try { process.kill(-child.pid, "SIGTERM"); } catch {}
      }
      clean();
      resolve(code ?? 1);
    });
  });
}

export async function launchSandbox(scratch, parentNamespace, path, run = runProcess) {
  const code = await run("unshare", [
    "--user", "--map-root-user", "--net", "--fork",
    process.execPath, runner, "--isolated", scratch, parentNamespace,
  ], qaEnvironment(scratch, path), { detached: true });
  if (code !== 0) {
    throw new Error(`Isolated QA failed (exit ${code}). No non-isolated fallback is permitted.`);
  }
}

async function isolated(scratch, parentNamespace) {
  const env = qaEnvironment(scratch, process.env.PATH);
  assertNetworkIsolation(parentNamespace, await inspectNetwork(env));
  const expected = await inspectNetwork(env, true);
  assertNetworkIsolation(parentNamespace, expected, { configured: true });
  await writeFile(`${scratch}/network.json`, JSON.stringify(expected), { mode: 0o600 });
  // No fallback: every child must lose all capabilities, including the bounding
  // set, before importing frontend dependencies or launching browser processes.
  const result = await runProcess("setpriv", [
    "--bounding-set=-all", "--inh-caps=-all", "--ambient-caps=-all", "--no-new-privs",
    process.execPath, runner, "--sealed", scratch, parentNamespace,
  ], env);
  if (result !== 0) throw new Error(`Sealed QA failed (exit ${result}); refusing fallback.`);
}

async function sealed(scratch, parentNamespace) {
  const env = qaEnvironment(scratch, process.env.PATH);
  const expected = JSON.parse(await readFile(`${scratch}/network.json`, "utf8"));
  const verify = start => verifiedStart({
    parent: parentNamespace, expected,
    inspect: () => inspectNetwork(env),
    status: () => readFile("/proc/self/status", "utf8"),
    start,
  });
  await verify(async () => {});
  // Import frontend dependencies ONLY after the isolation gate succeeds.
  const { createServer } = await import("vite");
  const { memoryQaViteConfig } = await import("./memoryQa.vite.config.mjs");
  const server = await createServer(memoryQaViteConfig(scratch));
  try {
    await server.listen();
    console.log("Isolated frontend QA: loopback only; no backend or internet.");
    const result = await verify(() => runProcess(process.execPath, ["--test", suite], env));
    if (result !== 0) throw new Error(`Browser suite failed (exit ${result}).`);
  } finally {
    await server.close();
  }
}

async function main() {
  if (process.argv[2] === "--sealed") {
    await sealed(process.argv[3], process.argv[4]);
    return;
  }
  if (process.argv[2] === "--isolated") {
    await isolated(process.argv[3], process.argv[4]);
    return;
  }
  if (process.platform !== "linux") throw new Error("Linux network namespaces are required.");
  const scratch = await mkdtemp("/tmp/memory-qa-");
  try {
    await mkdir(`${scratch}/empty-env`);
    await launchSandbox(scratch, await readlink("/proc/self/ns/net"), process.env.PATH);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] === runner) {
  main().catch(error => {
    console.error(`[memory QA] ${error.message}`);
    process.exitCode = 1;
  });
}
