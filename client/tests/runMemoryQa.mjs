// Linux-only, fail-closed runner. No backend, credentials, normal Vite config,
// or production environment files. Network isolation is mandatory, not optional.
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readlink, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

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

export function assertNetworkIsolation(parentNamespace, currentNamespace, devices) {
  const interfaces = devices.split("\n").slice(2)
    .map(line => line.split(":")[0].trim()).filter(Boolean);
  if (parentNamespace === currentNamespace ||
      interfaces.length !== 1 || interfaces[0] !== "lo") {
    throw new Error(
      `Refusing QA: require a separate loopback-only network namespace; ` +
      `namespace changed=${parentNamespace !== currentNamespace}, interfaces=${interfaces.join(",") || "none"}.`,
    );
  }
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
  assertNetworkIsolation(
    parentNamespace,
    await readlink("/proc/self/ns/net"),
    await readFile("/proc/net/dev", "utf8"),
  );
  const env = qaEnvironment(scratch, process.env.PATH);
  // A fresh network namespace starts with loopback down. Configure ONLY lo.
  // This ioctl is inside the new user/network namespaces, not the host network.
  const code = await runProcess("python3", ["-c", `
import socket, fcntl, struct
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
request = struct.pack('16sH14x', b'lo', 0)
flags = struct.unpack('16sH14x', fcntl.ioctl(s, 0x8913, request))[1]
fcntl.ioctl(s, 0x8914, struct.pack('16sH14x', b'lo', flags | 1))
`], env);
  if (code !== 0) throw new Error("Loopback setup failed; refusing to start QA.");
  // Import frontend dependencies ONLY after the isolation gate succeeds.
  const { createServer } = await import("vite");
  const { memoryQaViteConfig } = await import("./memoryQa.vite.config.mjs");
  const server = await createServer(memoryQaViteConfig(scratch));
  try {
    await server.listen();
    console.log("Isolated frontend QA: loopback only; no backend or internet.");
    const result = await runProcess(process.execPath, ["--test", suite], env);
    if (result !== 0) throw new Error(`Browser suite failed (exit ${result}).`);
  } finally {
    await server.close();
  }
}

async function main() {
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
