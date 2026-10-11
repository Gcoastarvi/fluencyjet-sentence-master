import { spawn } from "node:child_process";
import { readFile, lstat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { qaEnvironment } from "./runMemoryQa.mjs";
import { assertSealed, verifiedStart } from "./memoryQaIsolation.mjs";

// Recheck in the actual test process, before browser/backend fixture imports.
export async function assertReceiptSandbox({ scratch, parent, path }) {
  assertSealed(await readFile("/proc/self/status", "utf8"));
  if (!/^\/tmp\/memory-receipt-qa-[a-zA-Z0-9]+$/.test(scratch || "") ||
      !/^net:\[\d+\]$/.test(parent || "")) {
    throw new Error("Private isolated receipt manifest required");
  }
  const manifest = `${scratch}/network.json`;
  const stat = await lstat(manifest);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o600 ||
      stat.uid !== process.getuid()) throw new Error("Unsafe receipt manifest");
  const expected = JSON.parse(await readFile(manifest, "utf8"));
  const inspect = () => new Promise((resolve, reject) => {
    const child = spawn("python3", [
      fileURLToPath(new URL("./memoryQaNetwork.py", import.meta.url)),
    ], { env: qaEnvironment(scratch, path), stdio: ["ignore", "pipe", "ignore"] });
    let output = "";
    const timeout = setTimeout(() => child.kill("SIGKILL"), 10000);
    child.stdout.on("data", chunk => { output += chunk; });
    child.once("error", error => { clearTimeout(timeout); reject(error); });
    child.once("exit", code => {
      clearTimeout(timeout);
      if (code !== 0) return reject(new Error("Receipt child isolation inventory failed"));
      try { resolve(JSON.parse(output)); } catch { reject(new Error("Invalid receipt inventory")); }
    });
  });
  await verifiedStart({
    parent, expected, inspect, status: () => readFile("/proc/self/status", "utf8"),
    start: async () => {},
  });
}
